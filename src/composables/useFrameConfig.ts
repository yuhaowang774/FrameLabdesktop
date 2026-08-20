// 核心数据流：全局唯一 frameConfig 响应式状态（预览与导出共享单一数据源）
import { reactive } from 'vue'
import { defaultFrameConfig, type FrameConfig } from '../core/types'

// 模块级单例，保证所有组件与 composable 共享同一份状态
const state = reactive<FrameConfig>({ ...defaultFrameConfig })

// 提交钩子：由 useHistory 注册，参数变更后自动入操作历史栈
type CommitFn = (key?: string) => void
let commitHook: CommitFn | null = null
export function registerCommit(fn: CommitFn): void {
  commitHook = fn
}

export function useFrameConfig() {
  /** 整体替换（用于历史恢复 / 预设应用），保留未列出的默认字段 */
  function loadConfig(partial: Partial<FrameConfig>): void {
    Object.assign(state, defaultFrameConfig, partial)
    commitHook?.('loadConfig')
  }

  /** 局部更新 */
  function patch(partial: Partial<FrameConfig>): void {
    Object.assign(state, partial)
    commitHook?.(Object.keys(partial)[0])
  }

  /** 重置为默认 */
  function reset(): void {
    Object.assign(state, defaultFrameConfig)
    commitHook?.('reset')
  }

  return { state, loadConfig, patch, reset }
}
