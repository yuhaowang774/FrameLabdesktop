// EXIF 识别：用 exifr 读取 焦距/光圈/快门/ISO/品牌/机型/镜头，拼接为 "Xmm f/X 1/Xs ISOX"
import exifr from 'exifr'
import { EXIF_MAKE_TO_BRAND } from '../core/constants'

export interface ExifParseResult {
  text: string
  raw: ExifRaw
  /** 相机厂商（EXIF Make 原始值），如 "SONY" */
  make?: string
  /** 清洗后的相机机型，如 "ILCE-7RM5" 或 "Z 6" */
  model?: string
  /** 根据 Make 自动匹配的内置品牌 id（未匹配则为 undefined） */
  brandId?: string
  /** 清洗后的镜头型号显示文本（LensMake + LensModel），无镜头信息为 undefined */
  lens?: string
}

/** EXIF 原始字段类型（FrameConfig.exifRaw / 拼接共用） */
export interface ExifRaw {
  focalLength?: number
  focalLength35?: number
  fNumber?: number
  exposureTime?: number
  iso?: number
  /** 拍摄日期原始串（EXIF DateTimeOriginal，"YYYY:MM:DD HH:mm:ss"） */
  dateTimeOriginal?: string
  /** 镜头厂商（EXIF LensMake 原始值），如 "TAMRON" */
  lensMake?: string
  /** 镜头型号（EXIF LensModel 原始值），如 "FE 55mm F1.8 ZA" */
  lensModel?: string
}

/** 日期显示格式 */
export type DateFormat = 'date' | 'datetime' | 'zh' | 'dash'

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
 * 清洗镜头显示文本：合并 LensMake + LensModel。
 * 部分机身把无镜头信息写成 "----"/空串，直接丢弃；LensModel 若已含厂商前缀则去重。
 */
export function cleanLens(lensMake?: string, lensModel?: string): string | undefined {
  const bad = (s?: string) => !s || !s.trim() || /^-+$/.test(s.trim())
  const make = bad(lensMake) ? undefined : lensMake!.trim()
  const model = bad(lensModel) ? undefined : lensModel!.trim()
  if (!make && !model) return undefined
  if (make && model) {
    const m = model.toLowerCase().startsWith(make.toLowerCase())
      ? model.slice(make.length).trim()
      : model
    return `${make} ${m}`.trim()
  }
  return (model ?? make)!.trim()
}

/** 解析等效焦距显示值：开关关闭=原始；cropFactor>0=焦距×系数；否则优先 EXIF 35mm 字段，缺失回退原始 */
export function resolveFocal(raw: ExifRaw, eqFocal: boolean, cropFactor: number): string {
  const f = raw.focalLength
  if (f == null) return ''
  if (!eqFocal) return formatFocal(f)
  if (cropFactor > 0) return formatFocal(f * cropFactor)
  if (raw.focalLength35 != null) return formatFocal(raw.focalLength35)
  return formatFocal(f)
}

/**
 * 由原始字段拼接 EXIF 展示文本："Xmm f/X 1/Xs ISOX"。
 * opts.eqFocal：等效焦距显示；opts.cropFactor：手动画幅系数（0=自动用 EXIF 35mm 字段）。
 * 供导入回填、等效焦距开关切换重拼、批量导出回填共用。
 */
export function buildExifText(
  raw: ExifRaw | null,
  opts: { eqFocal?: boolean; cropFactor?: number } = {},
): string {
  if (!raw) return ''
  const parts = [
    resolveFocal(raw, !!opts.eqFocal, opts.cropFactor ?? 0),
    formatFNumber(raw.fNumber),
    raw.exposureTime != null ? formatShutter(raw.exposureTime) : '',
    formatIso(raw.iso),
  ].filter(Boolean)
  return parts.join(' ')
}

/**
 * 格式化拍摄日期显示文本。
 * 原始串 "YYYY:MM:DD HH:mm:ss"（或已格式化文本）按 style 输出；
 * 非 EXIF 原始格式（用户手填）原样返回。
 * 注意：不走 Date/toISOString（UTC 偏移），直接字符串切片，从根上规避时区错位。
 */
export function formatDate(src: string | undefined, style: DateFormat): string {
  if (!src) return ''
  const m = src.match(/^(\d{4}):(\d{2}):(\d{2})(?:\s+(\d{2}):(\d{2}))?/)
  if (!m) return src
  const [, y, mo, d, h, mi] = m
  if (style === 'zh') return `${y}年${Number(mo)}月${Number(d)}日`
  if (style === 'dash') return `${y}-${mo}-${d}${h ? ` ${h}:${mi}` : ''}`
  if (style === 'datetime') return `${y}/${mo}/${d}${h ? ` ${h}:${mi}` : ''}`
  return `${y}/${mo}/${d}`
}

/**
 * 由 Date 对象取 EXIF 原始日期串（exifr 以本地时区构造，get* 返回相机记录原值）。
 * 无有效日期返回 undefined。
 */
function dateToExifString(dt: unknown): string | undefined {
  if (!(dt instanceof Date) || isNaN(dt.getTime())) return undefined
  const p = (n: number) => String(n).padStart(2, '0')
  return `${dt.getFullYear()}:${p(dt.getMonth() + 1)}:${p(dt.getDate())} ${p(dt.getHours())}:${p(dt.getMinutes())}:${p(dt.getSeconds())}`
}

/**
 * 从图片源解析 EXIF 并拼接标准格式串。
 * @param source File / Blob / ArrayBuffer / 图片URL
 * @returns 拼接后的文本与原始字段（含 make/model/brandId）
 */
export async function parseExif(source: File | Blob | ArrayBuffer | string): Promise<ExifParseResult> {
  const data = await exifr.parse(source, {
    pick: ['FocalLength', 'FocalLengthIn35mmFilm', 'FNumber', 'ExposureTime', 'ISO', 'Make', 'Model', 'DateTimeOriginal', 'LensMake', 'LensModel'],
  })

  if (!data) {
    throw new Error('无 EXIF 数据')
  }

  const focalLength = typeof data.FocalLength === 'number' ? data.FocalLength : undefined
  const focalLength35 = typeof data.FocalLengthIn35mmFilm === 'number' ? data.FocalLengthIn35mmFilm : undefined
  const fNumber = typeof data.FNumber === 'number' ? data.FNumber : undefined
  const exposureTime = typeof data.ExposureTime === 'number' ? data.ExposureTime : undefined
  const iso = typeof data.ISO === 'number' ? data.ISO : undefined
  const make = typeof data.Make === 'string' ? data.Make : undefined
  const rawModel = typeof data.Model === 'string' ? data.Model : undefined
  const model = rawModel ? cleanModel(rawModel, make) : undefined
  const brandId = matchBrand(make)
  const dateTimeOriginal = dateToExifString(data.DateTimeOriginal)
  const lensMake = typeof data.LensMake === 'string' ? data.LensMake : undefined
  const lensModel = typeof data.LensModel === 'string' ? data.LensModel : undefined
  const lens = cleanLens(lensMake, lensModel)

  const raw: ExifRaw = { focalLength, focalLength35, fNumber, exposureTime, iso, dateTimeOriginal, lensMake, lensModel }
  const text = buildExifText(raw)

  if (!text && !model && !brandId && !lens) {
    throw new Error('未找到可用 EXIF 字段')
  }

  return {
    text,
    raw,
    make,
    model,
    brandId,
    lens,
  }
}
