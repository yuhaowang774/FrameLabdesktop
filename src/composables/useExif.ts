// EXIF 识别：用 exifr 读取 焦距/光圈/快门/ISO/品牌/机型/镜头，拼接为 "Xmm f/X 1/Xs ISOX"
import exifr from 'exifr'
import { EXIF_MAKE_TO_BRAND } from '../core/constants'
import { modelAlias } from '../core/modelAlias'

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
  /** 清洗 + 营销名映射后的机型（如 "α7R V"、"DJI Mini 3"），供「自动填充」恢复型号 */
  model?: string
  /** 根据 Make 自动匹配的内置品牌 id，供「自动填充」恢复品牌 */
  brandId?: string
}

/** 日期显示格式（en = 英文杂志式 "JUN 10th, 2025"，供 magazine 副标题） */
export type DateFormat = 'date' | 'datetime' | 'zh' | 'dash' | 'en'

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
 * 从 EXIF Make / Model 自动匹配内置品牌 id。
 * 部分照片（修图导出、截图等）Make 缺失但 Model 含品牌字样（"Canon EOS R6"），
 * 因此 Make 匹配失败时用 Model 兜底；机身代号（ILCE 等）靠品牌表尾部的代号关键词。
 */
function matchBrand(make?: string, model?: string): string | undefined {
  for (const src of [make, model]) {
    if (!src) continue
    const lower = src.toLowerCase()
    for (const [kw, brandId] of Object.entries(EXIF_MAKE_TO_BRAND)) {
      if (lower.includes(kw)) return brandId
    }
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
  if (style === 'en') {
    const moN = Number(mo)
    // 非法月份（损坏的 EXIF）回退默认斜杠格式，不产出 "13月" 之类的串
    if (moN < 1 || moN > 12) return `${y}/${mo}/${d}`
    const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
    const day = Number(d)
    // 英文序数词后缀：11-13 特例均为 th，其余按个位 1/2/3 取 st/nd/rd
    const suffix = day % 100 >= 11 && day % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][day % 10 > 3 ? 0 : day % 10]
    return `${MONTHS[moN - 1]} ${day}${suffix}, ${y}`
  }
  return `${y}/${mo}/${d}`
}

/**
 * 从显示文本反解日期为 EXIF 原始风格串（"YYYY:MM:DD HH:mm"），供切换日期格式时
 * 对无 EXIF 原始日期的照片（手填或已格式化文本）重新格式化。
 * 支持 EXIF 原始格式与四种展示格式（2026/08/27、带时间、横线、中文）；无法解析返回 undefined。
 */
export function parseDisplayDate(text: string | undefined): string | undefined {
  if (!text) return undefined
  const t = text.trim()
  let m = t.match(/^(\d{4})[:/-](\d{1,2})[:/-](\d{1,2})(?:\s+(\d{1,2}):(\d{2}))?/)
  if (!m) m = t.match(/^(\d{4})年(\d{1,2})月(\d{1,2})日/)
  if (!m) {
    // en 英文杂志式（formatDate 'en' 的输出）："JUN 10th, 2025"（逗号可省略）
    m = t.match(/^([A-Za-z]{3})\s+(\d{1,2})(?:st|nd|rd|th),?\s+(\d{4})$/)
    if (m) {
      const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
      const mo = MONTHS.indexOf(m[1].toLowerCase()) + 1
      if (mo > 0) return `${m[3]}:${String(mo).padStart(2, '0')}:${m[2].padStart(2, '0')}`
      return undefined
    }
  }
  if (!m) return undefined
  const p = (n: string) => n.padStart(2, '0')
  const time = m[4] ? ` ${p(m[4])}:${m[5]}` : ''
  return `${m[1]}:${p(m[2])}:${p(m[3])}${time}`
}

/** INFO 字段缺失占位文本（模板应用时对无数据字段填入） */
export const INFO_PLACEHOLDER = '自定义'

/** INFO 字段是否缺失：空串或「自定义」占位均视为缺失，可被真实信息回填 */
export function isInfoMissing(v: string | null | undefined): boolean {
  return !v || v.trim() === INFO_PLACEHOLDER
}

/** 可被 backfillInfoFromRaw 回填的最小字段集（FrameConfig 结构兼容） */
export interface InfoBackfillTarget {
  exifText: string
  dateText: string
  lensText: string
  cameraModel: string
  brand: string
  dateFormat: DateFormat
  eqFocal: boolean
  cropFactor: number
  exifRaw?: ExifRaw | null
}

/**
 * 从照片 exifRaw 回填「缺失」（空或「自定义」占位）的 INFO 字段；已填写的自定义内容保持不变。
 * 供模板应用使用（模板只补缺失、不覆盖用户内容；「自动填充」按钮的全量覆盖语义在
 * InfoLayerPanel.autoFillInfo 内单独实现）。
 * 覆盖：EXIF 参数（按 eqFocal/cropFactor 拼接）/ 拍摄日期（按 dateFormat）/ 镜头 /
 * 相机型号（raw.model，旧版导入的照片未存时回填不了）；
 * 品牌占位 → raw.brandId 仅在 opts.brand !== false 时恢复（默认开启，可关闭）。
 * 就地修改传入对象，返回是否有改动。
 */
export function backfillInfoFromRaw(
  cfg: InfoBackfillTarget,
  opts: { brand?: boolean } = {},
): boolean {
  const raw = cfg.exifRaw
  if (!raw) return false
  let changed = false
  if (isInfoMissing(cfg.exifText)) {
    const v = buildExifText(raw, { eqFocal: cfg.eqFocal, cropFactor: cfg.cropFactor })
    if (v) {
      cfg.exifText = v
      changed = true
    }
  }
  if (isInfoMissing(cfg.dateText) && raw.dateTimeOriginal) {
    const v = formatDate(raw.dateTimeOriginal, cfg.dateFormat)
    if (v) {
      cfg.dateText = v
      changed = true
    }
  }
  if (isInfoMissing(cfg.lensText)) {
    const v = cleanLens(raw.lensMake, raw.lensModel)
    if (v) {
      cfg.lensText = v
      changed = true
    }
  }
  if (isInfoMissing(cfg.cameraModel) && raw.model) {
    cfg.cameraModel = raw.model
    changed = true
  }
  if (opts.brand !== false && cfg.brand === INFO_PLACEHOLDER && raw.brandId) {
    cfg.brand = raw.brandId
    changed = true
  }
  return changed
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
  // cleanModel 去掉重复的 Make 前缀（"SONY ILCE-7RM5" → "ILCE-7RM5"），
  // modelAlias 再把机身代号翻译成营销名（ILCE-7RM5 → α7R V、FC3682 → DJI Mini 3）
  const model = rawModel ? modelAlias(cleanModel(rawModel, make)) : undefined
  const brandId = matchBrand(make, rawModel)
  const dateTimeOriginal = dateToExifString(data.DateTimeOriginal)
  const lensMake = typeof data.LensMake === 'string' ? data.LensMake : undefined
  const lensModel = typeof data.LensModel === 'string' ? data.LensModel : undefined
  const lens = cleanLens(lensMake, lensModel)

  const raw: ExifRaw = { focalLength, focalLength35, fNumber, exposureTime, iso, dateTimeOriginal, lensMake, lensModel, model, brandId }
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
