// 背景渲染工具：cover 裁剪算法 + 模糊背景绘制
// 预览(BgCanvas)与导出(exporter)共用，保证二者一致。

export type ImgSource = CanvasImageSource

function imgWidth(img: ImgSource): number {
  if (img instanceof HTMLImageElement) return img.naturalWidth
  if (img instanceof SVGImageElement) return img.width.baseVal.value
  return (img as HTMLCanvasElement | OffscreenCanvas).width
}

function imgHeight(img: ImgSource): number {
  if (img instanceof HTMLImageElement) return img.naturalHeight
  if (img instanceof SVGImageElement) return img.height.baseVal.value
  return (img as HTMLCanvasElement | OffscreenCanvas).height
}

/**
 * cover 模式绘制：按宽高比取较大缩放值，居中裁剪，填满目标区域 (x,y,w,h)。
 * offsetX/offsetY 取值 0~1，0.5 表示居中。
 */
export function drawImageProp(
  ctx: CanvasRenderingContext2D,
  img: ImgSource,
  x: number,
  y: number,
  w: number,
  h: number,
  offsetX = 0.5,
  offsetY = 0.5,
): void {
  const iw = imgWidth(img)
  const ih = imgHeight(img)
  if (iw === 0 || ih === 0) return

  const r = Math.max(w / iw, h / ih)
  const nw = iw * r
  const nh = ih * r
  const cx = (w - nw) * offsetX
  const cy = (h - nh) * offsetY

  ctx.drawImage(img, x + cx, y + cy, nw, nh)
}

/**
 * 绘制模糊背景。基于 cover 计算出基准缩放，再乘以 zoom 实现自由缩放，
 * 并以 (offsetX, offsetY) 平移（设计/画布像素），模拟 Word 式拖拽背景。
 * @param dim 亮度系数，默认 1（不压暗——评论区「模糊后偏暗/不艳」修正；
 *            主图与自定义背景统一不做隐性亮度衰减）
 * @param zoom 背景缩放倍数（1 = cover 铺满）
 * @param offsetX 背景水平平移（画布像素）
 * @param offsetY 背景垂直平移（画布像素）
 *
 * 性能：模糊滤镜（ctx.filter=blur）开销很大，这里使用 OffscreenCanvas（降级为普通 canvas）
 * 缓存上一次模糊结果，参数不变时直接 blit，避免重复模糊。
 */
let blurCache: {
  img: ImgSource
  w: number
  h: number
  blurPx: number
  dim: number
  zoom: number
  offsetX: number
  offsetY: number
  quality: ImageSmoothingQuality
  canvas: HTMLCanvasElement | OffscreenCanvas
} | null = null

/**
 * 模糊源降采样缓存：模糊(blur≥4px)会把高频细节完全抹平，把超大源图一次性降到
 * 目标区域 2 倍尺寸后再参与模糊绘制，视觉无损而读源开销按比例大降
 * （12000px 源 → 2400px 时约 25 倍像素量缩减）。
 */
let blurSourceCache: {
  img: ImgSource
  targetLong: number
  src: HTMLCanvasElement | OffscreenCanvas
  w: number
  h: number
} | null = null

function getBlurSource(
  img: ImgSource,
  w: number,
  h: number,
  blurPx: number,
): { src: ImgSource; w: number; h: number } {
  const iw = imgWidth(img)
  const ih = imgHeight(img)
  const long = Math.max(iw, ih)
  // 目标尺寸分桶量化（128px 一档）：拖动「背景宽度/边框」等滑块时画布尺寸连续变化，
  // 若按精确尺寸缓存，每个 tick 都会 miss 并对原图重新整幅降采样（12000px 源每次
  // 数十毫秒甚至更久，是滑块卡顿主因）。量化后一个桶内复用同一次降采样结果。
  const targetLong = Math.ceil((1.5 * Math.max(w, h)) / 128) * 128
  // 无模糊或源已足够小：直接用原图（保持清晰度）
  if (blurPx < 4 || long <= targetLong || !iw || !ih) {
    return { src: img, w: iw, h: ih }
  }
  if (
    blurSourceCache &&
    blurSourceCache.img === img &&
    blurSourceCache.targetLong === targetLong
  ) {
    return { src: blurSourceCache.src, w: blurSourceCache.w, h: blurSourceCache.h }
  }
  const f = targetLong / long
  const dw = Math.max(1, Math.round(iw * f))
  const dh = Math.max(1, Math.round(ih * f))
  const c = createOffscreen(dw, dh)
  const cx = (c as any).getContext('2d') as CanvasRenderingContext2D
  if (cx) {
    cx.imageSmoothingEnabled = true
    cx.imageSmoothingQuality = 'high'
    cx.drawImage(img, 0, 0, dw, dh)
  }
  blurSourceCache = { img, targetLong, src: c, w: dw, h: dh }
  return { src: c, w: dw, h: dh }
}

export function drawBlurredBackground(
  ctx: CanvasRenderingContext2D,
  img: ImgSource,
  w: number,
  h: number,
  blurPx: number,
  dim = 1,
  zoom = 1,
  offsetX = 0,
  offsetY = 0,
  quality: ImageSmoothingQuality = 'high',
): void {
  const iw0 = imgWidth(img)
  const ih0 = imgHeight(img)
  if (iw0 === 0 || ih0 === 0) return

  // 命中缓存：参数与图像引用完全一致 → 直接复用
  if (
    blurCache &&
    blurCache.img === img &&
    blurCache.w === w &&
    blurCache.h === h &&
    blurCache.blurPx === blurPx &&
    blurCache.dim === dim &&
    blurCache.zoom === zoom &&
    blurCache.offsetX === offsetX &&
    blurCache.offsetY === offsetY &&
    blurCache.quality === quality
  ) {
    ctx.drawImage(blurCache.canvas as CanvasImageSource, 0, 0, w, h)
    return
  }

  // 大图先降采样（几何比例不变：cover 数学对缩放后的源等价）
  const blurSrc = getBlurSource(img, w, h, blurPx)
  const iw = blurSrc.w
  const ih = blurSrc.h

  const s0 = Math.max(w / iw, h / ih)
  const s = s0 * zoom
  const nw = iw * s
  const nh = ih * s
  // 以画布中心为锚点，叠加平移
  const cx = w / 2 + offsetX - nw / 2
  const cy = h / 2 + offsetY - nh / 2

  const expand = blurPx * 3

  // 在离屏画布中渲染模糊结果，供缓存复用
  const off = createOffscreen(w, h)
  const octx = (off as any).getContext('2d') as CanvasRenderingContext2D
  if (octx) {
    octx.save()
    octx.imageSmoothingEnabled = true
    octx.imageSmoothingQuality = quality
    octx.filter = `blur(${blurPx}px) brightness(${dim})`
    octx.drawImage(blurSrc.src, cx - expand, cy - expand, nw + expand * 2, nh + expand * 2)
    octx.restore()
    // 防色带抖动：模糊后的平滑渐变在 8bit 量化下产生色带（评论区「颜色断层」），
    // 叠加极低强度黑白噪点打破等差阶梯（平均亮度不变）。缓存内已含 dither，预览/导出同源。
    applyDither(octx, w, h)
  }
  blurCache = { img, w, h, blurPx, dim, zoom, offsetX, offsetY, quality, canvas: off }

  ctx.drawImage(off as CanvasImageSource, 0, 0, w, h)
}

// ===== 防色带 dither =====
// 128×128 黑白随机点瓦片（模块级缓存），以极低 alpha 用 source-over 叠加：
// 每像素随机 ±~3 LSB，打破模糊渐变的量化色带，黑白各半保证平均亮度不变。
let ditherTile: HTMLCanvasElement | OffscreenCanvas | null = null
function getDitherTile(): HTMLCanvasElement | OffscreenCanvas {
  if (ditherTile) return ditherTile
  const c = createOffscreen(128, 128)
  const cx = (c as any).getContext('2d') as CanvasRenderingContext2D
  if (cx) {
    const img = cx.createImageData(128, 128)
    const d = img.data
    let s = 7 * 9301 + 49297
    const rnd = () => {
      s = (s * 9301 + 49297) % 233280
      return s / 233280
    }
    for (let i = 0; i < d.length; i += 4) {
      const v = rnd() > 0.5 ? 255 : 0
      d[i] = v
      d[i + 1] = v
      d[i + 2] = v
      d[i + 3] = 255
    }
    cx.putImageData(img, 0, 0)
  }
  ditherTile = c
  return c
}

function applyDither(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const pat = ctx.createPattern(getDitherTile() as CanvasImageSource, 'repeat')
  if (!pat) return
  ctx.save()
  ctx.globalAlpha = 0.013
  ctx.fillStyle = pat
  ctx.fillRect(0, 0, w, h)
  ctx.restore()
}

/** 创建离屏画布，优先 OffscreenCanvas，不支持则回退到普通 canvas */
function createOffscreen(w: number, h: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof OffscreenCanvas !== 'undefined') {
    return new OffscreenCanvas(w, h)
  }
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return c
}

/**
 * 绘制暗角（vignette）。强度 0~1：边缘渐变黑。
 */
export function drawVignette(ctx: CanvasRenderingContext2D, w: number, h: number, strength: number): void {
  if (strength <= 0) return
  const cx = w / 2
  const cy = h / 2
  const r = Math.hypot(w, h) / 2
  const g = ctx.createRadialGradient(cx, cy, r * 0.45, cx, cy, r)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(1, `rgba(0,0,0,${Math.min(0.85, strength)})`)
  ctx.save()
  ctx.fillStyle = g
  ctx.fillRect(0, 0, w, h)
  ctx.restore()
}

/**
 * 绘制颗粒（grain）。强度 0~1：随机噪点叠加。
 * 性能：逐点 fillRect 会产生数十万次独立绘制调用（每次都是一次 GPU draw + 状态切换），
 * 改为离屏 ImageData 像素直写后单次合成，快 1~2 个数量级。
 */
export function drawGrain(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  strength: number,
  seed = 1,
): void {
  if (strength <= 0) return
  const count = Math.floor((w * h) / 4) * strength
  const c = createOffscreen(w, h)
  const cx = (c as any).getContext('2d') as CanvasRenderingContext2D
  if (!cx) return
  const img = cx.createImageData(w, h)
  const d = img.data
  let s = seed * 9301 + 49297
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
  const alpha = Math.round(0.06 * strength * 255)
  for (let i = 0; i < count; i++) {
    const x = Math.floor(rnd() * w)
    const y = Math.floor(rnd() * h)
    const v = rnd() > 0.5 ? 255 : 0
    const p = (y * w + x) * 4
    d[p] = v
    d[p + 1] = v
    d[p + 2] = v
    d[p + 3] = alpha
  }
  cx.putImageData(img, 0, 0)
  ctx.drawImage(c as CanvasImageSource, 0, 0)
}

/**
 * 绘制水印（文本/图片，单一或平铺）。
 */
export function drawWatermark(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  opts: {
    text: string
    image: CanvasImageSource | null
    opacity: number
    size: number // 相对画布宽度百分比
    angle: number
    tile: boolean
    align: 'center' | 'left' | 'right'
    bottom: number
  },
): void {
  const sizePx = (opts.size / 100) * w
  ctx.save()
  ctx.globalAlpha = opts.opacity

  const drawOne = (cx: number, cy: number) => {
    if (opts.image) {
      const iw = imgWidth(opts.image)
      const ih = imgHeight(opts.image)
      if (iw && ih) {
        const r = sizePx / Math.max(iw, ih)
        ctx.drawImage(opts.image, cx - (iw * r) / 2, cy - (ih * r) / 2, iw * r, ih * r)
      }
    } else if (opts.text) {
      ctx.font = `600 ${Math.max(10, sizePx * 0.16)}px Arial, sans-serif`
      ctx.fillStyle = '#ffffff'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.shadowColor = 'rgba(0,0,0,0.5)'
      ctx.shadowBlur = 4
      ctx.fillText(opts.text, cx, cy)
    }
  }

  if (opts.tile) {
    ctx.translate(w / 2, h / 2)
    ctx.rotate((opts.angle * Math.PI) / 180)
    const step = sizePx * 2.4
    for (let y = -h; y < h; y += step) {
      for (let x = -w; x < w; x += step) {
        drawOne(x, y)
      }
    }
  } else {
    let cx = w / 2
    const cy = h - opts.bottom
    if (opts.align === 'left') cx = opts.bottom
    if (opts.align === 'right') cx = w - opts.bottom
    drawOne(cx, cy)
  }
  ctx.restore()
}
