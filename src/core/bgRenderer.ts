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
 * 绘制模糊背景。向外扩展 blur*3 像素，避免边缘出现透明/黑边。
 * @param dim 亮度系数，默认 0.7（原图变暗作边框背景）
 */
export function drawBlurredBackground(
  ctx: CanvasRenderingContext2D,
  img: ImgSource,
  w: number,
  h: number,
  blurPx: number,
  dim = 0.7,
): void {
  const expand = blurPx * 3
  ctx.save()
  ctx.filter = `blur(${blurPx}px) brightness(${dim})`
  drawImageProp(ctx, img, -expand, -expand, w + expand * 2, h + expand * 2)
  ctx.restore()
}
