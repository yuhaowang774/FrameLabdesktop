// EXIF 识别：用 exifr 读取 焦距/光圈/快门/ISO，拼接为 "Xmm f/X 1/Xs ISOX"
import exifr from 'exifr'

export interface ExifParseResult {
  text: string
  raw: {
    focalLength?: number
    fNumber?: number
    exposureTime?: number
    iso?: number
  }
}

function formatShutter(t: number): string {
  // t 为秒；<1s 显示为 1/n，>=1s 显示为 n"s"
  if (t >= 1) return `${Math.round(t)}s`
  const denom = Math.round(1 / t)
  return `1/${denom}s`
}

function formatFocal(mm?: number): string {
  if (mm == null) return ''
  // 保留一位小数，去尾零
  const s = mm % 1 === 0 ? String(mm) : mm.toFixed(1)
  return `${s}mm`
}

function formatFNumber(f?: number): string {
  if (f == null) return ''
  return `f/${f}`
}

function formatIso(iso?: number): string {
  if (iso == null) return ''
  return `ISO${iso}`
}

/**
 * 从图片源解析 EXIF 并拼接标准格式串。
 * @param source File / Blob / ArrayBuffer / 图片URL
 * @returns 拼接后的文本与原始字段
 */
export async function parseExif(source: File | Blob | ArrayBuffer | string): Promise<ExifParseResult> {
  const data = await exifr.parse(source, {
    pick: ['FocalLength', 'FNumber', 'ExposureTime', 'ISO'],
  })

  if (!data) {
    throw new Error('无 EXIF 数据')
  }

  const focalLength = typeof data.FocalLength === 'number' ? data.FocalLength : undefined
  const fNumber = typeof data.FNumber === 'number' ? data.FNumber : undefined
  const exposureTime = typeof data.ExposureTime === 'number' ? data.ExposureTime : undefined
  const iso = typeof data.ISO === 'number' ? data.ISO : undefined

  const parts = [
    formatFocal(focalLength),
    formatFNumber(fNumber),
    exposureTime != null ? formatShutter(exposureTime) : '',
    formatIso(iso),
  ].filter(Boolean)

  if (parts.length === 0) {
    throw new Error('未找到可用 EXIF 字段')
  }

  return {
    text: parts.join(' '),
    raw: { focalLength, fNumber, exposureTime, iso },
  }
}
