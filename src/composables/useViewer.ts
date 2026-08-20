// 主画布查看器状态：缩放、平移、Before/After 对比、标尺显示。跨底部工具栏与画布共享。
import { ref } from 'vue'

export type CompareMode = 'off' | 'split' | 'slide'

const zoom = ref(1) // 用户缩放倍率（叠加在 fit 之上）
const panX = ref(0)
const panY = ref(0)
const compare = ref<CompareMode>('off')
const showRulers = ref(false)
const beforeVisible = ref(true) // Before/After 对比中，是否显示原图

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
function setCompare(m: CompareMode): void {
  compare.value = m
}
function toggleRulers(): void {
  showRulers.value = !showRulers.value
}
function toggleBefore(): void {
  beforeVisible.value = !beforeVisible.value
}

export function useViewer() {
  return {
    zoom,
    panX,
    panY,
    compare,
    showRulers,
    beforeVisible,
    resetView,
    setZoom,
    zoomBy,
    setPan,
    setCompare,
    toggleRulers,
    toggleBefore,
  }
}
