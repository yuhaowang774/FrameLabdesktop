// PS 式图层状态管理（全局单例）。
// 相框 = 画板(artboard) + 背景(bg) + 照片(photo) + 信息(info) 四层自下而上叠加。
// - selectedLayer：当前在画布中选中的图层，选中后显示变换手柄。
// - layerVisible：各图层可见性，控制预览与导出合成是否参与。
// 画板层常驻且不可隐藏（hideable=false）。
import { ref, computed } from 'vue'
import type { LayerDef, LayerId } from '../core/types'
import { useFrameConfig } from './useFrameConfig'

/** 图层定义（自底向上） */
export const LAYERS: LayerDef[] = [
  { id: 'artboard', label: '画板', z: 0, hideable: false },
  { id: 'bg', label: '背景图层', z: 1, hideable: true },
  { id: 'photo', label: '照片图层', z: 2, hideable: true },
  { id: 'info', label: '信息图层', z: 3, hideable: true },
]

// 模块级单例
const selectedLayer = ref<LayerId>('photo')
const { state, patch } = useFrameConfig()

function isVisible(id: LayerId): boolean {
  if (id === 'artboard') return true
  return state.layerVisible[id] !== false
}

function toggleVisible(id: LayerId) {
  if (id === 'artboard') return
  patch({ layerVisible: { ...state.layerVisible, [id]: !isVisible(id) } })
}

function select(id: LayerId | null) {
  selectedLayer.value = id ?? 'artboard'
}

// 面板按 z 倒序展示（顶层在上，符合 PS 习惯）
const panelLayers = computed(() => [...LAYERS].sort((a, b) => b.z - a.z))

export function useLayers() {
  return {
    LAYERS,
    panelLayers,
    selectedLayer,
    isVisible,
    toggleVisible,
    select,
  }
}
