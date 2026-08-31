// ICC Profile 嵌入（#6 折中方案）：
// Canvas 导出的像素始终是 sRGB（浏览器在 drawImage 时已按嵌入 ICC 做色彩管理转换），
// 但 toBlob 产出的 JPEG 不携带任何 ICC 标签——部分看图软件/社交平台在无标签时会按
// 显示器配置文件或原始色域猜解读，造成「导出后偏色」。导出时嵌入标准 sRGB ICC
// 使色彩解释确定性一致。注意：不嵌原图 ICC（如 AdobeRGB）——像素已被转换到 sRGB，
// 再标原色域会导致看图软件二次转换、偏色加剧。
//
// sRGB ICC 为程序化构建的最小合法 v2 矩阵/TRC 剖面（~476B），无外部数据依赖。

// ---- ICC 基础写入 ----
// s15Fixed16：ICC 标准定点数（高 16 位整数 / 低 16 位小数）
function s15f16(v: number): number {
  return Math.round(v * 65536)
}

interface IccTag {
  sig: string // 4 字符标签签名
  data: Uint8Array
}

function asciiBlock(sig: string, text: string, pad: number): Uint8Array {
  // 文本类标签：签名(4) + 保留(4) + ASCII（含结尾 \0）+ 补零对齐
  const bytes = new TextEncoder().encode(text + '\0')
  const size = 8 + bytes.length
  const out = new Uint8Array(Math.ceil(size / pad) * pad || pad)
  const dv = new DataView(out.buffer)
  dv.setUint32(0, sigCode(sig))
  out.set(bytes, 8)
  return out
}

function sigCode(sig: string): number {
  // 'desc' → 0x64657363
  return (
    (sig.charCodeAt(0) << 24) | (sig.charCodeAt(1) << 16) | (sig.charCodeAt(2) << 8) | sig.charCodeAt(3)
  )
}

function sigTag(sig: string): Uint8Array {
  const out = new Uint8Array(4)
  const v = sigCode(sig)
  new DataView(out.buffer).setUint32(0, v)
  return out
}

/** XYZType 标签：签名(4)+保留(4)+X/Y/Z(s15Fixed16) */
function xyzTag(sig: string, x: number, y: number, z: number): Uint8Array {
  const out = new Uint8Array(20)
  const dv = new DataView(out.buffer)
  dv.setUint32(0, sigCode(sig))
  dv.setInt32(8, s15f16(x))
  dv.setInt32(12, s15f16(y))
  dv.setInt32(16, s15f16(z))
  return out
}

/** curveType 标签：count=1 时条目为 u8Fixed8 gamma（sRGB 近似 2.2） */
function gammaTag(sig: string, gamma: number): Uint8Array {
  const out = new Uint8Array(16)
  const dv = new DataView(out.buffer)
  dv.setUint32(0, sigCode(sig))
  dv.setUint32(8, 1) // 1 个条目 = u8Fixed8 gamma
  dv.setUint16(12, Math.round(gamma * 256))
  return out
}

/** textDescriptionType（'desc'）：sig4 + res4 + asciiCount4 + ascii + unicode8 + scriptcode69，总长补齐 4 对齐 */
function descTag(text: string): Uint8Array {
  const ascii = new TextEncoder().encode(text + '\0')
  const size = 12 + ascii.length + 77
  const out = new Uint8Array(Math.ceil(size / 4) * 4)
  const dv = new DataView(out.buffer)
  dv.setUint32(0, sigCode('desc'))
  dv.setUint32(8, ascii.length)
  out.set(ascii, 12)
  // unicode 语言码/计数与 scriptcode 区保持全零
  return out
}

/** 构建最小合法 sRGB ICC v2 剖面（矩阵/TRC 型，mntr/RGB/XYZ），结果缓存复用 */
let srgbIccCache: Uint8Array | null = null
export function buildSrgbICC(): Uint8Array {
  if (srgbIccCache) return srgbIccCache

  const tags: IccTag[] = [
    { sig: 'desc', data: descTag('sRGB IEC61966-2.1') },
    { sig: 'cprt', data: asciiBlock('text', 'sRGB (IEC 61966-2.1)', 4) },
    // 介质白点 D50
    { sig: 'wtpt', data: xyzTag('XYZ ', 0.9642, 1.0, 0.8249) },
    // sRGB 原色 → PCS(D50) 矩阵（Bradford 适配）
    { sig: 'rXYZ', data: xyzTag('XYZ ', 0.4360747, 0.2225045, 0.0139322) },
    { sig: 'gXYZ', data: xyzTag('XYZ ', 0.3850649, 0.7168786, 0.0971045) },
    { sig: 'bXYZ', data: xyzTag('XYZ ', 0.1430804, 0.0606229, 0.7141733) },
    { sig: 'rTRC', data: gammaTag('curv', 2.2) },
    { sig: 'gTRC', data: gammaTag('curv', 2.2) },
    { sig: 'bTRC', data: gammaTag('curv', 2.2) },
  ]

  // 数据区顺序布局（元素均已 4 字节对齐）
  const headerSize = 128
  const tableSize = 4 + tags.length * 12
  let offset = headerSize + tableSize
  const offsets: number[] = []
  for (let i = 0; i < tags.length; i++) {
    offsets.push(offset)
    offset += tags[i].data.length
  }
  const total = offset

  const out = new Uint8Array(total)
  const dv = new DataView(out.buffer)
  // ---- 头部 128 字节 ----
  dv.setUint32(0, total)
  dv.setUint32(4, 0) // CMM
  dv.setUint32(8, 0x02100000) // v2.1
  out.set(sigTag('mntr'), 12)
  out.set(sigTag('RGB '), 16)
  out.set(sigTag('XYZ '), 20)
  dv.setUint16(24, 2024) // 日期 2024-01-01 00:00:00
  dv.setUint16(26, 1)
  dv.setUint16(28, 1)
  dv.setUint32(36, sigCode('acsp'))
  dv.setUint32(64, 0) // 感知意图
  dv.setUint32(68, 0x0000f6d6) // D50 白点
  dv.setUint32(72, 0x00010000)
  dv.setUint32(76, 0x0000d32d)
  // ---- 标签表 ----
  let tablePos = headerSize
  dv.setUint32(tablePos, tags.length)
  tablePos += 4
  for (let i = 0; i < tags.length; i++) {
    dv.setUint32(tablePos, sigCode(tags[i].sig))
    dv.setUint32(tablePos + 4, offsets[i])
    dv.setUint32(tablePos + 8, tags[i].data.length)
    tablePos += 12
  }
  // ---- 数据区 ----
  for (let i = 0; i < tags.length; i++) {
    out.set(tags[i].data, offsets[i])
  }

  srgbIccCache = out
  return out
}

const ICC_HEADER = [0x49, 0x43, 0x43, 0x5f, 0x50, 0x52, 0x4f, 0x46, 0x49, 0x4c, 0x45, 0x00] // "ICC_PROFILE\0"
/** APP2 单段数据上限：65533 - 12(ICCPROFILE头) - 2(序号/总数) */
const ICC_CHUNK_MAX = 65519

/** ICC 按上限分块，每块加 "ICC_PROFILE\0" + 序号/总数 头 */
function iccChunks(icc: Uint8Array): Uint8Array[] {
  const total = Math.max(1, Math.ceil(icc.length / ICC_CHUNK_MAX))
  const chunks: Uint8Array[] = []
  for (let i = 0; i < total; i++) {
    const data = icc.subarray(i * ICC_CHUNK_MAX, (i + 1) * ICC_CHUNK_MAX)
    const chunk = new Uint8Array(14 + data.length)
    chunk.set(ICC_HEADER, 0)
    chunk[12] = i + 1
    chunk[13] = total
    chunk.set(data, 14)
    chunks.push(chunk)
  }
  return chunks
}

/**
 * 向 JPEG 注入 ICC（APP2 "ICC_PROFILE" 段）。
 * 插入位置：SOI 与既有 APP0/APP1（JFIF/EXIF）之后、其余段之前（ICC 规范建议位置）。
 * 已携带 ICC 的 JPEG（如 Chromium toBlob 原生输出）跳过注入——规范要求单一 ICC 序列。
 * 非 JPEG 或结构异常时原样返回，绝不产出损坏文件。
 */
export function embedJpegICC(jpeg: ArrayBuffer, icc: Uint8Array): ArrayBuffer {
  const src = new Uint8Array(jpeg)
  if (src.length < 4 || src[0] !== 0xff || src[1] !== 0xd8) return jpeg

  // 扫描插入点：跳过 APP0/APP1/APP2 段
  let pos = 2
  while (pos + 4 <= src.length && src[pos] === 0xff) {
    const marker = src[pos + 1]
    if (marker === 0xe0 || marker === 0xe1 || marker === 0xe2) {
      // 已有 ICC_PROFILE（APP2 以 "ICC_PROFILE\0" 开头）：跳过注入
      if (marker === 0xe2 && src[pos + 4] === ICC_HEADER[0] && src[pos + 5] === ICC_HEADER[1]) {
        let isIcc = true
        for (let k = 2; k < ICC_HEADER.length; k++) {
          if (src[pos + 4 + k] !== ICC_HEADER[k]) {
            isIcc = false
            break
          }
        }
        if (isIcc) return jpeg
      }
      const len = (src[pos + 2] << 8) | src[pos + 3]
      if (len < 2) return jpeg // 结构异常
      pos += 2 + len
      continue
    }
    break
  }
  if (pos >= src.length) return jpeg

  const chunks = iccChunks(icc)
  const segsTotal = chunks.reduce((sum, c) => sum + 2 + 2 + c.length, 0)
  const out = new Uint8Array(src.length + segsTotal)
  out.set(src.subarray(0, pos), 0)
  let w = pos
  for (let i = 0; i < chunks.length; i++) {
    out[w++] = 0xff
    out[w++] = 0xe2 // APP2
    const segLen = 2 + chunks[i].length
    out[w++] = (segLen >> 8) & 0xff
    out[w++] = segLen & 0xff
    out.set(chunks[i], w)
    w += chunks[i].length
  }
  out.set(src.subarray(pos), w)
  return out.buffer
}
