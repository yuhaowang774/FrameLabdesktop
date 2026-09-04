// 主画布查看器状态：缩放、平移。跨底部工具栏与画布共享。
import { ref } from 'vue'

const zoom = ref(1) // 用户缩放倍率（叠加在 fit 之上）
const panX = ref(0)
const panY = ref(0)

function resetView(): void {
  zoom.value = 1
  panX.value = 0
  panY.value = 0
}
function setZoom(z: number): void {
  zoom.value = Math.max(0.1, Math.min(8, z))
}
function zoomBy(delta: number): void {
  setZoom(zoom.value * (1 + delta))
}
/**
 * 锚点缩放：以画布上相对布局原点的锚点 (anchorDx, anchorDy) 为中心缩放。
 * 平移修正基于「实际生效倍率」（钳制后 zoom/原 zoom），而非请求的原始倍率——
 * 到达 10%~800% 上限/下限后继续滚轮时倍率不变，平移不动，画面不会偏移。
 */
function setZoomAt(z: number, anchorDx: number, anchorDy: number): void {
  const prev = zoom.value
  zoom.value = Math.max(0.1, Math.min(8, z))
  const eff = zoom.value / prev
  if (eff === 1) return // 已达上限/下限，倍率未变：不做平移修正，画面保持不动
  panX.value -= (eff - 1) * anchorDx
  panY.value -= (eff - 1) * anchorDy
}
function setPan(x: number, y: number): void {
  panX.value = x
  panY.value = y
}

export function useViewer() {
  return {
    zoom,
    panX,
    panY,
    resetView,
    setZoom,
    zoomBy,
    setZoomAt,
    setPan,
  }
}
