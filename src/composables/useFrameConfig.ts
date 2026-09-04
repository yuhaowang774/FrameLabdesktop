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

// 提交抑制：导入照片 / 切换照片等「非用户编辑」的批量参数变化不应产生历史节点。
// 用法：suspendCommit(true) → 修改 → suspendCommit(false)。计数式设计，支持嵌套。
let suspendDepth = 0
export function suspendCommit(suspend: boolean): void {
  if (suspend) suspendDepth++
  else if (suspendDepth > 0) suspendDepth--
}

export function useFrameConfig() {
  /** 整体替换（用于历史恢复 / 预设应用），保留未列出的默认字段 */
  function loadConfig(partial: Partial<FrameConfig>): void {
    // 旧数据归一化：logoColor 任何非 hex 哨兵值（'auto' / 历史 'brand' 等）→ 白色。
    // 渲染端 logoAutoColor 已严格校验 hex 兜底，这里再归一保持 UI（ColorField）展示标准色值。
    const lc = partial.logoColor
    const norm =
      typeof lc === 'string' && !/^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(lc.trim())
        ? { ...partial, logoColor: '#ffffff' }
        : partial
    Object.assign(state, defaultFrameConfig, norm)
    if (suspendDepth === 0) commitHook?.('loadConfig')
  }

  /** 局部更新 */
  function patch(partial: Partial<FrameConfig>): void {
    Object.assign(state, partial)
    if (suspendDepth === 0) commitHook?.(Object.keys(partial)[0])
  }

  /** 重置为默认 */
  function reset(): void {
    Object.assign(state, defaultFrameConfig)
    if (suspendDepth === 0) commitHook?.('reset')
  }

  return { state, loadConfig, patch, reset, suspendCommit }
}
