// 保真导出核心：纯 Canvas 手工合成（不用 dom-to-image）。
// - 主照片以原生像素 1:1 进入画布，其余装饰层按 unitScale 成比例放大，避免降采样。
// - 支持 PNG(无损) / JPG(高画质) 两种格式选项。
import type { FrameConfig } from './types'
import { drawBlurredBackground, drawVignette, drawGrain, drawWatermark, type ImgSource } from './bgRenderer'
import { resolveLogo, preloadBrandLogo } from '../composables/useLogoStore'
import { drawInfoLayer, preloadInfoLogos } from './infoRenderer'
import { buildSrgbICC, embedJpegICC } from './icc'
import { hexLuminance, logoAutoColor } from './colorUtils'
import { DESIGN_CONTAINER } from './constants'
import { computeFooterLayout, type FooterLayout } from './infoLayout'
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

async function drawFooter(
  ctx: CanvasRenderingContext2D,
  config: FrameConfig,
  unitScale: number,
  logo: ImgSource | undefined,
  contentOX: number,
  canvasHpx: number,
): Promise<void> {
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
  const dateH = dateSize * unitScale
  const dateFont = config.dateFontFamily ?? config.fontFamily
  const dateWeight = config.dateTextWeight ?? config.textWeight
  const dateOpacity = config.dateTextOpacity ?? config.textOpacity

  // 内容区设计尺寸（与预览 FrameContainer 的内容区坐标系一致）
  const availW = DESIGN_CONTAINER
  // 内容区 → 画布（border-box）的像素偏移（含背景区域扩展 bgExpand）
  const ox = contentOX * unitScale

  // 页脚固定水平居中；默认垂直堆叠在内容区底部：开启日期时从下往上 = 日期 / EXIF(含镜头行) / 相机型号 / Logo；
  // 关闭日期时维持原布局（EXIF 最下）。与预览 FooterInfo.defaultPos 保持一致。
  const baseX = availW / 2
  const gap = 16 // 元素垂直间距（设计 px）
  const showDate = config.showDate && !!config.dateText
  // 镜头型号行挂在 EXIF 文本块下方，EXIF 块整体上移一行
  const lensRow = config.showLens && config.lensText ? config.fontSize + gap : 0
  // 底部锚点 = 画布底缘（实测画布像素高换算 − padding − bgExpand，内容坐标系），INFO 落在底部留白条内
  // （与 FooterInfo.defaultPos 一致）；最底行文本 top 再上移 overlayBottom 边距
  const canvasBottomY = canvasHpx / unitScale - config.padding - config.bgExpand
  const bottomEdge = canvasBottomY - config.overlayBottom
  const baseBottom = bottomEdge - config.fontSize
  const exifYDefault = showDate
    ? Math.max(0, baseBottom - gap - lensRow)
    : Math.max(0, baseBottom - lensRow)
  const dateYDefault = baseBottom
  const modelYDefault = Math.max(0, exifYDefault - config.fontSize - gap)
  const logoYDefault = Math.max(0, modelYDefault - config.logoSize - gap)
  let dExifX = config.exifX ?? baseX
  let dExifY = config.exifY ?? exifYDefault
  let dLogoX = config.logoX ?? baseX
  let dLogoY = config.logoY ?? logoYDefault
  let dModelX = config.modelX ?? baseX
  let dModelY = config.modelY ?? modelYDefault
  let dDateX = config.dateX ?? baseX
  let dDateY = config.dateY ?? dateYDefault

  // ===== duo（杂志双栏）/ inline（悬浮双行）：共享布局计算（与 FooterInfo.defaultPos 同源）=====
  let duoDivider: { x: number; y: number; h: number } | null = null
  let dLensX = 0
  let dLensY = 0
  let layout: FooterLayout | null = null
  if (config.infoLayout !== 'classic') {
    const logoRatio = logo ? sourceSize(logo).w / sourceSize(logo).h : 2.6
    layout = computeFooterLayout(config, canvasBottomY, logoRatio)
    dExifX = layout.exif.x
    dExifY = layout.exif.y
    dDateX = layout.date.x
    dDateY = layout.date.y
    dModelX = layout.model.x
    dModelY = layout.model.y
    dLogoX = layout.logo.x
    dLogoY = layout.logo.y
    dLensX = layout.lens.x
    dLensY = layout.lens.y
    duoDivider = layout.divider
  }
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

  if (config.showLogo && logo) {
    const lw = logoH * (sourceSize(logo).w / sourceSize(logo).h)
    ctx.save()
    ctx.globalAlpha = config.logoOpacity
    applyTextShadow()
    ctx.drawImage(logo, ox + dLogoX * unitScale, ox + dLogoY * unitScale, lw, logoH)
    ctx.restore()
  }
  if (config.showCameraModel && config.cameraModel) {
    ctx.save()
    ctx.fillStyle = `rgba(${themeColor},${themeColor},${themeColor},${config.cameraModelOpacity})`
    ctx.font = fontStr(config.cameraModelWeight, modelH, config.cameraModelFont, config.cameraModelItalic)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    applyTextShadow()
    ctx.fillText(
      config.cameraModel,
      ox + dModelX * unitScale + config.cameraModelOffsetX * unitScale,
      ox + dModelY * unitScale + config.cameraModelOffsetY * unitScale,
    )
    ctx.restore()
  }
  // 镜头行（duo 左栏上行，样式随 EXIF 文本组）
  if (config.infoLayout === 'duo' && hasLensText) {
    ctx.save()
    ctx.fillStyle = `rgba(${themeColor},${themeColor},${themeColor},${lensOpacity})`
    ctx.font = fontStr(lensWeight, lensH, lensFont)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    applyTextShadow()
    ctx.fillText(config.lensText, ox + dLensX * unitScale, ox + dLensY * unitScale)
    ctx.restore()
  }
  if (config.showExif && config.exifText) {
    ctx.save()
    ctx.fillStyle = `rgba(${themeColor},${themeColor},${themeColor},${exifOpacity})`
    ctx.font = fontStr(exifWeight, exifH, exifFont)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    applyTextShadow()
    ctx.fillText(config.exifText, ox + dExifX * unitScale, ox + dExifY * unitScale)
    ctx.restore()
  }
  // 镜头型号：EXIF 文本块附加行（仅 classic 布局；duo 有独立镜头行、inline 不展示，避免与日期重叠）
  if (config.infoLayout === 'classic' && config.showExif && config.showLens && config.lensText) {
    ctx.save()
    ctx.fillStyle = `rgba(${themeColor},${themeColor},${themeColor},${lensOpacity})`
    ctx.font = fontStr(lensWeight, lensH, lensFont)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    applyTextShadow()
    ctx.fillText(
      config.lensText,
      ox + dExifX * unitScale,
      ox + (dExifY + config.fontSize + gap) * unitScale,
    )
    ctx.restore()
  }
  // 拍摄日期：duo 下使用机型样式组（灰细小字，与样例一致）；其余布局沿用 EXIF 样式组
  if (config.showDate && config.dateText) {
    const dateModelStyle = config.infoLayout === 'duo'
    ctx.save()
    ctx.fillStyle = `rgba(${themeColor},${themeColor},${themeColor},${dateModelStyle ? config.cameraModelOpacity : dateOpacity})`
    ctx.font = dateModelStyle
      ? fontStr(config.cameraModelWeight, modelH, config.cameraModelFont, config.cameraModelItalic)
      : fontStr(dateWeight, dateH, dateFont)
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'
    applyTextShadow()
    ctx.fillText(config.dateText, ox + dDateX * unitScale, ox + dDateY * unitScale)
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

  // 以原生分辨率排版：photo 实际像素 = 旋转+裁剪后的真实像素
  // none 模式已移除，padding/scale 直接使用 config 值
  const effectivePad = config.padding
  // 下边宽度：下边框留白 = padding + borderRatio（borderRatio 为照片下边额外延长量 px）
  const effectivePadBottom = config.padding + config.borderRatio
  const effectiveScale = config.scale
  // 内容区基准宽：固定为设计稿宽度，与边框宽度(padding)解耦。
  // 调节「边框宽度」时照片大小不变，边框在照片四周向外扩展，画布随之变大。
  const availW = DESIGN_CONTAINER
  // 背景区域扩展量（设计 px，>0 时背景/边框/画布同步扩大）
  const bgExpand = config.bgExpand || 0
  // 背景下边扩展量（下边 = bgExpand + bgBottomRatio）
  const bgBottomExpand = bgExpand + (config.bgBottomRatio || 0)

  // 旋转+裁剪后的"显示像素"尺寸（最终照片真实像素）
  const rSize = rotatedSize(sw, sh, config.photoRotation)
  const displayW = Math.max(1, rSize.w * config.photoCrop.w)
  const displayH = Math.max(1, rSize.h * config.photoCrop.h)
  const displayAspect = displayW / displayH

  // 画面（边框）比例：内容区宽高比。null = 自由（跟随照片）。
  const frameRatio = config.frameRatio
  let designContentH = 0
  let photoBaseW = DESIGN_CONTAINER
  if (frameRatio) {
    designContentH = DESIGN_CONTAINER / frameRatio
    const contentAspect = DESIGN_CONTAINER / designContentH
    // contain 适配宽：照片等比完整放入固定比例内容区
    photoBaseW = displayAspect >= contentAspect ? DESIGN_CONTAINER : designContentH * displayAspect
  }

  const photoDesignW = Math.max(1, photoBaseW * (effectiveScale / 100))
  const photoDesignH = photoDesignW / displayAspect
  if (!frameRatio) designContentH = photoDesignH

  // unitScale：把设计坐标（1200 宽）映射到像素；照片以原生裁剪像素 1:1 进入
  const unitScale = (displayW / photoDesignW) * supersample

  const canvasW = Math.round((DESIGN_CONTAINER + 2 * bgExpand + 2 * effectivePad) * unitScale)
  // 照片在内容区左上角坐标（null 时水平居中；自由模式垂直贴顶、比例模式垂直居中）
  const photoContentX = config.photoX != null ? config.photoX : (availW - photoDesignW) / 2
  const photoContentY = config.photoY != null
    ? config.photoY
    : frameRatio
      ? (designContentH - photoDesignH) / 2
      : 0
  // 画布高度：内容区高 + 上扩展 bgExpand + 下扩展 bgBottomExpand + 上留 effectivePad + 下留 effectivePadBottom
  const designCanvasH =
    (config.canvasH || designContentH + effectivePad + effectivePadBottom) + bgExpand + bgBottomExpand
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
    await drawFooter(ctx, config, unitScale, footerLogo, effectivePad + bgExpand, canvas.height)
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
      model: config.cameraModel,
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
