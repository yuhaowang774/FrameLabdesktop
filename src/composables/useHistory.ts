// 历史记录 composable：参数快照（用户保存） + 操作历史栈（撤销/重做）。
// 操作栈在 frameConfig 每次变更后自动提交（节流合并），供撤销/重做使用。
import { ref, type Ref } from 'vue'
import type { FrameConfig } from '../core/types'
import { MAX_HISTORY } from '../core/constants'
import { useFrameConfig, registerCommit } from './useFrameConfig'

// 注册提交钩子：frameConfig 变更后自动入操作历史栈
registerCommit((key) => commitHistory(key))

const STORAGE_KEY = 'photoFrameHistory'

export interface HistoryItem {
  name: string
  config: FrameConfig
  ts: number
}

// ===== 用户快照（持久化） =====
const items: Ref<HistoryItem[]> = ref([])

function read(): HistoryItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as HistoryItem[]) : []
  } catch {
    return []
  }
}
function write(list: HistoryItem[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(list.slice(0, MAX_HISTORY)))
}

export function loadHistory() {
  items.value = read()
}
export function saveHistory(name: string, current: FrameConfig) {
  const trimmed = name.trim()
  if (!trimmed) return
  const snapshot = JSON.parse(JSON.stringify(current)) as FrameConfig
  const list = read()
  list.unshift({ name: trimmed, config: snapshot, ts: Date.now() })
  write(list)
  items.value = read()
}
export function removeHistory(ts: number) {
  write(read().filter((i) => i.ts !== ts))
  items.value = read()
}
export function clearHistory() {
  localStorage.removeItem(STORAGE_KEY)
  items.value = []
}

// ===== 操作历史栈（撤销/重做，内存态） =====
const past: Ref<FrameConfig[]> = ref([])
const future: Ref<FrameConfig[]> = ref([])
let lastCommit = 0
let lastKey = ''

function snapshot(): FrameConfig {
  const { state } = useFrameConfig()
  return JSON.parse(JSON.stringify(state)) as FrameConfig
}

/** 提交一次状态变更到历史栈（节流：400ms 内同字段合并） */
export function commitHistory(key = ''): void {
  const now = Date.now()
  if (now - lastCommit < 400 && key && key === lastKey) return
  lastCommit = now
  lastKey = key
  past.value.push(snapshot())
  if (past.value.length > MAX_HISTORY) past.value.shift()
  future.value = []
}

export function undo(): void {
  const { loadConfig } = useFrameConfig()
  if (!past.value.length) return
  future.value.push(snapshot())
  const prev = past.value.pop() as FrameConfig
  loadConfig(prev)
}
export function redo(): void {
  const { loadConfig } = useFrameConfig()
  if (!future.value.length) return
  past.value.push(snapshot())
  const next = future.value.pop() as FrameConfig
  loadConfig(next)
}

export function useHistory() {
  const { loadConfig } = useFrameConfig()

  function restore(item: HistoryItem) {
    loadConfig({ ...item.config })
  }

  return {
    items,
    loadHistory,
    saveHistory,
    removeHistory,
    clearHistory,
    restore,
    undo,
    redo,
    canUndo: () => past.value.length > 0,
    canRedo: () => future.value.length > 0,
  }
}
