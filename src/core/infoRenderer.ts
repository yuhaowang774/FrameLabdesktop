// 顶层 INFO 信息层渲染器（Canvas 导出路径）
// ----------------------------------------------------------------------------
// 仅负责把 InfoLayerConfig.elements 按其 zIndex 升序绘制到给定的 2D 上下文，
// 与预览层的 DOM/SVG 浮层（InfoLayerDisplay）保持一致的视觉结果。
//
// 坐标约定（设计 px，统一乘以 unitScale 转换到输出像素）：
//   - 当 bindTarget === 'canvas'：元素坐标相对画布中心 (DESIGN_CONTAINER.w/2, H/2)
//   - 当 bindTarget === 'photo'：调用方必须先传入 photo 变换 outerMatrix（含旋转/缩放/平移），
//     元素坐标相对照片中心，直接在该矩阵内绘制即可。
//
// 绘制顺序（强制，对应需求"绘制执行流程"第 5 步）：按 zIndex 从小到大。
import { DESIGN_CONTAINER } from './constants'
import { resolveLogo, preloadBrandLogo } from '../composables/useLogoStore'
import { resolveFocal, cleanLens, formatGps, type ExifRaw } from '../composables/useExif'
import type { InfoElement, InfoLayerConfig } from './types'

// 设计稿基准宽度（1200），画布中心 X 默认等于其一半
const DESIGN_CX = DESIGN_CONTAINER / 2

// ===== EXIF 模板解析 =====
// 焦距格式化/等效换算复用 useExif 的 resolveFocal；其余轻量内联实现。
function formatShutter(t: number): string {
  if (t >= 1) return `${Math.round(t)}s`
  return `1/${Math.round(1 / t)}s`
}
function formatFNumber(f?: number): string {
  if (f == null) return ''
  return `f/${f}`
}
function formatIso(iso?: number): string {
  if (iso == null) return ''
  return `ISO${iso}`
}

/** 由 exifRaw 计算可用字段映射，供模板 {key} 替换（eq：等效焦距开关/系数） */
export function buildExifFieldMap(
  exifRaw: ExifRaw | null,
  model?: string,
  eq: { eqFocal?: boolean; cropFactor?: number } = {},
  dateText?: string,
): Record<string, string> {
  const r = exifRaw || {}
  return {
    focal: resolveFocal(r, !!eq.eqFocal, eq.cropFactor ?? 0),
    aperture: formatFNumber(r.fNumber),
    shutter: r.exposureTime != null ? formatShutter(r.exposureTime) : '',
    iso: formatIso(r.iso),
    model: model || '',
    lens: cleanLens(r.lensMake, r.lensModel) ?? '',
    gps: formatGps(r.latitude, r.longitude),
    date: dateText ?? '',
  }
}

/**
 * 将 EXIF 模板中的 {key} 替换为实际值，缺失字段自动跳过，多个连续空白压缩。
 */
export function resolveExifTemplate(
  template: string,
  exifRaw: ExifRaw | null,
  model?: string,
  eq: { eqFocal?: boolean; cropFactor?: number } = {},
  dateText?: string,
): string {
  const map = buildExifFieldMap(exifRaw, model, eq, dateText)
  let out = template.replace(/\{(\w+)\}/g, (_, k: string) => map[k] ?? '')
  out = out.replace(/\s{2,}/g, ' ').replace(/\(\s*\)/g, '').trim()
  return out
}

// ===== 元素尺寸测量（设计 px，基准，未乘 scale） =====
export interface ElementBox {
  width: number
  height: number
}

/** 测量单个 info 元素在基准（scale=1, transform 不计入）下的包围盒尺寸（设计 px） */
export function measureElement(
  el: InfoElement,
  logoCanvas?: HTMLCanvasElement | null,
): ElementBox {
  switch (el.type) {
    case 'divider':
      return { width: el.width, height: el.thickness }
    case 'sprocket':
      return { width: el.width, height: Math.max(el.holeSize, el.thickness) }
    case 'logo': {
      const c = logoCanvas
      if (!c || c.width <= 1) return { width: el.baseWidth, height: el.baseWidth * 0.4 }
      const ratio = c.height / c.width
      return { width: el.baseWidth, height: el.baseWidth * ratio }
    }
    case 'text': {
      // 粗略测量：基于字符数与字号，渲染期会以实际 ctx.measureText 为准
      const fs = el.fontSize
      const lines = (el.text || ' ').split('\n')
      const width = Math.max(...lines.map((l) => l.length * fs * 0.6))
      const height = lines.length * fs * (el.lineHeight || 1.2)
      return { width: Math.max(width, 10), height: Math.max(height, fs) }
    }
    case 'exif': {
      const fs = el.fontSize
      return { width: el.template.length * fs * 0.6, height: fs * (el.lineHeight || 1.2) }
    }
  }
}

// ===== 绘制 =====
/**
 * 在 ctx 中按 zIndex 升序绘制全部导出元素。
 * @param ctx 已应用画布缩放（unitScale）的 2D 上下文（像素空间）
 * @param layer info 层配置
 * @param opts.exifRaw EXIF 原始字段
 * @param opts.model 相机机型（用于 {model}）
 * @param opts.outerMatrix 可选：bindTarget=photo 时传入照片变换矩阵（设计 px 空间，未含 unitScale）
 * @param opts.canvasCenter 可选：画布中心（设计 px）。默认 (600, 600)，非 1200 高容器需显式传入
 * @param opts.canvasH 可选：画布总高（设计 px）。anchorY='top'/'bottom' 边缘锚点定位需要；
 *        未提供时边缘锚点回退为中线（兼容未传尺寸的旧调用）
 * @param opts.canvasW 可选：画布总宽（设计 px，含边框与背景扩展）。anchorX 边缘锚点定位基准
 * @param opts.contentInset 可选：内容区在画布中的内缩（设计 px = padding + bgExpand）。
 *        anchorX='left'/'right' 以照片（内容区）左右缘为锚；缺省 0（全幅模板两者重合）
 * @param opts.unitScale 设计 px → 像素 的缩放（用于 logo/文字以像素尺寸绘制）。默认 1
 * @param opts.dateText 拍摄日期文本（{date} 模板字段）
 * @param opts.forPreview 预览模式 …（见下） */
export function drawInfoLayer(
  ctx: CanvasRenderingContext2D,
  layer: InfoLayerConfig,
  opts: {
    exifRaw?: ExifRaw | null
    model?: string
    /** 等效焦距显示开关（{focal} 模板字段） */
    eqFocal?: boolean
    /** 手动画幅系数（0=自动用 EXIF 35mm 字段） */
    cropFactor?: number
    /** 照片变换矩阵（设计 px 空间，未含 unitScale）。bindTarget=photo 时传入。 */
    outerMatrix?: DOMMatrix
    /** 画布中心（设计 px），默认 (600, 600) */
    canvasCenter?: { x: number; y: number }
    /** 画布总高（设计 px）：anchorY 边缘锚点定位基准 */
    canvasH?: number
    /** 画布总宽（设计 px）：anchorX 边缘锚点定位基准 */
    canvasW?: number
    /** 内容区内缩（设计 px）：anchorX 左右缘锚点基准 */
    contentInset?: number
    /** 设计 px → 像素 缩放，默认 1 */
    unitScale?: number
    /** 拍摄日期文本（{date} 模板字段） */
    dateText?: string
    /** 预览模式（审查报告 R9）：绘制全部 enable 元素（含 exportable=false 的“仅预览”元素）；
     *  导出模式仍仅绘制 exportable=true 的元素 */
    forPreview?: boolean
    /** 字标元素着色（logoId 为品牌时使用）：调用方按底色明暗传入（logoAutoColor）。
     *  缺省 undefined → useLogoStore 内部按默认色（白）取色——浅底模板上会「白字标压白底」不可见，
     *  故导出/预览两端都必须传。 */
    logoColor?: string
    /** 当前品牌 id（sony/canon/…）：logoId === 'brand' 的元素解析成它。
     *  types.ts 里 'brand' 是「跟随当前品牌」的约定值，但 useLogoStore 只认具体品牌 id——
     *  不传时 'brand' 会被当成品牌 id 去找 SVG，找不到就退化成把「brand」这个词画出来。 */
    brand?: string
  } = {},
): void {
  if (!layer.enabled) return
  const sorted = [...layer.elements]
    .filter((e) => e.enable && (opts.forPreview || e.exportable))
    .sort((a, b) => a.zIndex - b.zIndex)
  const s = opts.unitScale ?? 1

  // 画布中心（设计 px）
  const cx = opts.canvasCenter?.x ?? DESIGN_CX
  const cy = opts.canvasCenter?.y ?? DESIGN_CX

  for (const el of sorted) {
    ctx.save()
    // 外层容器变换（画布中心 → 可选 photo 矩阵）；canvas 绑定支持边缘锚点：
    // 元素原点 = 锚点边 + el.x/el.y 偏移（left/top 正向右/下，right/bottom 用负值向内收），
    // 报头行 / 底部签名条在画布尺寸变化时仍贴边。photo 绑定不响应锚点（几何跟随照片变换）。
    if (opts.outerMatrix && layer.bindTarget === 'photo') {
      ctx.transform(opts.outerMatrix.a, opts.outerMatrix.b, opts.outerMatrix.c, opts.outerMatrix.d, opts.outerMatrix.e, opts.outerMatrix.f)
    } else {
      // 垂直锚点：canvasH 为画布设计总高（cy 恒为其真实半高）；
      // 水平锚点：canvasW - contentInset*2 = 内容区宽（DESIGN_CONTAINER），锚照片左右缘。
      // center 锚沿用 canvasCenter（与既有元素语义完全一致，不引入行为变化）
      const halfH = opts.canvasH != null && opts.canvasH > 0 ? opts.canvasH / 2 : null
      const baseX = el.anchorX === 'left' && opts.canvasW != null
        ? (opts.contentInset ?? 0)
        : el.anchorX === 'right' && opts.canvasW != null
          ? opts.canvasW - (opts.contentInset ?? 0)
          : cx
      const baseY = el.anchorY === 'top' && halfH != null
        ? cy - halfH
        : el.anchorY === 'bottom' && halfH != null
          ? cy + halfH
          : cy
      ctx.translate(baseX, baseY)
    }
    // 元素自身：平移 → 旋转 → 缩放（design px → 像素）
    ctx.translate(el.x, el.y)
    if (el.rotate) ctx.rotate((el.rotate * Math.PI) / 180)
    ctx.scale(el.scale * s, el.scale * s)
    ctx.globalAlpha = el.opacity

    drawElementContent(ctx, el, opts)
    ctx.restore()
  }
}

/** 绘制单个元素内容（含自身局部坐标，已位于元素中心原点） */
function drawElementContent(
  ctx: CanvasRenderingContext2D,
  el: InfoElement,
  opts: {
    exifRaw?: ExifRaw | null
    model?: string
    eqFocal?: boolean
    cropFactor?: number
    dateText?: string
    logoColor?: string
    brand?: string
  },
): void {
  switch (el.type) {
    case 'divider': {
      // 线体对齐点跟随水平锚点（与文字 align 语义一致）：
      // left = 原点为线左缘、right = 原点为线右缘、缺省 center = 线中心在原点（向后兼容）
      const x0 = el.anchorX === 'left' ? 0 : el.anchorX === 'right' ? -el.width : -el.width / 2
      ctx.fillStyle = el.color
      ctx.fillRect(x0, -el.thickness / 2, el.width, el.thickness)
      break
    }
    case 'sprocket': {
      // 齿孔线（票根/胶片撕线）：一排冲孔沿宽度均布 + 中间一道横线；水平锚点同 divider
      const x0 = el.anchorX === 'left' ? 0 : el.anchorX === 'right' ? -el.width : -el.width / 2
      const cy = 0
      ctx.fillStyle = el.color
      ctx.fillRect(x0, cy - el.thickness / 2, el.width, el.thickness)
      const r = Math.max(0.5, el.holeSize / 2)
      const pitch = r * 2.4
      const n = Math.max(2, Math.floor(el.width / pitch))
      const step = el.width / n
      for (let i = 0; i < n; i++) {
        ctx.beginPath()
        ctx.arc(x0 + step * (i + 0.5), cy, r, 0, Math.PI * 2)
        ctx.fill()
      }
      break
    }
    case 'logo': {
      const id = logoElementId(el.logoId, opts.brand)
      if (!id) break
      const c = resolveLogo(id, opts.logoColor)
      if (c && c.width > 1) {
        const ratio = c.height / c.width
        const h = el.baseWidth * ratio
        ctx.drawImage(c, -el.baseWidth / 2, -h / 2, el.baseWidth, h)
      }
      break
    }
    case 'text': {
      drawText(ctx, el.text, el.fontFamily, el.fontSize, el.fontWeight, el.color, el.align, el.letterSpacing, el.lineHeight, el.shadow)
      break
    }
    case 'exif': {
      const text = resolveExifTemplate(el.template, opts.exifRaw || null, opts.model, {
        eqFocal: opts.eqFocal,
        cropFactor: opts.cropFactor,
      }, opts.dateText)
      drawText(ctx, text, el.fontFamily, el.fontSize, el.fontWeight, el.color, el.align, el.letterSpacing, el.lineHeight, el.shadow)
      break
    }
  }
}

/** 文本绘制（基准字号，原点 = 文本盒对齐点：align=left → 盒左缘在原点 / right → 盒右缘在原点 /
 *  center → 盒中心在原点。配合边缘锚点可实现「贴左缘起排」「贴右缘收排」；shadow = 压字投影） */
function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  fontFamily: string,
  fontSize: number,
  fontWeight: number,
  color: string,
  align: 'left' | 'center' | 'right',
  letterSpacing: number,
  lineHeight: number,
  shadow = false,
): void {
  if (!text) return
  if (shadow) {
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'
    ctx.shadowBlur = 4
    ctx.shadowOffsetY = 1
  }
  ctx.fillStyle = color
  ctx.textBaseline = 'middle'
  ctx.textAlign = align
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`
  const lines = text.split('\n')
  const lh = fontSize * (lineHeight || 1.2)
  // 原点即对齐点：left/right 起笔于 0（配合 textAlign 向右/向左延展），center 居中
  const startY = -((lines.length - 1) * lh) / 2
  lines.forEach((line, i) => {
    const y = startY + i * lh
    drawSpacedText(ctx, line, 0, y, align, letterSpacing)
  })
}

function measureLineWidth(ctx: CanvasRenderingContext2D, line: string, letterSpacing: number): number {
  if (letterSpacing <= 0) return ctx.measureText(line).width
  let w = 0
  for (const ch of line) w += ctx.measureText(ch).width + letterSpacing
  return w
}

function drawSpacedText(
  ctx: CanvasRenderingContext2D,
  line: string,
  x: number,
  y: number,
  align: 'left' | 'center' | 'right',
  letterSpacing: number,
): void {
  if (letterSpacing <= 0) {
    ctx.fillText(line, x, y)
    return
  }
  // 计算起点：align 决定整行相对原点位置
  const total = measureLineWidth(ctx, line, letterSpacing)
  let cursor =
    align === 'left' ? x : align === 'right' ? x - total : x - total / 2
  ctx.textAlign = 'left'
  for (const ch of line) {
    ctx.fillText(ch, cursor, y)
    cursor += ctx.measureText(ch).width + letterSpacing
  }
  ctx.textAlign = align
}

/** 导出前预载所有内置品牌 Logo，确保拿到完整画布而非占位（color 必须与绘制时一致，否则缓存落空） */
export async function preloadInfoLogos(layer: InfoLayerConfig, color?: string, brand?: string): Promise<void> {
  const ids = layer.elements
    .filter((e) => e.type === 'logo')
    .map((e) => logoElementId((e as any).logoId as string, brand))
    .filter((id): id is string => !!id)
  await Promise.all(ids.map((id) => preloadBrandLogo(id, color)))
}

/** 字标元素 id 解析：'brand' = 跟随当前品牌；'none'/空 = 不绘制；其余（含 custom:）= 原样 */
export function logoElementId(logoId: string, brand?: string): string | undefined {
  if (!logoId || logoId === 'none') return undefined
  if (logoId === 'brand') return brand && brand !== '自定义' ? brand : undefined
  return logoId
}
