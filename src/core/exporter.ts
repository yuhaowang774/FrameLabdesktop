// 保真导出核心：纯 Canvas 手工合成（不用 dom-to-image）。
// - 主照片以原生像素 1:1 进入画布，其余装饰层按 unitScale 成比例放大，避免降采样。
// - 支持 PNG(无损) / JPG(高画质) 两种格式选项。
import type { FrameConfig } from './types'
import { drawBlurredBackground, type ImgSource } from './bgRenderer'
import { resolveLogo } from '../composables/useLogoStore'

export type ExportFormat = 'png' | 'jpg'

export interface ExportOptions {
  /** 导出格式：png=无损, jpg=高画质有损。默认 png */
  format?: ExportFormat
  /** JPG 画质 0~1，默认 0.95（仅在 format='jpg' 时生效） */
  jpgQuality?: number
  /** 超采样倍率：>1 让装饰层(文字/Logo/模糊)更锐利，照片本身已是原生分辨率。默认 1 */
  scale?: number
  /** bgMode='custom' 时传入的自定义背景图 */
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

/** 设计稿基准宽度（与预览 FrameContainer 一致），仅作逻辑坐标，不直接作为物理像素 */
const DESIGN_CONTAINER = 1200
/** 浏览器画布边长上限（Chrome 约 16384），超出 toBlob 会失败 */
const MAX_DIM = 16384

function sourceSize(img: ImgSource): { w: number; h: number } {
  if (img instanceof HTMLImageElement) return { w: img.naturalWidth, h: img.naturalHeight }
  if (img instanceof SVGImageElement) return { w: img.width.baseVal.value, h: img.height.baseVal.value }
  return { w: (img as HTMLCanvasElement | OffscreenCanvas).width, h: (img as HTMLCanvasElement | OffscreenCanvas).height }
}

function fontStr(weight: number, size: number, family: string, italic = false): string {
  return `${italic ? 'italic ' : ''}${weight} ${size}px ${family}`
}

async function drawFooter(
  ctx: CanvasRenderingContext2D,
  config: FrameConfig,
  unitScale: number,
  logo: ImgSource | undefined,
  geom: {
    canvasW: number
    canvasH: number
    padPx: number
    photoY: number
    photoH: number
    distPhotoLogoPx: number
    overlayBottomPx: number
    align: 'left' | 'center' | 'right'
  },
): Promise<void> {
  const showLogo = config.showLogo && !!logo
  const showModel = config.showCameraModel && !!config.cameraModel
  const showExif = config.showExif && !!config.exifText
  if (!showLogo && !showModel && !showExif) return

  const order: Array<'logo' | 'model' | 'exif'> = []
  if (showLogo) order.push('logo')
  if (showModel) order.push('model')
  if (showExif) order.push('exif')

  const logoH = config.logoSize * unitScale
  const modelH = config.cameraModelSize * unitScale
  const exifH = config.fontSize * unitScale
  const gapLogoText = config.distLogoText * unitScale
  const gapModelExif = config.cameraModelGap * unitScale

  const heights = order.map((r) => (r === 'logo' ? logoH : r === 'model' ? modelH : exifH))
  let total = heights.reduce((a, b) => a + b, 0)
  for (let i = 0; i < order.length - 1; i++) {
    total += order[i] === 'logo' ? gapLogoText : gapModelExif
  }

  // 起始 Y：默认/无背景-下方 模式从照片下方开始；无背景-叠加 模式贴底对齐
  const isOverlay = config.bgMode === 'none'
  let cursorY = isOverlay ? geom.canvasH - geom.overlayBottomPx - total : geom.photoY + geom.photoH + geom.distPhotoLogoPx

  const textAlign = geom.align
  const baseX = geom.align === 'left' ? geom.padPx : geom.align === 'right' ? geom.canvasW - geom.padPx : geom.canvasW / 2
  const themeColor = config.theme === 'dark' ? 255 : 0

  for (const row of order) {
    if (row === 'logo' && logo) {
      const lw = logoH * (sourceSize(logo).w / sourceSize(logo).h)
      const lx = geom.align === 'left' ? baseX : geom.align === 'right' ? baseX - lw : baseX - lw / 2
      ctx.save()
      ctx.globalAlpha = config.logoOpacity
      ctx.drawImage(logo, lx, cursorY, lw, logoH)
      ctx.restore()
      cursorY += logoH + gapLogoText
    } else if (row === 'model') {
      ctx.save()
      ctx.fillStyle = `rgba(${themeColor},${themeColor},${themeColor},${config.cameraModelOpacity})`
      ctx.font = fontStr(config.cameraModelWeight, modelH, config.cameraModelFont, config.cameraModelItalic)
      ctx.textAlign = textAlign
      ctx.textBaseline = 'top'
      ctx.fillText(config.cameraModel, baseX + config.cameraModelOffsetX * unitScale, cursorY + config.cameraModelOffsetY * unitScale)
      ctx.restore()
      cursorY += modelH + gapModelExif
    } else if (row === 'exif') {
      ctx.save()
      ctx.fillStyle = `rgba(${themeColor},${themeColor},${themeColor},${config.textOpacity})`
      ctx.font = fontStr(config.textWeight, exifH, config.fontFamily)
      ctx.textAlign = textAlign
      ctx.textBaseline = 'top'
      ctx.fillText(config.exifText, baseX, cursorY)
      ctx.restore()
      cursorY += exifH
    }
  }
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

  // 字体就绪后再绘制，避免文字错位
  if (document.fonts?.ready) await document.fonts.ready

  const { w: sw, h: sh } = sourceSize(source)
  if (!sw || !sh) throw new Error('源图尺寸无效，无法导出')

  // 以原生分辨率排版：photo 实际像素 = 源图像素
  // none 模式：无边框，照片铺满（padding=0、scale=100%），与预览一致
  const effectivePad = config.bgMode === 'none' ? 0 : config.padding
  const effectiveScale = config.bgMode === 'none' ? 100 : config.scale
  const availW = DESIGN_CONTAINER - 2 * effectivePad
  const photoDesignW = Math.max(1, availW * (effectiveScale / 100))
  const photoDesignH = (photoDesignW * sh) / sw
  const unitScale = (sw / photoDesignW) * supersample

  const padPx = effectivePad * unitScale
  const canvasW = Math.round(DESIGN_CONTAINER * unitScale)
  const canvasH = Math.round((photoDesignH + 2 * effectivePad) * unitScale)
  const photoW = Math.round(sw * supersample)
  const photoH = Math.round(sh * supersample)

  if (canvasW > MAX_DIM || canvasH > MAX_DIM) {
    throw new Error(`导出尺寸 ${canvasW}×${canvasH} 超出浏览器画布上限 ${MAX_DIM}px，请降低 scale 或使用更小的源图`)
  }

  const canvas = document.createElement('canvas')
  canvas.width = canvasW
  canvas.height = canvasH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法获取 Canvas 2D 上下文')

  // 1) 背景
  if (config.bgMode === 'none') {
    if (isJpg) {
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, canvasW, canvasH)
    }
    // PNG 留透明
  } else {
    const bgImg = config.bgMode === 'custom' ? options.backgroundImage : source
    if (bgImg) {
      // default：原图模糊+变暗；custom：上传图模糊但保持原亮
      const dim = config.bgMode === 'custom' ? 1 : 0.7
      drawBlurredBackground(ctx, bgImg, canvasW, canvasH, config.blur * unitScale, dim)
    } else {
      ctx.fillStyle = '#000'
      ctx.fillRect(0, 0, canvasW, canvasH)
    }
  }

  // 2) 主照片：先裁圆角到离屏画布，再带投影绘制（确保阴影在圆角外可见）
  const photoCanvas = document.createElement('canvas')
  photoCanvas.width = photoW
  photoCanvas.height = photoH
  const pctx = photoCanvas.getContext('2d')
  if (!pctx) throw new Error('无法获取离屏 Canvas 上下文')
  const radius = config.radius * unitScale
  pctx.beginPath()
  pctx.roundRect(0, 0, photoW, photoH, radius)
  pctx.clip()
  pctx.drawImage(source, 0, 0, photoW, photoH)

  const px = padPx
  const py = padPx
  ctx.save()
  if (config.shadow > 0) {
    ctx.shadowColor = `rgba(0,0,0,${(config.shadow * 0.5).toFixed(3)})`
    ctx.shadowBlur = 40 * unitScale * config.shadow
    ctx.shadowOffsetY = 10 * unitScale * config.shadow
  }
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(photoCanvas, px, py)
  ctx.restore()

  // 3) 页脚（Logo + 相机型号 + EXIF）
  // 若调用方未显式传入 logo（如自定义 Logo），则使用内置品牌 Logo（暗白双版）
  const footerLogo = options.logo ?? (config.showLogo ? resolveLogo(config.brand, config.theme) : undefined)
  await drawFooter(ctx, config, unitScale, footerLogo, {
    canvasW,
    canvasH,
    padPx,
    photoY: py,
    photoH,
    distPhotoLogoPx: config.distPhotoLogo * unitScale,
    overlayBottomPx: config.overlayBottom * unitScale,
    align: config.bgMode === 'none' ? config.overlayAlign : 'center',
  })

  // 4) 导出
  const mime = isJpg ? 'image/jpeg' : 'image/png'
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('canvas.toBlob 失败'))),
      mime,
      isJpg ? jpgQuality : undefined, // PNG 忽略 quality，保证无损
    )
  })

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
