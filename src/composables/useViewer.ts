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
    setPan,
  }
}
