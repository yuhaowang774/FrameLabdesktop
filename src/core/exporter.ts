// 保真导出核心：纯 Canvas 手工合成（不用 dom-to-image）。
// - 主照片以原生像素 1:1 进入画布，其余装饰层按 unitScale 成比例放大，避免降采样。
// - 支持 PNG(无损) / JPG(高画质) 两种格式选项。
import type { FrameConfig } from './types'
import { drawBlurredBackground, drawVignette, drawGrain, drawWatermark, type ImgSource } from './bgRenderer'
import { resolveLogo, preloadBrandLogo } from '../composables/useLogoStore'
import { drawInfoLayer, preloadInfoLogos } from './infoRenderer'
import { buildSrgbICC, embedJpegICC } from './icc'
import { hexLuminance, hexToRgba, logoAutoColor, footerTextColor } from './colorUtils'
import { DESIGN_CONTAINER, phoneBrandOf } from './constants'
import {
  computeFooterLayout,
  computeClassicLayout,
  computeCardLayout,
  computeMagazineLayout,
  cardThemeColors,
  cardBadgeColors,
  exifTextStyle,
  lensTextStyle,
  dateTextStyle,
  modelTextStyle,
  CARD_RADIUS,
  CARD_BADGE_FONT_SIZE,
  LENS_LINE_GAP,
  MAG_SUB_SIZE,
  MAG_SUB_LETTER_SPACING,
  MAG_SWATCH_COUNT,
  MAG_SWATCH_W,
  MAG_SWATCH_H,
  type FooterLayout,
  type CardRect,
} from './infoLayout'
import { extractPalette, FALLBACK_PALETTE } from './photoPalette'
import { modelAlias } from './modelAlias'
import { rotatedSize, drawRotatedCropped } from './photoEdit'

export type ExportFormat = 'png' | 'jpg'

export interface ExportOptions {
  /** 导出格式：png=无损, jpg=高画质有损。默认 png */
  format?: ExportFormat
  /** JPG 画质 0~1，默认 0.95（仅在 format='jpg' 时生效） */
  jpgQuality?: number
  /** 超采样倍率：>1 让装饰层(文字/Logo/模糊)更锐利，照片本身已是原生分辨率。默认 1 */
  scale?: number
  /** bgMode='photo' 时传入的自定义背景图 */
  backgroundImage?: ImgSource
  /** 已解析的品牌/自定义 Logo 图（由 useLogoStore 提供，未提供则跳过 Logo 绘制） */
  logo?: ImgSource
}

export interface ExportResult {
  blob: Blob
  width: number
  height: number
  format: ExportFormat
}

/** 浏览器画布边长上限（Chrome 约 16384），超出 toBlob 会失败 */
const MAX_DIM = 16384

function sourceSize(img: ImgSource): { w: number; h: number } {
  if (img instanceof HTMLImageElement) return { w: img.naturalWidth, h: img.naturalHeight }
  if (img instanceof SVGImageElement) return { w: img.width.baseVal.value, h: img.height.baseVal.value }
  return { w: (img as HTMLCanvasElement | OffscreenCanvas).width, h: (img as HTMLCanvasElement | OffscreenCanvas).height }
}

/** 从 dataURL/src 加载图片（Promise） */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const im = new Image()
    im.onload = () => resolve(im)
    im.onerror = () => reject(new Error('水印图加载失败'))
    im.src = src
  })
}

function fontStr(weight: number, size: number, family: string, italic = false): string {
  return `${italic ? 'italic ' : ''}${weight} ${size}px ${family}`
}

/** 圆角矩形路径（不依赖 ctx.roundRect 的兼容实现，用于边框/照片圆角导出） */
function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

/** card 白底水印卡绘制（infoLayout='card'）：左列机型+日期 / 右列参数+镜头 / 右端联名标块 */
function drawCardFooter(
  ctx: CanvasRenderingContext2D,
  config: FrameConfig,
  unitScale: number,
  contentOX: number,
  canvasHpx: number,
): void {
  const ox = contentOX * unitScale
  const s = unitScale
  const canvasBottomY = canvasHpx / unitScale - config.padding - config.bgExpand
  const L = computeCardLayout(config, canvasBottomY)
  const theme = cardThemeColors(config.infoCardTheme)

  // 底色卡（圆角矩形）
  ctx.save()
  roundRectPath(ctx, ox + L.card.x * s, ox + L.card.y * s, L.card.w * s, L.card.h * s, CARD_RADIUS * s)
  ctx.fillStyle = theme.card
  ctx.fill()
  ctx.restore()

  const drawLine = (
    r: CardRect,
    text: string,
    color: string,
    weight: number,
    font: string,
    align: 'left' | 'right',
    italic = false,
  ): void => {
    if (!text) return
    ctx.save()
    ctx.fillStyle = color
    ctx.font = fontStr(weight, r.h * s, font, italic)
    ctx.textAlign = align
    ctx.textBaseline = 'top'
    ctx.fillText(text, ox + r.x * s, ox + r.y * s)
    ctx.restore()
  }

  // 左列：机型（主色，营销名映射与预览一致）/ 日期（次色）
  if (config.showCameraModel && config.cameraModel) {
    drawLine(L.model, modelAlias(config.cameraModel), theme.primary, config.cameraModelWeight, config.cameraModelFont, 'left', config.cameraModelItalic)
  }
  if (L.date && config.dateText) {
    const dateS = dateTextStyle(config)
    drawLine(L.date, config.dateText, theme.secondary, dateS.weight, dateS.font, 'left')
  }
  // 右列：参数（主色）/ 镜头（次色），右对齐
  if (config.showExif && config.exifText) {
    const exifS = exifTextStyle(config)
    drawLine(L.exif, config.exifText, theme.primary, exifS.weight, exifS.font, 'right')
  }
  if (L.lens && config.lensText) {
    const lensS = lensTextStyle(config)
    drawLine(L.lens, config.lensText, theme.secondary, lensS.weight, lensS.font, 'right')
  }

  // 标块：品牌色圆角小块 + 文字居中（仅手机品牌且有联名文字时）
  if (L.badge) {
    const phone = phoneBrandOf(config.brand)
    if (phone?.badge.text) {
      const b = L.badge
      const colors = cardBadgeColors(config.cardBadgeBg, config.cardBadgeFg, config.brand)
      ctx.save()
      roundRectPath(ctx, ox + b.x * s, ox + b.y * s, b.w * s, b.h * s, 4 * s)
      ctx.fillStyle = colors.bg
      ctx.fill()
      ctx.restore()
      ctx.save()
      ctx.fillStyle = colors.fg
      ctx.font = `600 ${CARD_BADGE_FONT_SIZE * s}px ${config.fontFamily}`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(phone.badge.text, ox + (b.x + b.w / 2) * s, ox + (b.y + b.h / 2) * s)
      ctx.restore()
    }
  }
}

/** magazine 杂志编辑布局绘制（infoLayout='magazine'）：顶部标题区 + 底部左取色色卡 / 右机型+参数+日期 */
function drawMagazineFooter(
  ctx: CanvasRenderingContext2D,
  config: FrameConfig,
  unitScale: number,
  contentOX: number,
  canvasHpx: number,
  palette: string[],
): void {
  const ox = contentOX * unitScale
  const s = unitScale
  const canvasBottomY = canvasHpx / unitScale - config.padding - config.bgExpand
  const L = computeMagazineLayout(config, canvasBottomY)
  const primary = footerTextColor(config.bgMode, config.bgColor, 0.95)
  const secondary = footerTextColor(config.bgMode, config.bgColor, 0.55)
  const canvasCtx = ctx as CanvasRenderingContext2D & { letterSpacing?: string }

  const drawText = (
    x: number,
    y: number,
    text: string,
    size: number,
    color: string,
    weight: number,
    font: string,
    letterSpacing = 0,
    align: CanvasTextAlign = 'left',
  ): void => {
    if (!text) return
    ctx.save()
    ctx.fillStyle = color
    ctx.font = fontStr(weight, size * s, font)
    ctx.textAlign = align
    ctx.textBaseline = 'top'
    if (letterSpacing > 0) canvasCtx.letterSpacing = `${letterSpacing * s}px`
    ctx.fillText(text, ox + x * s, ox + y * s)
    ctx.restore()
  }

  // 顶部标题区（上边留白内）：大标题（长标题自适应缩小）+ "PHOTOGRAPHED IN : 日期" 副标题
  drawText(L.title.x, L.title.y, config.infoTitle, L.titleSize, primary, 700, config.fontFamily)
  if (config.showDate && config.dateText) {
    drawText(L.subtitle.x, L.subtitle.y, `PHOTOGRAPHED IN : ${config.dateText}`, MAG_SUB_SIZE, secondary, 500, config.fontFamily, MAG_SUB_LETTER_SPACING)
  }

  // 底部左侧取色色卡（showPalette 关闭时不绘制，与预览一致）
  if (config.showPalette) {
    for (let i = 0; i < MAG_SWATCH_COUNT; i++) {
      ctx.save()
      ctx.fillStyle = palette[i % palette.length]
      ctx.fillRect(
        ox + (L.palette.x + i * MAG_SWATCH_W) * s,
        ox + L.palette.y * s,
        MAG_SWATCH_W * s,
        MAG_SWATCH_H * s,
      )
      ctx.restore()
    }
  }

  // 底部右侧信息块（右缘锚点 + 右对齐，不依赖测宽）：机型（大）/ 参数（日期已在副标题，不重复）
  const modelS = modelTextStyle(config)
  const exifS = exifTextStyle(config)
  if (config.showCameraModel && config.cameraModel) {
    drawText(L.model.x, L.model.y, modelAlias(config.cameraModel), modelS.size, primary, modelS.weight, modelS.font, 0, 'right')
  }
  if (config.showExif && config.exifText) {
    drawText(L.exif.x, L.exif.y, config.exifText, exifS.size, secondary, exifS.weight, exifS.font, 0, 'right')
  }
}

async function drawFooter(
  ctx: CanvasRenderingContext2D,
  config: FrameConfig,
  unitScale: number,
  logo: ImgSource | undefined,
  contentOX: number,
  canvasHpx: number,
  magazinePalette: string[] = FALLBACK_PALETTE,
): Promise<void> {
  // card 白底水印卡：独立绘制路径（左右列 + 标块，配色随 infoCardTheme）
  if (config.infoLayout === 'card') {
    drawCardFooter(ctx, config, unitScale, contentOX, canvasHpx)
    return
  }
  // magazine 杂志编辑：顶部标题区 + 取色色卡 + 右侧信息块
  if (config.infoLayout === 'magazine') {
    drawMagazineFooter(ctx, config, unitScale, contentOX, canvasHpx, magazinePalette)
    return
  }
  const themeColor = config.bgMode === 'solid' && hexLuminance(config.bgColor) > 0.6 ? 0 : 255
  const logoH = config.logoSize * unitScale
  const modelH = config.cameraModelSize * unitScale
  // EXIF / 镜头 / 日期 独立文本样式（缺省跟随整体 INFO 样式 fontSize/fontFamily/textWeight/textOpacity）
  const exifSize = config.exifFontSize ?? config.fontSize
  const exifH = exifSize * unitScale
  const exifFont = config.exifFontFamily ?? config.fontFamily
  const exifWeight = config.exifTextWeight ?? config.textWeight
  const exifOpacity = config.exifTextOpacity ?? config.textOpacity
  const lensSize = config.lensFontSize ?? config.fontSize
  const lensH = lensSize * unitScale
  const lensFont = config.lensFontFamily ?? config.fontFamily
  const lensWeight = config.lensTextWeight ?? config.textWeight
  const lensOpacity = config.lensTextOpacity ?? config.textOpacity
  const dateSize = config.dateFontSize ?? config.fontSize
  const dateFont = config.dateFontFamily ?? config.fontFamily
  const dateWeight = config.dateTextWeight ?? config.textWeight
  const dateOpacity = config.dateTextOpacity ?? config.textOpacity

  // 内容区 → 画布（border-box）的像素偏移（含背景区域扩展 bgExpand）
  const ox = contentOX * unitScale

  // 底部锚点 = 画布底缘（实测画布像素高换算 − padding − bgExpand，内容坐标系），INFO 落在底部留白条内
  // （与预览 FooterInfo 同源）；最底行文本 top 再上移 overlayBottom 边距
  const canvasBottomY = canvasHpx / unitScale - config.padding - config.bgExpand

  // ===== 默认排版：与预览共用同一套共享布局计算 =====
  // classic = 经典纵向堆叠（日期 / EXIF+镜头 / 型号 / Logo）；duo = 杂志双栏；inline = 悬浮双行。
  // 行高与宽度测量均取各组生效样式，单独修改某组字体/字号后导出与预览保持一致。
  const logoRatioForLayout = logo ? sourceSize(logo).w / sourceSize(logo).h : 2.6
  const layout: FooterLayout =
    config.infoLayout === 'duo' || config.infoLayout === 'inline'
      ? computeFooterLayout(config, canvasBottomY, logoRatioForLayout)
      : computeClassicLayout(config, canvasBottomY)
  // classic 文本水平对齐：center = 行中心锚点（textAlign:center，与预览 -50% 平移等价）；
  // right = 右缘锚点（textAlign:right，与预览 -100% 平移等价）；left 与 duo/inline 均为左锚点。
  const classicTextAlign: CanvasTextAlign | null =
    config.infoLayout === 'classic' ? (config.overlayAlign === 'center' ? 'center' : config.overlayAlign === 'right' ? 'right' : 'left') : null
  const rowTextAlign: CanvasTextAlign = classicTextAlign ?? 'left'
  // 手动拖拽坐标优先（与预览 absStyle 一致）：未拖拽过（null）时才用默认排版
  let dExifX = config.exifX ?? layout.exif.x
  let dExifY = config.exifY ?? layout.exif.y
  let dLogoX = config.logoX ?? layout.logo.x
  let dLogoY = config.logoY ?? layout.logo.y
  let dModelX = config.modelX ?? layout.model.x
  let dModelY = config.modelY ?? layout.model.y
  let dDateX = config.dateX ?? layout.date.x
  let dDateY = config.dateY ?? layout.date.y
  // duo 下镜头行为独立元素（可单独拖拽）；classic 下它是 EXIF 块内附加行，跟随 EXIF 移动
  let dLensX = config.lensX ?? layout.lens.x
  let dLensY = config.lensY ?? layout.lens.y
  // duo 分隔竖线：手动拖拽几何优先（infoDividerX/Top/Bottom），
  // null = 默认布局（高度自动等于下边白框带全高）
  const duoDivider = layout.divider
    ? (() => {
        const top = config.infoDividerTop ?? layout.divider.y
        const bottom = config.infoDividerBottom ?? layout.divider.y + layout.divider.h
        return {
          x: config.infoDividerX ?? layout.divider.x,
          y: top,
          h: Math.max(0, bottom - top),
        }
      })()
    : null
  const hasLensText = config.showLens && !!config.lensText

  // duo 分隔竖线：右栏文字左侧（浅灰，颜色随底色自适应）
  if (duoDivider) {
    ctx.save()
    ctx.fillStyle = `rgba(${themeColor},${themeColor},${themeColor},0.2)`
    ctx.fillRect(
      ox + duoDivider.x * unitScale,
      ox + duoDivider.y * unitScale,
      unitScale,
      duoDivider.h * unitScale,
    )
    ctx.restore()
  }

  // 深色背景（模糊/照片填充）下文字加柔和投影（与预览 infoTextShadow 一致）
  const applyTextShadow = (): void => {
    if (config.bgMode === 'solid') return
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)'
    ctx.shadowBlur = 4 * unitScale
    ctx.shadowOffsetY = 1 * unitScale
  }
  // 各组文字颜色：用户自定义色优先（hex → rgba 并应用组透明度），否则回退自适应黑白
  const paint = (custom: string | null, opacity: number): string =>
    hexToRgba(custom, opacity) ?? `rgba(${themeColor},${themeColor},${themeColor},${opacity})`

  // inline 布局：手机品牌 Logo 为文字标记，与机型文本（多含品牌名）并排重复，跳过绘制
  const showLogoDraw = config.showLogo && logo && !(config.infoLayout === 'inline' && phoneBrandOf(config.brand))
  if (showLogoDraw) {
    const lw = logoH * (sourceSize(logo).w / sourceSize(logo).h)
    // classic 水平锚点语义与文本行一致：center = 行中心（Logo 左移半宽）、right = 右缘（左移全宽）、
    // left 与 duo/inline 的 x 为左缘锚点。预览端由 absStyle 的 translate 等价实现。
    const logoShift = config.infoLayout === 'classic' ? (config.overlayAlign === 'center' ? -lw / 2 : config.overlayAlign === 'right' ? -lw : 0) : 0
    ctx.save()
    ctx.globalAlpha = config.logoOpacity
    applyTextShadow()
    ctx.drawImage(logo, ox + dLogoX * unitScale + logoShift, ox + dLogoY * unitScale, lw, logoH)
    ctx.restore()
  }
  // 与预览一致：存储值可能是旧版本写入的机身代号，导出前统一翻译成营销名（映射幂等）
  const modelText = modelAlias(config.cameraModel)
  if (config.showCameraModel && modelText) {
    ctx.save()
    ctx.fillStyle = paint(config.cameraModelColor, config.cameraModelOpacity)
    ctx.font = fontStr(config.cameraModelWeight, modelH, config.cameraModelFont, config.cameraModelItalic)
    ctx.textAlign = rowTextAlign
    ctx.textBaseline = 'top'
    applyTextShadow()
    ctx.fillText(
      modelText,
      ox + dModelX * unitScale + config.cameraModelOffsetX * unitScale,
      ox + dModelY * unitScale + config.cameraModelOffsetY * unitScale,
    )
    ctx.restore()
  }
  // 镜头行（duo 左栏上行，样式随 EXIF 文本组）
  if (config.infoLayout === 'duo' && hasLensText) {
    ctx.save()
    ctx.fillStyle = paint(config.lensTextColor, lensOpacity)
    ctx.font = fontStr(lensWeight, lensH, lensFont)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    applyTextShadow()
    ctx.fillText(config.lensText, ox + dLensX * unitScale, ox + dLensY * unitScale)
    ctx.restore()
  }
  if (config.showExif && config.exifText) {
    ctx.save()
    ctx.fillStyle = paint(config.exifTextColor, exifOpacity)
    ctx.font = fontStr(exifWeight, exifH, exifFont)
    ctx.textAlign = rowTextAlign
    ctx.textBaseline = 'top'
    applyTextShadow()
    ctx.fillText(config.exifText, ox + dExifX * unitScale, ox + dExifY * unitScale)
    ctx.restore()
  }
  // 镜头型号：EXIF 文本块附加行（仅 classic 布局；duo 有独立镜头行、inline 不展示，避免与日期重叠）
  if (config.infoLayout === 'classic' && config.showExif && config.showLens && config.lensText) {
    ctx.save()
    ctx.fillStyle = paint(config.lensTextColor, lensOpacity)
    ctx.font = fontStr(lensWeight, lensH, lensFont)
    ctx.textAlign = rowTextAlign
    ctx.textBaseline = 'top'
    applyTextShadow()
    // 行距与 EXIF 生效字号：与预览 .exif-text 块内 .lens-line 的 margin-top 完全一致
    ctx.fillText(
      config.lensText,
      ox + dExifX * unitScale,
      ox + (dExifY + exifSize + LENS_LINE_GAP) * unitScale,
    )
    ctx.restore()
  }
  // 拍摄日期：duo 下使用机型样式组（灰细小字，与样例一致）；其余布局沿用 EXIF 样式组
  if (config.showDate && config.dateText) {
    // duo 下日期默认沿用机型样式组（样例复刻）；只要用户改了一个独立属性，就以用户设置为准
    const usesModelDateStyle =
      config.infoLayout === 'duo' &&
      config.dateFontFamily === null &&
      config.dateFontSize === null &&
      config.dateTextWeight === null &&
      config.dateTextOpacity === null
    const finalOpacity = usesModelDateStyle ? config.cameraModelOpacity : dateOpacity
    const finalSize = usesModelDateStyle ? config.cameraModelSize : dateSize
    const finalWeight = usesModelDateStyle ? config.cameraModelWeight : dateWeight
    const finalFont = usesModelDateStyle ? config.cameraModelFont : dateFont
    const finalItalic = usesModelDateStyle ? config.cameraModelItalic : false
    ctx.save()
    ctx.fillStyle = paint(usesModelDateStyle ? config.cameraModelColor : config.dateTextColor, finalOpacity)
    ctx.font = fontStr(finalWeight, finalSize * unitScale, finalFont, finalItalic)
    ctx.textAlign = rowTextAlign
    ctx.textBaseline = 'top'
    applyTextShadow()
    ctx.fillText(config.dateText, ox + dDateX * unitScale, ox + dDateY * unitScale)
    ctx.restore()
  }
}

// ===== 导出画布度量（纯计算，无 DOM）：导出与任务卡预估共用同一公式 =====
export interface ExportMetrics {
  canvasW: number
  canvasH: number
  designCanvasH: number
  unitScale: number
  photoW: number
  photoH: number
  displayW: number
  displayH: number
  photoDesignW: number
  photoDesignH: number
  designContentH: number
  availW: number
  bgExpand: number
  bgBottomExpand: number
  effectivePad: number
  effectivePadBottom: number
}

/** 依据源图尺寸与配置计算导出画布全部度量（exportFrame 内部与预估同源） */
export function computeExportMetrics(
  srcW: number,
  srcH: number,
  config: FrameConfig,
  supersample: number,
): ExportMetrics {
  const ss = supersample > 0 ? supersample : 1
  const effectivePad = config.padding
  const effectivePadBottom = config.padding + config.borderRatio
  const availW = DESIGN_CONTAINER
  const bgExpand = config.bgExpand || 0
  const bgBottomExpand = bgExpand + (config.bgBottomRatio || 0)

  // 旋转+裁剪后的"显示像素"尺寸（最终照片真实像素）
  const rSize = rotatedSize(srcW, srcH, config.photoRotation)
  const displayW = Math.max(1, rSize.w * config.photoCrop.w)
  const displayH = Math.max(1, rSize.h * config.photoCrop.h)
  const displayAspect = displayW / displayH

  // 画面（边框）比例：内容区宽高比。null = 自由（跟随照片）
  const frameRatio = config.frameRatio
  let designContentH = 0
  let photoBaseW = DESIGN_CONTAINER
  if (frameRatio) {
    designContentH = DESIGN_CONTAINER / frameRatio
    const contentAspect = DESIGN_CONTAINER / designContentH
    photoBaseW = displayAspect >= contentAspect ? DESIGN_CONTAINER : designContentH * displayAspect
  }

  const photoDesignW = Math.max(1, photoBaseW * (config.scale / 100))
  const photoDesignH = photoDesignW / displayAspect
  if (!frameRatio) designContentH = photoDesignH

  // unitScale：把设计坐标（1200 宽）映射到像素；照片以原生裁剪像素 1:1 进入
  const unitScale = (displayW / photoDesignW) * ss
  const canvasW = Math.round((DESIGN_CONTAINER + 2 * bgExpand + 2 * effectivePad) * unitScale)
  const designCanvasH =
    (config.canvasH || designContentH + effectivePad + effectivePadBottom) + bgExpand + bgBottomExpand
  const canvasH = Math.round(designCanvasH * unitScale)
  const photoW = Math.round(displayW * ss)
  const photoH = Math.round(displayH * ss)
  return {
    canvasW, canvasH, designCanvasH, unitScale, photoW, photoH,
    displayW, displayH, photoDesignW, photoDesignH, designContentH,
    availW, bgExpand, bgBottomExpand, effectivePad, effectivePadBottom,
  }
}

/** 任务卡预估：只关心输出像素尺寸 */
export function estimateExportSize(
  srcW: number,
  srcH: number,
  config: FrameConfig,
  supersample: number,
): { w: number; h: number } {
  const m = computeExportMetrics(srcW, srcH, config, supersample)
  return { w: m.canvasW, h: m.canvasH }
}

/**
 * 合成并导出一张图片。
 * @returns 导出结果（Blob + 尺寸 + 格式）
 */
export async function exportFrame(
  source: ImgSource,
  config: FrameConfig,
  options: ExportOptions = {},
): Promise<ExportResult> {
  const format: ExportFormat = options.format ?? 'png'
  const jpgQuality = options.jpgQuality ?? 0.95
  const supersample = options.scale && options.scale > 0 ? options.scale : 1
  const isJpg = format === 'jpg'
  // Logo 着色：'auto' 时随背景明暗取黑/白，保证浅色相框下 Logo 不与底色融为一体
  const logoColor = logoAutoColor(config.logoColor, config.bgMode, config.bgColor)

  // 字体就绪后再绘制，避免文字错位
  if (document.fonts?.ready) await document.fonts.ready
  // 确保内置品牌真实图形 Logo 已加载完成（带颜色缓存键，避免导出拿到占位画布）
  await preloadBrandLogo(config.brand, logoColor)
  // 预加载自定义水印图（若存在），保证导出时可用
  let watermarkImg: ImgSource | null = null
  if (config.watermarkImage) {
    watermarkImg = await loadImage(config.watermarkImage)
  }

  const { w: sw, h: sh } = sourceSize(source)
  if (!sw || !sh) throw new Error('源图尺寸无效，无法导出')

  // 以原生分辨率排版：度量计算已提取为 computeExportMetrics（与任务卡预估同源）
  const M = computeExportMetrics(sw, sh, config, supersample)
  const { canvasW, canvasH, designCanvasH, unitScale, photoW, photoH } = M
  const { photoDesignW, photoDesignH, designContentH, availW, bgExpand, effectivePad, effectivePadBottom } = M

  // 照片在内容区左上角坐标（null 时水平居中；自由模式垂直贴顶、比例模式垂直居中）
  const photoContentX = config.photoX != null ? config.photoX : (availW - photoDesignW) / 2
  const photoContentY = config.photoY != null
    ? config.photoY
    : config.frameRatio
      ? (designContentH - photoDesignH) / 2
      : 0

  if (canvasW > MAX_DIM || canvasH > MAX_DIM) {
    throw new Error(`导出尺寸 ${canvasW}×${canvasH} 超出浏览器画布上限 ${MAX_DIM}px，请降低 scale 或使用更小的源图`)
  }

  const canvas = document.createElement('canvas')
  canvas.width = canvasW
  canvas.height = canvasH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法获取 Canvas 2D 上下文')

  // ===== 图层绘制（同心嵌套结构：由内向外构建「照片→背景→边框→画板」，由外向内绘制「画板→边框→背景→照片」） =====
  // 内容区（边框内侧）参数：背景层与边框层共用，同心嵌套
  const padTop = effectivePad * unitScale
  const padX = effectivePad * unitScale
  const padBottom = effectivePadBottom * unitScale
  const frameRadius = config.borderRadius * unitScale
  const innerW = canvasW - 2 * padX
  const innerH = canvasH - padTop - padBottom

  // 无边框且无背景扩展（padding=0 且 bgExpand=0）时：画板/背景层跟随照片圆角，形成圆角卡片，
  // 与预览一致，避免照片圆角外露出方形背景/边框色块（PNG 导出四角为透明）。
  const noFrame = effectivePad <= 0 && bgExpand <= 0
  const outerRadius = noFrame ? config.photoRadius * unitScale : frameRadius
  const innerRadius = noFrame
    ? config.photoRadius * unitScale
    : Math.max(0, frameRadius - padX) // 内圆角同心：外圆角 - 边框宽

  // 0) 画板底色兜底（边框色；正常使用时背景层/边框层会覆盖它，隐藏背景层时可见）。
  //    无边框时按照片圆角裁切，使四角透明。
  ctx.save()
  roundRectPath(ctx, 0, 0, canvasW, canvasH, outerRadius)
  ctx.fillStyle = config.borderColor
  ctx.fill()
  ctx.restore()

  // 1) 边框层：纯色相框（包裹背景内容区的一圈），带圆角。
  // 绘制顺序在背景之前：背景层扩宽(bgExpand>0)时可覆盖边框区，与预览 z-index 一致。
  if (innerW > 0 && innerH > 0) {
    ctx.save()
    ctx.beginPath()
    // 外圈用 outerRadius：无边框时 = 内圆角，evenodd 填充结果为空（边框层不绘制）
    roundRectPath(ctx, 0, 0, canvasW, canvasH, outerRadius)
    roundRectPath(ctx, padX, padTop, innerW, innerH, innerRadius)
    ctx.fillStyle = config.borderColor
    ctx.fill('evenodd')
    ctx.restore()
  }

  // 2) 背景图层（受 layerVisible.bg 控制，与预览一致）：
  //    背景区域 = 画板 content box（边框内侧），canvasW 已含 bgExpand，innerW/H 即背景区域尺寸。
  const bgVisible = config.layerVisible.bg !== false
  const bgW = innerW
  const bgH = innerH
  const bgX = padX
  const bgY = padTop
  if (bgVisible && bgW > 0 && bgH > 0) {
    ctx.save()
    roundRectPath(ctx, bgX, bgY, bgW, bgH, innerRadius)
    ctx.clip()
    if (config.bgMode === 'solid') {
      // 纯色背景：直接填充背景区域
      ctx.fillStyle = config.bgColor
      ctx.fillRect(bgX, bgY, bgW, bgH)
    } else if (config.bgMode === 'blur') {
      // 背景模糊：原图模糊铺满背景区域（不压暗，与预览一致）
      if (source) {
        const offX = config.bgOffsetX * unitScale
        const offY = config.bgOffsetY * unitScale
        drawBlurredBackground(ctx, source, bgW, bgH, config.blur * unitScale, 1, config.bgScale, offX, offY)
      }
    } else if (config.bgMode === 'photo') {
      // 照片填充：自定义图片模糊但保持原亮
      const bgImg = options.backgroundImage || source
      if (bgImg) {
        const offX = config.bgOffsetX * unitScale
        const offY = config.bgOffsetY * unitScale
        drawBlurredBackground(ctx, bgImg, bgW, bgH, config.blur * unitScale, 1, config.bgScale, offX, offY)
      }
    } else {
      ctx.fillStyle = '#0a0a0a'
      ctx.fillRect(bgX, bgY, bgW, bgH)
    }
    ctx.restore()
  }

  // 2) 主照片图层（受 layerVisible.photo 控制）
  const photoVisible = config.layerVisible.photo !== false
  // magazine 取色色卡：从合成后的照片像素提取主色（照片隐藏时回退兜底色）
  let magazinePalette = FALLBACK_PALETTE
  // 加 effectivePad + bgExpand 得画布坐标（内容区原点在画布 padding + 背景扩展内侧）；
  // photoContentX/Y 已在上面按「null 时水平居中/垂直贴顶」计算，此处复用。
  const px = (effectivePad + bgExpand + photoContentX) * unitScale
  const py = (effectivePad + bgExpand + photoContentY) * unitScale
  const photoRadiusPx = config.photoRadius * unitScale
  if (photoVisible) {
    const photoCanvas = document.createElement('canvas')
    photoCanvas.width = photoW
    photoCanvas.height = photoH
    const pctx = photoCanvas.getContext('2d')
    if (!pctx) throw new Error('无法获取离屏 Canvas 上下文')
    // 照片圆角裁切（photoRadius 设计 px → 像素）
    roundRectPath(pctx, 0, 0, photoW, photoH, photoRadiusPx)
    pctx.clip()
    // 旋转+裁剪：把源图对应区域旋转为正向后绘制到 photoW×photoH
    drawRotatedCropped(pctx, source, sw, sh, config.photoRotation, config.photoCrop, photoW, photoH)
    if (config.infoLayout === 'magazine' && config.showPalette) {
      magazinePalette = extractPalette(photoCanvas, photoW, photoH) ?? FALLBACK_PALETTE
    }

    ctx.save()
    if (config.shadow > 0) {
      // 与预览 --photo-shadow 一致的立体阴影参数（作用在照片上，画板无阴影）
      ctx.shadowColor = `rgba(0,0,0,${Math.min(0.85, config.shadow * 0.85).toFixed(3)})`
      ctx.shadowBlur = 60 * unitScale * config.shadow
      ctx.shadowOffsetY = 18 * unitScale * config.shadow
    }
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(photoCanvas, px, py)
    ctx.restore()
  }

  // 3) 信息图层（顶层：Logo + 相机型号 + EXIF），受 layerVisible.info 控制
  const infoVisible = config.layerVisible.info !== false
  if (infoVisible) {
    // 若调用方未显式传入 logo（如自定义 Logo），则使用内置品牌 Logo（暗白双版）
    const footerLogo = options.logo ?? (config.showLogo ? resolveLogo(config.brand, logoColor) : undefined)
    await drawFooter(ctx, config, unitScale, footerLogo, effectivePad + bgExpand, canvas.height, magazinePalette)
  }

  // 3.5) 顶层 INFO 多元素容器层（自由拖拽排版）：与预览 InfoLayerDisplay 一致
  if (infoVisible && config.infoLayer?.enabled) {
    // 预载内置品牌 Logo，确保导出拿到完整画布
    await preloadInfoLogos(config.infoLayer)
    const canvasCenter = { x: DESIGN_CONTAINER / 2, y: designCanvasH / 2 }
    // 照片变换矩阵（设计 px 空间，未含 unitScale）：先平移到照片中心（含 pad + 背景扩展），再旋转
    const photoCx = effectivePad + bgExpand + photoContentX + photoDesignW / 2
    const photoCy = effectivePad + bgExpand + photoContentY + photoDesignH / 2
    const outerMatrix = new DOMMatrix()
      .translate(photoCx, photoCy)
      .rotate(config.photoRotation)
    ctx.save()
    ctx.scale(unitScale, unitScale)
    drawInfoLayer(ctx, config.infoLayer, {
      exifRaw: config.exifRaw,
      model: modelAlias(config.cameraModel),
      eqFocal: config.eqFocal,
      cropFactor: config.cropFactor,
      outerMatrix: config.infoLayer.bindTarget === 'photo' ? outerMatrix : undefined,
      canvasCenter,
      unitScale: 1, // 已通过 ctx.scale 处理
    })
    ctx.restore()
  }

  // 4) 附加效果层：暗角 + 颗粒 + 水印（顶层，受 layerVisible 一致约束）
  if (config.layerVisible.info !== false) {
    if (config.vignette > 0) drawVignette(ctx, canvasW, canvasH, config.vignette)
    if (config.grain > 0) drawGrain(ctx, canvasW, canvasH, config.grain, 7)
    if (config.showWatermark) {
      drawWatermark(ctx, canvasW, canvasH, {
        text: config.watermarkText,
        image: watermarkImg,
        opacity: config.watermarkOpacity,
        size: config.watermarkSize,
        angle: config.watermarkAngle,
        tile: config.watermarkTile,
        align: config.watermarkAlign,
        bottom: config.watermarkBottom * unitScale,
      })
    }
  }

  // 5) 导出
  const mime = isJpg ? 'image/jpeg' : 'image/png'
  let blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('canvas.toBlob 失败'))),
      mime,
      isJpg ? jpgQuality : undefined, // PNG 忽略 quality，保证无损
    )
  })
  // JPG 嵌入 sRGB ICC（#6 折中）：canvas 像素已是 sRGB，但 toBlob 不写 ICC 标签，
  // 部分看图软件/平台在无标签时会错误猜解读导致「导出后偏色」。
  if (isJpg) {
    blob = new Blob([embedJpegICC(await blob.arrayBuffer(), buildSrgbICC())], { type: mime })
  }

  return { blob, width: canvasW, height: canvasH, format }
}

/** 触发浏览器下载 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  // 延迟释放，确保下载已触发
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** 生成导出文件名：frame_时间戳.ext */
export function makeExportFilename(format: ExportFormat, prefix = 'frame'): string {
  const ts = Date.now()
  return `${prefix}_${ts}.${format === 'jpg' ? 'jpg' : 'png'}`
}

/**
 * 便捷封装：合成 + 下载一步完成。
 */
export async function exportAndDownload(
  source: ImgSource,
  config: FrameConfig,
  options: ExportOptions = {},
): Promise<ExportResult> {
  const result = await exportFrame(source, config, options)
  downloadBlob(result.blob, makeExportFilename(result.format))
  return result
}
