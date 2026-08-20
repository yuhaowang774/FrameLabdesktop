// 保真导出核心：纯 Canvas 手工合成（不用 dom-to-image）。
// - 主照片以原生像素 1:1 进入画布，其余装饰层按 unitScale 成比例放大，避免降采样。
// - 支持 PNG(无损) / JPG(高画质) 两种格式选项。
import type { FrameConfig } from './types'
import { drawBlurredBackground, drawVignette, drawGrain, drawWatermark, type ImgSource } from './bgRenderer'
import { resolveLogo, preloadBrandLogo } from '../composables/useLogoStore'
import { drawInfoLayer, preloadInfoLogos } from './infoRenderer'
import { DESIGN_CONTAINER } from './constants'
import { rotatedSize, drawRotatedCropped } from './photoEdit'

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

async function drawFooter(
  ctx: CanvasRenderingContext2D,
  config: FrameConfig,
  unitScale: number,
  logo: ImgSource | undefined,
  designCanvasH: number,
  effectivePad: number,
): Promise<void> {
  const themeColor = 255
  const logoH = config.logoSize * unitScale
  const modelH = config.cameraModelSize * unitScale
  const exifH = config.fontSize * unitScale

  // 内容区设计尺寸（与预览 FrameContainer 的内容区坐标系一致）
  const availW = DESIGN_CONTAINER - 2 * effectivePad
  const contentH = designCanvasH - 2 * effectivePad
  // 内容区 → 画布（border-box）的像素偏移
  const ox = effectivePad * unitScale

  // 非 none 模式页脚固定水平居中；none 模式遵循 overlayAlign
  const align: 'left' | 'center' | 'right' = config.bgMode === 'none' ? config.overlayAlign : 'center'
  const baseX = align === 'left' ? 0 : align === 'right' ? availW : availW / 2
  const dExifX = config.exifX ?? baseX
  const dExifY = config.exifY ?? Math.max(0, contentH - config.overlayBottom - config.fontSize)
  const dLogoX = config.logoX ?? baseX
  const dLogoY = config.logoY ?? Math.max(0, dExifY - config.distLogoText - config.logoSize)
  const dModelX = config.modelX ?? baseX
  const dModelY = config.modelY ?? dLogoY

  if (config.showLogo && logo) {
    const lw = logoH * (sourceSize(logo).w / sourceSize(logo).h)
    ctx.save()
    ctx.globalAlpha = config.logoOpacity
    ctx.drawImage(logo, ox + dLogoX * unitScale, ox + dLogoY * unitScale, lw, logoH)
    ctx.restore()
  }
  if (config.showCameraModel && config.cameraModel) {
    ctx.save()
    ctx.fillStyle = `rgba(${themeColor},${themeColor},${themeColor},${config.cameraModelOpacity})`
    ctx.font = fontStr(config.cameraModelWeight, modelH, config.cameraModelFont, config.cameraModelItalic)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(
      config.cameraModel,
      ox + dModelX * unitScale + config.cameraModelOffsetX * unitScale,
      ox + dModelY * unitScale + config.cameraModelOffsetY * unitScale,
    )
    ctx.restore()
  }
  if (config.showExif && config.exifText) {
    ctx.save()
    ctx.fillStyle = `rgba(${themeColor},${themeColor},${themeColor},${config.textOpacity})`
    ctx.font = fontStr(config.textWeight, exifH, config.fontFamily)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    ctx.fillText(config.exifText, ox + dExifX * unitScale, ox + dExifY * unitScale)
    ctx.restore()
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
  // 确保内置品牌真实图形 Logo 已加载，避免导出拿到占位画布
  await preloadBrandLogo(config.brand)
  // 预加载自定义水印图（若存在），保证导出时可用
  let watermarkImg: ImgSource | null = null
  if (config.watermarkImage) {
    watermarkImg = await loadImage(config.watermarkImage)
  }

  const { w: sw, h: sh } = sourceSize(source)
  if (!sw || !sh) throw new Error('源图尺寸无效，无法导出')

  // 以原生分辨率排版：photo 实际像素 = 旋转+裁剪后的真实像素
  // none 模式：无边框，照片铺满（padding=0、scale=100%），与预览一致
  const effectivePad = config.bgMode === 'none' ? 0 : config.padding
  const effectiveScale = config.bgMode === 'none' ? 100 : config.scale
  const availW = DESIGN_CONTAINER - 2 * effectivePad
  const photoDesignW = Math.max(1, availW * (effectiveScale / 100))

  // 旋转+裁剪后的"显示像素"尺寸（最终照片真实像素）
  const rSize = rotatedSize(sw, sh, config.photoRotation)
  const displayW = Math.max(1, rSize.w * config.photoCrop.w)
  const displayH = Math.max(1, rSize.h * config.photoCrop.h)
  const displayAspect = displayW / displayH
  const photoDesignH = photoDesignW / displayAspect

  // unitScale：把设计坐标（1200 宽）映射到像素；照片以原生裁剪像素 1:1 进入
  const unitScale = (displayW / photoDesignW) * supersample

  const canvasW = Math.round(DESIGN_CONTAINER * unitScale)
  // 画布高度：非 none 模式使用固定 canvasH（照片缩放不改变画布/背景）；none 模式画布=照片
  const designCanvasH =
    config.bgMode === 'none'
      ? photoDesignH
      : config.canvasH || photoDesignH + 2 * effectivePad
  const canvasH = Math.round(designCanvasH * unitScale)
  const photoW = Math.round(displayW * supersample)
  const photoH = Math.round(displayH * supersample)

  if (canvasW > MAX_DIM || canvasH > MAX_DIM) {
    throw new Error(`导出尺寸 ${canvasW}×${canvasH} 超出浏览器画布上限 ${MAX_DIM}px，请降低 scale 或使用更小的源图`)
  }

  const canvas = document.createElement('canvas')
  canvas.width = canvasW
  canvas.height = canvasH
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法获取 Canvas 2D 上下文')

  // 0) 画板底色（最底层容器背景）
  ctx.fillStyle = config.artboardColor || '#0a0a0a'
  ctx.fillRect(0, 0, canvasW, canvasH)

  // 1) 背景图层（受 layerVisible.bg 控制，与预览一致）
  const bgVisible = config.bgMode !== 'none' && config.layerVisible.bg !== false
  if (bgVisible) {
    const bgImg = config.bgMode === 'custom' ? options.backgroundImage : source
    if (bgImg) {
      // default：原图模糊+变暗；custom：上传图模糊但保持原亮
      const dim = config.bgMode === 'custom' ? 1 : 0.7
      const offX = config.bgOffsetX * unitScale
      const offY = config.bgOffsetY * unitScale
      drawBlurredBackground(ctx, bgImg, canvasW, canvasH, config.blur * unitScale, dim, config.bgScale, offX, offY)
    } else {
      ctx.fillStyle = config.artboardColor || '#0a0a0a'
      ctx.fillRect(0, 0, canvasW, canvasH)
    }
  }

  // 2) 主照片图层（受 layerVisible.photo 控制）
  const photoVisible = config.layerVisible.photo !== false
  // 主照片位置：若用户手动拖动过（photoX/photoY 非 null），按绝对设计坐标放置；否则默认 padding 居中
  // （提到块外，信息层定位也依赖 py）
  // 照片位置：photoX/photoY 为内容区坐标（相对 padding box），加 effectivePad 得画布坐标
  const px = (effectivePad + (config.photoX != null ? config.photoX : 0)) * unitScale
  const py = (effectivePad + (config.photoY != null ? config.photoY : 0)) * unitScale
  if (photoVisible) {
    const photoCanvas = document.createElement('canvas')
    photoCanvas.width = photoW
    photoCanvas.height = photoH
    const pctx = photoCanvas.getContext('2d')
    if (!pctx) throw new Error('无法获取离屏 Canvas 上下文')
    const radius = config.radius * unitScale
    pctx.beginPath()
    pctx.roundRect(0, 0, photoW, photoH, radius)
    pctx.clip()
    // 旋转+裁剪：把源图对应区域旋转为正向后绘制到 photoW×photoH
    drawRotatedCropped(pctx, source, sw, sh, config.photoRotation, config.photoCrop, photoW, photoH)

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
  }

  // 3) 信息图层（顶层：Logo + 相机型号 + EXIF），受 layerVisible.info 控制
  const infoVisible = config.layerVisible.info !== false
  if (infoVisible) {
    // 若调用方未显式传入 logo（如自定义 Logo），则使用内置品牌 Logo（暗白双版）
    const footerLogo = options.logo ?? (config.showLogo ? resolveLogo(config.brand) : undefined)
    await drawFooter(ctx, config, unitScale, footerLogo, designCanvasH, effectivePad)
  }

  // 3.5) 顶层 INFO 多元素容器层（自由拖拽排版）：与预览 InfoLayerDisplay 一致
  if (infoVisible && config.infoLayer?.enabled) {
    // 预载内置品牌 Logo，确保导出拿到完整画布
    await preloadInfoLogos(config.infoLayer)
    const canvasCenter = { x: DESIGN_CONTAINER / 2, y: designCanvasH / 2 }
    // 照片变换矩阵（设计 px 空间，未含 unitScale）：先平移到照片中心（含 pad），再旋转
    const photoCx = effectivePad + (config.photoX != null ? config.photoX : 0) + photoDesignW / 2
    const photoCy = effectivePad + (config.photoY != null ? config.photoY : 0) + photoDesignH / 2
    const outerMatrix = new DOMMatrix()
      .translate(photoCx, photoCy)
      .rotate(config.photoRotation)
    ctx.save()
    ctx.scale(unitScale, unitScale)
    drawInfoLayer(ctx, config.infoLayer, {
      exifRaw: config.exifRaw,
      model: config.cameraModel,
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
