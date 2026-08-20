// EXIF 识别：用 exifr 读取 焦距/光圈/快门/ISO/品牌/机型，拼接为 "Xmm f/X 1/Xs ISOX"
import exifr from 'exifr'
import { EXIF_MAKE_TO_BRAND } from '../core/constants'

export interface ExifParseResult {
  text: string
  raw: {
    focalLength?: number
    fNumber?: number
    exposureTime?: number
    iso?: number
  }
  /** 相机厂商（EXIF Make 原始值），如 "SONY" */
  make?: string
  /** 清洗后的相机机型，如 "ILCE-7RM5" 或 "Z 6" */
  model?: string
  /** 根据 Make 自动匹配的内置品牌 id（未匹配则为 undefined） */
  brandId?: string
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
 * 清洗机型：去掉 Model 前缀里重复的 Make（如 "NIKON Z 6" → "Z 6"，
 * "SONY ILCE-7RM5" → "ILCE-7RM5"），并去掉尾部多余空格。
 */
function cleanModel(model: string, make?: string): string {
  let m = model.trim()
  if (make) {
    const mk = make.trim()
    // 大小写不敏感地去掉前缀
    if (m.toLowerCase().startsWith(mk.toLowerCase())) {
      m = m.slice(mk.length).trim()
    }
  }
  return m
}

/**
 * 从 EXIF Make 自动匹配内置品牌 id。
 */
function matchBrand(make?: string): string | undefined {
  if (!make) return undefined
  const lower = make.toLowerCase()
  for (const [kw, brandId] of Object.entries(EXIF_MAKE_TO_BRAND)) {
    if (lower.includes(kw)) return brandId
  }
  return undefined
}

/**
 * 从图片源解析 EXIF 并拼接标准格式串。
 * @param source File / Blob / ArrayBuffer / 图片URL
 * @returns 拼接后的文本与原始字段（含 make/model/brandId）
 */
export async function parseExif(source: File | Blob | ArrayBuffer | string): Promise<ExifParseResult> {
  const data = await exifr.parse(source, {
    pick: ['FocalLength', 'FNumber', 'ExposureTime', 'ISO', 'Make', 'Model'],
  })

  if (!data) {
    throw new Error('无 EXIF 数据')
  }

  const focalLength = typeof data.FocalLength === 'number' ? data.FocalLength : undefined
  const fNumber = typeof data.FNumber === 'number' ? data.FNumber : undefined
  const exposureTime = typeof data.ExposureTime === 'number' ? data.ExposureTime : undefined
  const iso = typeof data.ISO === 'number' ? data.ISO : undefined
  const make = typeof data.Make === 'string' ? data.Make : undefined
  const rawModel = typeof data.Model === 'string' ? data.Model : undefined
  const model = rawModel ? cleanModel(rawModel, make) : undefined
  const brandId = matchBrand(make)

  const parts = [
    formatFocal(focalLength),
    formatFNumber(fNumber),
    exposureTime != null ? formatShutter(exposureTime) : '',
    formatIso(iso),
  ].filter(Boolean)

  if (parts.length === 0 && !model && !brandId) {
    throw new Error('未找到可用 EXIF 字段')
  }

  return {
    text: parts.join(' '),
    raw: { focalLength, fNumber, exposureTime, iso },
    make,
    model,
    brandId,
  }
}
