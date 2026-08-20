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
import type { InfoElement, InfoLayerConfig } from './types'

// 设计稿基准宽度（1200），画布中心 X 默认等于其一半
const DESIGN_CX = DESIGN_CONTAINER / 2

// ===== EXIF 模板解析 =====
// 复用 useExif 的格式化逻辑；此处内联一份轻量实现，避免引入 Vue 依赖。
function formatShutter(t: number): string {
  if (t >= 1) return `${Math.round(t)}s`
  return `1/${Math.round(1 / t)}s`
}
function formatFocal(mm?: number): string {
  if (mm == null) return ''
  return mm % 1 === 0 ? String(mm) : mm.toFixed(1) + 'mm'
}
function formatFNumber(f?: number): string {
  if (f == null) return ''
  return `f/${f}`
}
function formatIso(iso?: number): string {
  if (iso == null) return ''
  return `ISO${iso}`
}

/** 由 exifRaw 计算可用字段映射，供模板 {key} 替换 */
export function buildExifFieldMap(
  exifRaw: { focalLength?: number; fNumber?: number; exposureTime?: number; iso?: number } | null,
  model?: string,
): Record<string, string> {
  const r = exifRaw || {}
  return {
    focal: formatFocal(r.focalLength),
    aperture: formatFNumber(r.fNumber),
    shutter: r.exposureTime != null ? formatShutter(r.exposureTime) : '',
    iso: formatIso(r.iso),
    model: model || '',
  }
}

/**
 * 将 EXIF 模板中的 {key} 替换为实际值，缺失字段自动跳过，多个连续空白压缩。
 */
export function resolveExifTemplate(
  template: string,
  exifRaw: { focalLength?: number; fNumber?: number; exposureTime?: number; iso?: number } | null,
  model?: string,
): string {
  const map = buildExifFieldMap(exifRaw, model)
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
 * @param opts.unitScale 设计 px → 像素 的缩放（用于 logo/文字以像素尺寸绘制）。默认 1
 */
export function drawInfoLayer(
  ctx: CanvasRenderingContext2D,
  layer: InfoLayerConfig,
  opts: {
    exifRaw?: { focalLength?: number; fNumber?: number; exposureTime?: number; iso?: number } | null
    model?: string
    /** 照片变换矩阵（设计 px 空间，未含 unitScale）。bindTarget=photo 时传入。 */
    outerMatrix?: DOMMatrix
    /** 画布中心（设计 px），默认 (600, 600) */
    canvasCenter?: { x: number; y: number }
    /** 设计 px → 像素 缩放，默认 1 */
    unitScale?: number
  } = {},
): void {
  if (!layer.enabled) return
  const sorted = [...layer.elements].filter((e) => e.enable && e.exportable).sort((a, b) => a.zIndex - b.zIndex)
  const s = opts.unitScale ?? 1

  // 画布中心（设计 px）
  const cx = opts.canvasCenter?.x ?? DESIGN_CX
  const cy = opts.canvasCenter?.y ?? DESIGN_CX

  for (const el of sorted) {
    ctx.save()
    // 外层容器变换（画布中心 → 可选 photo 矩阵）
    if (opts.outerMatrix && layer.bindTarget === 'photo') {
      ctx.transform(opts.outerMatrix.a, opts.outerMatrix.b, opts.outerMatrix.c, opts.outerMatrix.d, opts.outerMatrix.e, opts.outerMatrix.f)
    } else {
      ctx.translate(cx, cy)
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
  opts: { exifRaw?: any; model?: string },
): void {
  switch (el.type) {
    case 'divider': {
      ctx.fillStyle = el.color
      ctx.fillRect(-el.width / 2, -el.thickness / 2, el.width, el.thickness)
      break
    }
    case 'logo': {
      const c = resolveLogo(el.logoId)
      if (c && c.width > 1) {
        const ratio = c.height / c.width
        const h = el.baseWidth * ratio
        ctx.drawImage(c, -el.baseWidth / 2, -h / 2, el.baseWidth, h)
      }
      break
    }
    case 'text': {
      drawText(ctx, el.text, el.fontFamily, el.fontSize, el.fontWeight, el.color, el.align, el.letterSpacing, el.lineHeight)
      break
    }
    case 'exif': {
      const text = resolveExifTemplate(el.template, opts.exifRaw || null, opts.model)
      drawText(ctx, text, el.fontFamily, el.fontSize, el.fontWeight, el.color, el.align, el.letterSpacing, el.lineHeight)
      break
    }
  }
}

/** 文本绘制（基准字号，原点在元素中心，align 控制水平对齐） */
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
): void {
  if (!text) return
  ctx.fillStyle = color
  ctx.textBaseline = 'middle'
  ctx.textAlign = align
  ctx.font = `${fontWeight} ${fontSize}px ${fontFamily}`
  const lines = text.split('\n')
  const lh = fontSize * (lineHeight || 1.2)
  // align=left 时以左缘为基准（原点在中心，故左缘 x=-width/2）；此处按 textAlign 处理，
  // 用 textAlign='left' 时 x 取包围盒左缘。为简单起见统一以中心对齐测量再偏移。
  const maxW = Math.max(...lines.map((l) => measureLineWidth(ctx, l, letterSpacing)))
  const startY = -((lines.length - 1) * lh) / 2
  lines.forEach((line, i) => {
    const y = startY + i * lh
    const x = align === 'center' ? 0 : align === 'right' ? maxW / 2 : -maxW / 2
    drawSpacedText(ctx, line, x, y, align, letterSpacing)
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

/** 导出前预载所有内置品牌 Logo，确保拿到完整画布而非占位 */
export async function preloadInfoLogos(layer: InfoLayerConfig): Promise<void> {
  const ids = layer.elements.filter((e) => e.type === 'logo').map((e) => (e as any).logoId as string)
  await Promise.all(ids.map((id) => preloadBrandLogo(id)))
}
