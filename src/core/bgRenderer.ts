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
 * @param dim 亮度系数，默认 0.7（原图变暗作边框背景）
 * @param zoom 背景缩放倍数（1 = cover 铺满）
 * @param offsetX 背景水平平移（画布像素）
 * @param offsetY 背景垂直平移（画布像素）
 */
export function drawBlurredBackground(
  ctx: CanvasRenderingContext2D,
  img: ImgSource,
  w: number,
  h: number,
  blurPx: number,
  dim = 0.7,
  zoom = 1,
  offsetX = 0,
  offsetY = 0,
): void {
  const iw = imgWidth(img)
  const ih = imgHeight(img)
  if (iw === 0 || ih === 0) return

  const s0 = Math.max(w / iw, h / ih)
  const s = s0 * zoom
  const nw = iw * s
  const nh = ih * s
  // 以画布中心为锚点，叠加平移
  let cx = w / 2 + offsetX - nw / 2
  let cy = h / 2 + offsetY - nh / 2

  const expand = blurPx * 3
  ctx.save()
  ctx.filter = `blur(${blurPx}px) brightness(${dim})`
  ctx.drawImage(img, cx - expand, cy - expand, nw + expand * 2, nh + expand * 2)
  ctx.restore()
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
  ctx.save()
  ctx.globalAlpha = 0.06 * strength
  let s = seed * 9301 + 49297
  const rnd = () => {
    s = (s * 9301 + 49297) % 233280
    return s / 233280
  }
  for (let i = 0; i < count; i++) {
    const x = Math.floor(rnd() * w)
    const y = Math.floor(rnd() * h)
    const v = rnd() > 0.5 ? 255 : 0
    ctx.fillStyle = `rgb(${v},${v},${v})`
    ctx.fillRect(x, y, 1, 1)
  }
  ctx.restore()
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
