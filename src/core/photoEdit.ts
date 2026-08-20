// 照片编辑：旋转 + 裁剪（手机式）。纯函数便于测试。
// crop 采用"归一化矩形"（相对旋转后图像的 0..1 比例），与具体像素解耦，
// 在预览与导出中按比例套用，保证两者一致。

export type { PhotoCrop, PhotoRotation } from '../core/types'
export type Rotation = 0 | 90 | 180 | 270

/** 旋转后图像尺寸（90/270 交换宽高） */
export function rotatedSize(w: number, h: number, rotation: Rotation): { w: number; h: number } {
  return rotation === 90 || rotation === 270 ? { w: h, h: w } : { w, h }
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
 * 处理旋转变换（translate+rotate），使最终图像为正向。
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
  const { sx, sy, sw, sh } = cropToSourceRect(srcW, srcH, rotation, crop)
  ctx.save()
  ctx.translate(outW / 2, outH / 2)
  ctx.rotate((rotation * Math.PI) / 180)
  // 目标矩形 = 输出画布 outW×outH（而非源图像素尺寸），
  // 把旋转+裁剪后的源区域缩放铺满画布，保证完整显示（预览/导出一致）。
  // 注意：outW/outH 的比例必须等于"旋转后裁剪区域"的比例（调用方保证）。
  ctx.drawImage(source, sx, sy, sw, sh, -outW / 2, -outH / 2, outW, outH)
  ctx.restore()
}
