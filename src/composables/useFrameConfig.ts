// 核心数据流：全局唯一 frameConfig 响应式状态（预览与导出共享单一数据源）
import { reactive, readonly } from 'vue'
import { defaultFrameConfig, type FrameConfig } from '../core/types'

// 模块级单例，保证所有组件与 composable 共享同一份状态
const state = reactive<FrameConfig>({ ...defaultFrameConfig })

export function useFrameConfig() {
  /** 读：返回只读响应式引用（组件内解构需用 toRefs 或保持对象访问） */
  const config = readonly(state)

  /** 整体替换（用于历史恢复 / 预设应用），保留未列出的默认字段 */
  function loadConfig(partial: Partial<FrameConfig>): void {
    Object.assign(state, defaultFrameConfig, partial)
  }

  /** 局部更新 */
  function patch(partial: Partial<FrameConfig>): void {
    Object.assign(state, partial)
  }

  /** 重置为默认 */
  function reset(): void {
    Object.assign(state, defaultFrameConfig)
  }

  return { config, state, loadConfig, patch, reset }
}
