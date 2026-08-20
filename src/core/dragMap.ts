// 将拖拽产生的矩形映射回 FrameConfig 字段，以及从配置反推背景矩形（单一真源）。
import type { Rect } from './rectMath'
import type { FrameConfig } from './types'

/** 背景平移范围：保证放大后的背景始终覆盖整个容器，不留白边 */
export function clampBgOffset(bgScale: number, offset: number, coverSize: number, containerSize: number): number {
  const bgSize = coverSize * bgScale
  if (bgSize <= containerSize) return 0 // 背景比容器小（或相等）→ 不允许平移
  const halfRange = (bgSize - containerSize) / 2
  return Math.max(-halfRange, Math.min(halfRange, offset))
}

/**
 * 由拖拽后的照片矩形（设计坐标系）映射回配置。
 * - photoX / photoY：左上角设计坐标（保留小数，避免取整漂移）
 * - scale：相对可用宽度的百分比，钳制 50~100
 */
export function mapPhotoRectToConfig(rect: Rect, availW: number, _padding: number): Partial<FrameConfig> {
  // 关键：scale 不取整，保留浮点精度。否则 photoRect 重算时 width=availW*round(scale)/100
  // 与拖拽的 rect.width 出现 ±5px 误差，而 photoX/photoY 又是精确浮点，三者不自洽，
  // 缩放（尤其 w/n/角点手柄，锚点在对边）时照片对边与中心随之跳动。
  const scale = Math.max(50, Math.min(100, (rect.width / availW) * 100))
  return {
    photoX: rect.left,
    photoY: rect.top,
    scale,
  }
}

/**
 * 由拖拽后的背景矩形（设计坐标系）映射回配置。
 * - bgScale：相对 cover 宽度的放大比，钳制 0.5~4
 * - bgOffsetX / bgOffsetY：中心相对容器中心的设计位移，并钳制在覆盖范围内
 */
export function mapBgRectToConfig(
  rect: Rect,
  containerW: number,
  containerH: number,
  coverW: number,
): { bgScale: number; bgOffsetX: number; bgOffsetY: number } {
  const centerX = rect.left + rect.width / 2
  const centerY = rect.top + rect.height / 2
  const bgScale = Math.max(0.5, Math.min(4, rect.width / coverW))
  // 偏移相对内容区中心（内容区坐标系，与预览 DOM 绝对定位一致）
  const rawOffsetX = centerX - containerW / 2
  const rawOffsetY = centerY - containerH / 2
  // 真实 cover 尺寸（含缩放），用于钳制平移范围
  const coverH = coverW * (rect.height / rect.width)
  const offsetX = clampBgOffset(bgScale, rawOffsetX, coverW, containerW)
  const offsetY = clampBgOffset(bgScale, rawOffsetY, coverH, containerH)
  return { bgScale, bgOffsetX: offsetX, bgOffsetY: offsetY }
}

/**
 * 背景矩形单一真源：由配置字段反推预览选择框。
 * 与 bgRenderer.drawBlurredBackground 的 cover 计算保持一致（以 coverW 为基准 + bgScale）。
 */
export function bgRectFromConfig(
  bgScale: number,
  bgOffsetX: number,
  bgOffsetY: number,
  coverW: number,
  aspect: number,
  containerW: number,
  containerH: number,
): Rect {
  const w = coverW * bgScale
  const h = w * aspect // = coverW * bgScale * aspect
  const cx = containerW / 2 + bgOffsetX
  const cy = containerH / 2 + bgOffsetY
  return { left: cx - w / 2, top: cy - h / 2, width: w, height: h }
}
