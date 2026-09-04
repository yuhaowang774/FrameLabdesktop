// 模板缩略图：由模板配置程序化生成 SVG 示意图（无需真实照片即可预览样式）。
//
// 一致性保证：
// - 画布几何与 core/exporter.ts 同源（padding / borderRatio / bgExpand / bgBottomRatio / scale / frameRatio）；
// - duo / inline 的 INFO 排版直接复用 core/infoLayout 的共享计算（预览与导出同一函数）；
// - 文字颜色复用 core/colorUtils 的明暗自适应规则。
// 因此缩略图的留白比例、圆角、信息区排布与真实成片一致，仅把照片替换为示意渐变。
import type { FrameConfig } from './types'
import { defaultFrameConfig } from './types'
import { DESIGN_CONTAINER } from './constants'
import { computeFooterLayout, computeMagazineLayout, magazineTitleFontSize, measureTextWidth, MAG_SUB_SIZE, MAG_SWATCH_COUNT, MAG_SWATCH_W, MAG_SWATCH_H, CLASSIC_SIDE_INSET, CLASSIC_ROW_GAP, LENS_LINE_GAP } from './infoLayout'
import { footerTextColor, logoAutoColor } from './colorUtils'
import { exportFrame } from './exporter'
import { FALLBACK_PALETTE } from './photoPalette'

/** 示意文本：让 INFO 按真实字宽排版（模板本身不保存 EXIF 文本） */
const DEMO = {
  exif: '50mm f/1.8 1/200s ISO400',
  date: '2026.08.30',
  model: 'ILCE-7RM5',
  lens: 'FE 50mm F1.8',
}

/** 示意照片宽高比（3:2） */
const DEMO_ASPECT = 3 / 2
/** 无真实 Logo 时的兜底宽高比（与 FooterInfo 一致） */
const FALLBACK_LOGO_RATIO = 2.6
/** 文字墨迹高度占字号的比例（示意条高度） */
const INK_RATIO = 0.66
/** 字宽测量的兜底系数（jsdom 等无真实 measureText 环境） */
const FALLBACK_CHAR_RATIO = 0.52

let uid = 0

export interface ThumbOptions {
  /** Logo 宽高比（w/h）；缺省用 2.6 兜底 */
  logoRatio?: number
}

/** 保留两位小数，避免 SVG 属性出现长浮点 */
function r2(v: number): number {
  return Math.round(v * 100) / 100
}

/** 运行环境是否支持 canvas 文字测量（仅探测一次，避免无 canvas 环境反复报错） */
let measureAvailable: boolean | null = null

/** 文本宽度：无真实测量环境时按字符数估算，保证缩略图始终有内容 */
function textWidth(text: string, font: string, size: number): number {
  if (measureAvailable === null) {
    try {
      measureAvailable = !!document.createElement('canvas').getContext('2d')
    } catch {
      measureAvailable = false
    }
  }
  const w = measureAvailable ? measureTextWidth(text, font) : 0
  return w > 0 ? w : text.length * size * FALLBACK_CHAR_RATIO
}

/** 生成模板缩略图的 SVG 源码 */
export function templateThumbSvg(config: Partial<FrameConfig>, opts: ThumbOptions = {}): string {
  const c: FrameConfig = { ...defaultFrameConfig, ...config }
  const gid = `tt${++uid}`
  const logoRatio = opts.logoRatio && opts.logoRatio > 0 ? opts.logoRatio : FALLBACK_LOGO_RATIO

  // ===== 画布几何（设计 px，与 exporter.ts 同源）=====
  const pad = Math.max(0, c.padding)
  const padBottom = pad + Math.max(0, c.borderRatio)
  const bgExpand = Math.max(0, c.bgExpand || 0)
  const bgBottomExpand = bgExpand + Math.max(0, c.bgBottomRatio || 0)

  const photoW = (DESIGN_CONTAINER * c.scale) / 100
  const photoH = photoW / DEMO_ASPECT
  const contentH = c.frameRatio ? DESIGN_CONTAINER / c.frameRatio : photoH

  const canvasW = DESIGN_CONTAINER + 2 * bgExpand + 2 * pad
  const canvasH = contentH + pad + padBottom + bgExpand + bgBottomExpand

  const photoX = pad + bgExpand + (DESIGN_CONTAINER - photoW) / 2
  const photoY = pad + bgExpand + (c.frameRatio ? (contentH - photoH) / 2 : 0)

  const innerW = canvasW - 2 * pad
  const innerH = canvasH - pad - padBottom

  const noFrame = pad <= 0 && bgExpand <= 0
  const outerR = Math.max(0, noFrame ? c.photoRadius : c.borderRadius)
  const innerR = Math.max(0, noFrame ? c.photoRadius : c.borderRadius - pad)
  const photoR = Math.max(0, Math.min(c.photoRadius, Math.min(photoW, photoH) / 2))

  // ===== 颜色 =====
  const text = footerTextColor(c.bgMode, c.bgColor, 0.95)
  // Logo 着色复用与导出端同一解析（'auto' → 浅底黑 / 深底白）
  const logoFill = logoAutoColor(c.logoColor, c.bgMode, c.bgColor)
  const shadowOpacity = r2(Math.max(0, Math.min(1, c.shadow)) * 0.5)

  // ===== INFO 示意元素 =====
  const ink = (size: number) => Math.max(1, size * INK_RATIO)
  const bar = (x: number, y: number, size: number, w: number, opacity: number, color: string) =>
    w <= 0
      ? ''
      : `<rect x="${r2(x)}" y="${r2(y + size / 2 - ink(size) / 2)}" width="${r2(w)}" height="${r2(ink(size))}" rx="${r2(ink(size) / 2)}" fill="${color}" opacity="${r2(opacity)}"/>`

  const exifFontStr = `${c.textWeight} ${c.fontSize}px ${c.fontFamily}`
  const modelFontStr = `${c.cameraModelItalic ? 'italic ' : ''}${c.cameraModelWeight} ${c.cameraModelSize}px ${c.cameraModelFont}`

  const exifW = textWidth(DEMO.exif, exifFontStr, c.fontSize)
  const dateW = textWidth(DEMO.date, modelFontStr, c.cameraModelSize)
  const modelW = textWidth(DEMO.model, modelFontStr, c.cameraModelSize)
  const lensW = textWidth(DEMO.lens, exifFontStr, c.fontSize)
  const logoW = c.logoSize * logoRatio

  let info = ''
  if (c.infoLayout === 'duo' || c.infoLayout === 'inline') {
    // duo / inline：直接复用预览与导出共用的默认排版
    const layout = computeFooterLayout(
      { ...c, exifText: DEMO.exif, dateText: DEMO.date, cameraModel: DEMO.model, lensText: DEMO.lens },
      canvasH - pad - bgExpand,
      logoRatio,
    )
    if (c.showExif) info += bar(layout.exif.x, layout.exif.y, c.fontSize, exifW, c.textOpacity, text)
    if (c.showDate) info += bar(layout.date.x, layout.date.y, c.cameraModelSize, dateW, c.cameraModelOpacity, text)
    if (c.showCameraModel) info += bar(layout.model.x, layout.model.y, c.cameraModelSize, modelW, c.cameraModelOpacity, text)
    if (c.showLens) info += bar(layout.lens.x, layout.lens.y, c.fontSize, lensW, c.textOpacity, text)
    if (c.showLogo) {
      info += `<rect x="${r2(layout.logo.x)}" y="${r2(layout.logo.y)}" width="${r2(logoW)}" height="${r2(c.logoSize)}" rx="${r2(c.logoSize * 0.12)}" fill="${logoFill}" opacity="${r2(c.logoOpacity)}"/>`
    }
    if (layout.divider) {
      info += `<rect x="${r2(layout.divider.x)}" y="${r2(layout.divider.y)}" width="${r2(Math.max(1, c.fontSize * 0.06))}" height="${r2(layout.divider.h)}" fill="${text}" opacity="0.28"/>`
    }
  } else if (c.infoLayout === 'magazine') {
    // magazine：顶部标题区 + 底部左取色色卡 / 右机型+参数+日期（与 computeMagazineLayout 同源）
    const layout = computeMagazineLayout(
      { ...c, exifText: DEMO.exif, dateText: DEMO.date, cameraModel: DEMO.model, lensText: DEMO.lens },
      canvasH - pad - bgExpand,
    )
    const titleText = c.infoTitle || ''
    const subText = c.showDate ? `PHOTOGRAPHED IN : ${DEMO.date}` : ''
    const titleSize = magazineTitleFontSize(c)
    const titleW = titleText ? textWidth(titleText, `700 ${titleSize}px ${c.fontFamily}`, titleSize) : 0
    const subW = subText ? textWidth(subText, `500 ${MAG_SUB_SIZE}px ${c.fontFamily}`, MAG_SUB_SIZE) : 0
    if (titleText) info += bar(layout.title.x, layout.title.y, titleSize, titleW, 0.95, text)
    if (subText) info += bar(layout.subtitle.x, layout.subtitle.y, MAG_SUB_SIZE, subW, 0.55, text)
    if (c.showPalette) {
      for (let i = 0; i < MAG_SWATCH_COUNT; i++) {
        info += `<rect x="${r2(layout.palette.x + i * MAG_SWATCH_W)}" y="${r2(layout.palette.y)}" width="${r2(MAG_SWATCH_W)}" height="${r2(MAG_SWATCH_H)}" fill="${FALLBACK_PALETTE[i % FALLBACK_PALETTE.length]}"/>`
      }
    }
    if (c.showCameraModel) info += bar(layout.model.x - modelW, layout.model.y, c.cameraModelSize, modelW, c.cameraModelOpacity, text)
    if (c.showExif) info += bar(layout.exif.x - exifW, layout.exif.y, c.fontSize, exifW, c.textOpacity * 0.6, text)
  } else {
    // classic：与 computeClassicLayout 完全同构——自底向上 日期 → EXIF 块(含镜头行) → 型号 → Logo，
    // 只为显示行占位，行距 CLASSIC_ROW_GAP，镜头行以 LENS_LINE_GAP 附在参数行下；水平对齐跟随 overlayAlign
    // （center=行中心，left/right=缘内缩锚点，Logo 由渲染端按自身宽度平移，示意条直接按宽定位）。
    // 底锚（画布坐标）：canvasBottom(调用方传 H - pad - bgExpand，本函数再 + pad 还原画布系) - overlayBottom
    //  → 画布 bottom = canvasH - bgExpand - overlayBottom（与测试/预览/导出三方对齐，勿多减 pad）
    const bottom = canvasH - bgExpand - c.overlayBottom
    const exifSize = c.exifFontSize ?? c.fontSize
    const lensSize = c.lensFontSize ?? c.fontSize
    const dateSize = c.dateFontSize ?? c.fontSize
    const exifBlockH = c.showLens && c.lensText ? exifSize + LENS_LINE_GAP + lensSize : exifSize
    const alignX = (w: number) => {
      const x0 = pad + bgExpand
      if (c.overlayAlign === 'left') return x0 + CLASSIC_SIDE_INSET
      if (c.overlayAlign === 'right') return x0 + DESIGN_CONTAINER - w - CLASSIC_SIDE_INSET
      return x0 + (DESIGN_CONTAINER - w) / 2
    }
    type Row = { h: number; draw: (top: number) => string }
    const rows: Row[] = []
    if (c.showDate) rows.push({ h: dateSize, draw: (y) => bar(alignX(dateW), y, dateSize, dateW, c.dateTextOpacity ?? c.textOpacity, text) })
    if (c.showExif) {
      rows.push({
        h: exifBlockH,
        draw: (y) => {
          let s = bar(alignX(exifW), y, exifSize, exifW, c.textOpacity, text)
          if (c.showLens) s += bar(alignX(lensW), y + exifSize + LENS_LINE_GAP, lensSize, lensW, c.textOpacity, text)
          return s
        },
      })
    }
    if (c.showCameraModel) rows.push({ h: c.cameraModelSize, draw: (y) => bar(alignX(modelW), y, c.cameraModelSize, modelW, c.cameraModelOpacity, text) })
    if (c.showLogo) {
      rows.push({
        h: c.logoSize,
        draw: (y) =>
          `<rect x="${r2(alignX(logoW))}" y="${r2(y)}" width="${r2(logoW)}" height="${r2(c.logoSize)}" rx="${r2(c.logoSize * 0.12)}" fill="${logoFill}" opacity="${r2(c.logoOpacity)}"/>`,
      })
    }
    let y = bottom
    for (let i = 0; i < rows.length; i++) {
      info += rows[i].draw(y - rows[i].h)
      y -= rows[i].h + CLASSIC_ROW_GAP
    }
  }

  // ===== 图层绘制（与 exporter 同序：画板 → 边框 → 背景 → 照片 → INFO）=====
  // 示意照片：天空渐变 + 一枚暖色太阳，让缩略图有"照片感"，与模糊背景拉开层次
  const photoFill = `url(#${gid}p)`
  const blurPx = Math.max(0, c.blur)

  const bgInner =
    c.bgMode === 'solid'
      ? `<rect x="${r2(pad)}" y="${r2(pad)}" width="${r2(innerW)}" height="${r2(innerH)}" fill="${c.bgColor}"/>`
      : `<g clip-path="url(#${gid}c)"><rect x="${r2(pad - blurPx * 3)}" y="${r2(pad - blurPx * 3)}" width="${r2(innerW + blurPx * 6)}" height="${r2(innerH + blurPx * 6)}" fill="${photoFill}" filter="url(#${gid}b)"/></g>`

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${r2(canvasW)} ${r2(canvasH)}" preserveAspectRatio="xMidYMid meet">`
    + `<defs>`
    + `<linearGradient id="${gid}p" x1="0" y1="0" x2="0.2" y2="1">`
    + `<stop offset="0" stop-color="#93a7bc"/><stop offset="0.58" stop-color="#5f6f81"/><stop offset="0.6" stop-color="#414c59"/><stop offset="1" stop-color="#2c343e"/>`
    + `</linearGradient>`
    + `<filter id="${gid}b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${r2(blurPx)}"/></filter>`
    + `<filter id="${gid}s" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="${r2(c.shadow * 6)}" stdDeviation="${r2(c.shadow * 5)}" flood-color="#000000" flood-opacity="${shadowOpacity}"/></filter>`
    + `<clipPath id="${gid}c"><rect x="${r2(pad)}" y="${r2(pad)}" width="${r2(innerW)}" height="${r2(innerH)}" rx="${r2(innerR)}"/></clipPath>`
    + `<clipPath id="${gid}pc"><rect x="${r2(photoX)}" y="${r2(photoY)}" width="${r2(photoW)}" height="${r2(photoH)}" rx="${r2(photoR)}"/></clipPath>`
    + `</defs>`
    // 0) 画板（边框色兜底）
    + `<rect x="0" y="0" width="${r2(canvasW)}" height="${r2(canvasH)}" rx="${r2(outerR)}" fill="${c.borderColor}"/>`
    // 2) 背景层
    + bgInner
    // 3) 照片层（含阴影与示意内容）
    + `<g filter="${c.shadow > 0 ? `url(#${gid}s)` : 'none'}">`
    + `<rect x="${r2(photoX)}" y="${r2(photoY)}" width="${r2(photoW)}" height="${r2(photoH)}" rx="${r2(photoR)}" fill="${photoFill}"/>`
    + `<g clip-path="url(#${gid}pc)"><circle cx="${r2(photoX + photoW * 0.72)}" cy="${r2(photoY + photoH * 0.34)}" r="${r2(photoW * 0.075)}" fill="#f4e6c8" opacity="0.8"/></g>`
    + `</g>`
    // 4) INFO 层
    + info
    + `</svg>`
}

/** 生成可直接用于 <img src> 的 dataURL */
export function templateThumbDataUrl(config: Partial<FrameConfig>, opts: ThumbOptions = {}): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(templateThumbSvg(config, opts))}`
}

// ===== 真实照片渲染版缩略图（更美观，用于运行时浏览器环境）=====

// 内置示例照片为可选资源（网页部署精简包可能不含此文件）：
// 用 import.meta.glob 声明式可选引用，资源缺失时不参与构建，运行时自动降级为程序化 SVG
const demoImageMods = import.meta.glob<string>('../assets/template-demo.jpg', {
  eager: true,
  import: 'default',
})
const DEMO_IMAGE_URL = demoImageMods['../assets/template-demo.jpg'] ?? ''
// 底图降采样上限：缩略图实际显示宽度约 200~400px，1280 已足够清晰（3 倍以上超采样），
// 同时明显降低首次渲染的解码与合成开销
const DEMO_MAX_LONG_EDGE = 1280
const DEMO_JPG_QUALITY = 0.88

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const im = new Image()
    im.onload = () => resolve(im)
    im.onerror = () => reject(new Error(`缩略图底图加载失败: ${src}`))
    im.src = src
  })
}

function downscaleImage(img: HTMLImageElement, maxLongEdge: number): HTMLCanvasElement {
  const long = Math.max(img.naturalWidth, img.naturalHeight)
  const scale = Math.min(1, maxLongEdge / long)
  const w = Math.round(img.naturalWidth * scale)
  const h = Math.round(img.naturalHeight * scale)
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  if (ctx) ctx.drawImage(img, 0, 0, w, h)
  return c
}

/** 大预览 INFO 覆盖：传入当前照片真实信息，替换示意文本（缺省走 DEMO 示意） */
export interface ThumbInfoOverride {
  exifText?: string
  dateText?: string
  cameraModel?: string
  lensText?: string
  brand?: string
}

export function buildDemoConfig(config: Partial<FrameConfig>, info?: ThumbInfoOverride): FrameConfig {
  return {
    ...defaultFrameConfig,
    ...config,
    exifText: info?.exifText ?? DEMO.exif,
    dateText: info?.dateText ?? DEMO.date,
    cameraModel: info?.cameraModel ?? DEMO.model,
    lensText: info?.lensText ?? DEMO.lens,
    brand: info?.brand ?? 'sony',
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('blob 转 dataURL 失败'))
    reader.readAsDataURL(blob)
  })
}

/**
 * 用真实照片渲染模板缩略图。
 * 流程：加载内置示例照片 → 必要时降采样 → 用 exporter 完整合成 → 返回 JPG dataURL。
 * info：大预览时传入当前照片的真实 INFO（exifText/dateText/cameraModel/lensText/brand），
 * 缺省时使用示意文本（网格小卡保持稳定统一）。渲染失败则降级为程序化 SVG。
 */
export async function renderTemplateThumbDataUrl(
  config: Partial<FrameConfig>,
  imageUrl: string = DEMO_IMAGE_URL,
  maxLongEdge: number = DEMO_MAX_LONG_EDGE,
  info?: ThumbInfoOverride,
): Promise<string> {
  try {
    const img = await loadImageElement(imageUrl)
    const source = img.naturalWidth > maxLongEdge || img.naturalHeight > maxLongEdge
      ? downscaleImage(img, maxLongEdge)
      : img
    const full = buildDemoConfig(config, info)
    const result = await exportFrame(source, full, { format: 'jpg', jpgQuality: DEMO_JPG_QUALITY })
    return await blobToDataUrl(result.blob)
  } catch (e) {
    console.warn('[templateThumb] 真实缩略图渲染失败，回退到 SVG:', e)
    return templateThumbDataUrl(config)
  }
}
