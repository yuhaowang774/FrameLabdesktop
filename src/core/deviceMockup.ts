// 设备样机绘制：把照片"装进"设备轮廓（手机壳：边框环内收覆盖照片边缘 + 顶部灵动岛）。
// 预览（MainPhoto 照片画布）与导出（exporter 照片离屏画布）共用同一函数，保证三端一致；
// 厚度/圆角按画布尺寸比例计算，任何分辨率下视觉比例一致。
// 半径：调用方传入照片圆角像素值（导出端精确已知；预览按 photoRadius/设计宽 比例换算）。
export type DeviceMockupKind = 'phone-dark' | 'phone-light'

/** 边框环颜色：深空灰近黑 / 银色浅灰 */
const BEZEL_COLORS: Record<DeviceMockupKind, { bezel: string; innerLine: string }> = {
  'phone-dark': { bezel: '#17181A', innerLine: 'rgba(255,255,255,0.08)' },
  'phone-light': { bezel: '#D7D9DD', innerLine: 'rgba(0,0,0,0.22)' },
}

/**
 * 在照片画布上绘制设备样机（像素空间：w/h = 画布像素尺寸，radiusPx = 照片圆角像素值）。
 * 绘制策略：边框环从照片边缘向内收（环外缘 = 照片矩形），灵动岛压在照片顶部居中——
 * 两者都画在照片矩形内部，不依赖画布外的留白空间，全幅模板同样适用。
 */
export function drawDeviceMockup(
  ctx: CanvasRenderingContext2D,
  kind: DeviceMockupKind,
  w: number,
  h: number,
  radiusPx: number,
): void {
  const colors = BEZEL_COLORS[kind]
  const base = Math.max(w, h)
  // 边框环厚度：长边 1.6%，钳制到 [6, 40] 像素（极小缩略图/超大导出都稳定）
  const t = Math.min(40, Math.max(6, base * 0.016))
  const outerR = Math.max(0, Math.min(radiusPx, Math.min(w, h) / 2))
  const innerR = Math.max(0, outerR - t)

  ctx.save()
  // 边框环（evenodd 双圆角矩形挖孔）
  ctx.beginPath()
  roundRect(ctx, 0, 0, w, h, outerR)
  roundRect(ctx, t, t, w - t * 2, h - t * 2, innerR)
  ctx.fillStyle = colors.bezel
  ctx.fill('evenodd')
  // 环内缘描线：银色壳加深分界、深灰壳加一丝高光，避免环与照片糊在一起
  ctx.beginPath()
  roundRect(ctx, t, t, w - t * 2, h - t * 2, innerR)
  ctx.strokeStyle = colors.innerLine
  ctx.lineWidth = Math.max(1, base * 0.0012)
  ctx.stroke()
  ctx.restore()

  // 灵动岛：顶部居中胶囊（黑色，任何壳色下都是黑色——与真机一致）
  const islandW = Math.min(w * 0.26, h * 0.42)
  const islandH = Math.max(8, Math.min(h * 0.032, islandW * 0.38))
  const islandX = w / 2 - islandW / 2
  const islandY = Math.max(t * 0.55, h * 0.014)
  ctx.save()
  ctx.beginPath()
  roundRect(ctx, islandX, islandY, islandW, islandH, islandH / 2)
  ctx.fillStyle = '#101013'
  ctx.fill()
  ctx.restore()
}

/** 圆角矩形路径（与 exporter.roundRectPath 同规则的独立实现，避免循环依赖） */
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}
