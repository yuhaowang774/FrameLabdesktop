// 导出偏好单例：格式 / JPG 质量 / 超采样倍率，持久化到 localStorage
import { reactive, watch } from 'vue'
import type { ExportFormat } from '../core/exporter'

export interface ExportOptionsState {
  format: ExportFormat
  jpgQuality: number
  scale: number
}

const STORAGE_KEY = 'frame-export-options'

const defaults: ExportOptionsState = {
  format: 'png',
  jpgQuality: 0.95,
  scale: 1,
}

function load(): ExportOptionsState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) return { ...defaults, ...JSON.parse(raw) }
  } catch {
    /* 忽略损坏数据 */
  }
  return { ...defaults }
}

const state = reactive<ExportOptionsState>(load())

watch(
  state,
  (val) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(val))
    } catch {
      /* 忽略持久化失败 */
    }
  },
  { deep: true },
)

export function useExportOptions() {
  function reset(): void {
    Object.assign(state, defaults)
  }
  return { options: state, reset }
}
