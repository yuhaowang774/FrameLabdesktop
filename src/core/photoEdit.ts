// 照片编辑：旋转 + 裁剪（手机式）。纯函数便于测试。
// crop 采用"归一化矩形"（相对旋转后图像的 0..1 比例），与具体像素解耦，
// 在预览与导出中按比例套用，保证两者一致。

export type { PhotoCrop, PhotoRotation } from '../core/types'
/** 旋转角度（度，顺时针，任意角度；0/90/180/270 为正交特例） */
export type Rotation = number

/**
 * 统一读取图像源的像素尺寸。
 * HTMLImageElement 用 naturalWidth/naturalHeight，ImageBitmap / canvas 用 width/height；
 * 预览源可能是其中任意一种（App 以解码阶段降采样的 ImageBitmap 作为预览工作副本）。
 */
export function sourceSize(src: CanvasImageSource): { w: number; h: number } {
  if (src instanceof HTMLImageElement) return { w: src.naturalWidth, h: src.naturalHeight }
  const anySrc = src as { width?: number; height?: number }
  return { w: anySrc.width ?? 0, h: anySrc.height ?? 0 }
}

/**
 * 旋转后图像的外接矩形尺寸（显示空间）。
 * - 0/90/180/270 正交角：精确返回原尺寸 / 交换宽高（避免三角函数浮点噪声）；
 * - 任意角度：外接矩形 = |w·cosθ|+|h·sinθ| × |w·sinθ|+|h·cosθ|（角度越大空角越多）。
 */
export function rotatedSize(w: number, h: number, rotation: Rotation): { w: number; h: number } {
  const norm = ((rotation % 360) + 360) % 360
  const quarter = Math.round(norm / 90) * 90
  if (Math.abs(norm - quarter) < 1e-6) {
    return quarter % 180 === 90 ? { w: h, h: w } : { w, h }
  }
  const r = (norm * Math.PI) / 180
  const c = Math.abs(Math.cos(r))
  const s = Math.abs(Math.sin(r))
  return { w: w * c + h * s, h: w * s + h * c }
}

/** 归一化裁剪矩形（0..1，相对旋转后图像）。默认满框。 */
export interface CropRect {
  x: number
  y: number
  w: number
  h: number
}

export const FULL_CROP: CropRect = { x: 0, y: 0, w: 1, h: 1 }

/** 把归一化裁剪约束到合法范围（不越界、最小尺寸、保持 0..1） */
export function clampCrop(c: CropRect, min = 0.05): CropRect {
  const w = Math.max(min, Math.min(1, c.w))
  const h = Math.max(min, Math.min(1, c.h))
  const x = Math.max(0, Math.min(1 - w, c.x))
  const y = Math.max(0, Math.min(1 - h, c.y))
  return { x, y, w, h }
}

/**
 * 由"旋转后显示尺寸"（displayW/H，即预览框尺寸）反推裁剪框在源图像（旋转前）像素空间的位置。
 * 供 canvas 绘制/导出使用：
 *  - 源图旋转 rotation 后尺寸为 rSize；
 *  - crop 归一化相对 rSize；
 *  - 先在旋转后坐标系切出 crop 像素矩形 (cx,cy,cw,ch)；
 *  - 旋转回源图坐标系得到 sctx/sx/sy/sw/sh（drawImage 的 9 参数源矩形）。
 */
export function cropToSourceRect(
  srcW: number,
  srcH: number,
  rotation: Rotation,
  crop: CropRect,
): { sx: number; sy: number; sw: number; sh: number } {
  const r = rotatedSize(srcW, srcH, rotation)
  const cw = crop.w * r.w
  const ch = crop.h * r.h
  // 旋转后坐标系中的裁剪原点
  const rx = crop.x * r.w
  const ry = crop.y * r.h
  // 映射回"未旋转源图"坐标系（以源图左上为原点，画布为顺时针旋转 ctx.rotate(θ)）。
  // 推导：源点(u,v) 经 θ 顺时针旋转后落到的显示坐标为 D=(W-v,H-u) 等，取逆得源矩形。
  let sx = 0
  let sy = 0
  let sw = cw
  let sh = ch
  switch (rotation) {
    case 0:
      sx = rx
      sy = ry
      break
    case 90:
      // D=(H-v, u) ⇒ u=D_Y, v=H-D_X
      sx = ry
      sy = srcH - (rx + cw)
      sw = ch
      sh = cw
      break
    case 180:
      // D=(W-u, H-v)
      sx = srcW - (rx + cw)
      sy = srcH - (ry + ch)
      break
    case 270:
      // D=(v, W-u) ⇒ u=W-D_Y, v=D_X
      sx = srcW - (ry + ch)
      sy = rx
      sw = ch
      sh = cw
      break
  }
  return { sx, sy, sw, sh }
}

/**
 * 把旋转+裁剪后的结果绘制到目标 canvas（outW×outH，目标显示/导出像素）。
 *
 * 统一管线（支持任意角度）：裁剪矩形定义在「旋转后显示空间」（外接矩形 rotatedSize），
 * 绘制时通过画布变换把显示空间中的裁剪区映射到输出画布：
 *   源像素 → rotate(θ)（居中旋转到显示空间）→ 平移到裁剪区中心 → 缩放 → 输出中心。
 * 正交角（0/90/180/270）与任意角度走同一套数学，预览与导出结果必然一致，
 * 且 90/270 不再出现「CSS/object-fit 先裁剪再旋转」的比例失真问题。
 *
 * 注意：outW/outH 的比例必须等于「旋转后裁剪区域」的比例（调用方保证）。
 */
export function drawRotatedCropped(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  srcW: number,
  srcH: number,
  rotation: Rotation,
  crop: CropRect,
  outW: number,
  outH: number,
): void {
  const rSize = rotatedSize(srcW, srcH, rotation)
  const cw = crop.w * rSize.w
  const ch = crop.h * rSize.h
  if (cw <= 0 || ch <= 0) return
  // 裁剪区中心（显示空间坐标，原点=显示空间左上角）→ 转为相对显示中心的偏移。
  // 变换链中图像以显示中心为原点绘制（rotate 后 drawImage(-W/2,-H/2)），
  // 因此平移量必须是「裁剪区中心 − 显示空间中心」，否则图像整体偏移半个画布，
  // 只有四分之一落在输出内（照片显示不完整的根因）。
  const ccx = crop.x * rSize.w + cw / 2 - rSize.w / 2
  const ccy = crop.y * rSize.h + ch / 2 - rSize.h / 2
  const s = outW / cw // 裁剪区铺满输出的缩放系数
  ctx.save()
  ctx.translate(outW / 2, outH / 2)
  ctx.scale(s, s)
  ctx.translate(-ccx, -ccy)
  ctx.rotate((rotation * Math.PI) / 180)
  ctx.drawImage(source, -srcW / 2, -srcH / 2, srcW, srcH)
  ctx.restore()
}
