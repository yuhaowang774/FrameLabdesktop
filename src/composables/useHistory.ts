// 历史记录 composable（阶段 12）
// 从 HistoryList 内联逻辑抽离为模块级单例，统一 localStorage 读写。
// 历史项保存当前 FrameConfig 的纯快照（深拷贝），支持保存/恢复/删除/清空。

import { ref, type Ref } from 'vue'
import type { FrameConfig } from '../core/types'
import { MAX_HISTORY } from '../core/constants'
import { useFrameConfig } from './useFrameConfig'

const STORAGE_KEY = 'photoFrameHistory'

export interface HistoryItem {
  name: string
  config: FrameConfig
  ts: number
}

// 模块级单例：所有组件共享同一份历史
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

/** 启动加载（在 main 或首次挂载时调用） */
export function loadHistory() {
  items.value = read()
}

/** 保存当前配置快照（深拷贝，避免引用 reactive 对象） */
export function saveHistory(name: string, current: FrameConfig) {
  const trimmed = name.trim()
  if (!trimmed) return
  const snapshot = JSON.parse(JSON.stringify(current)) as FrameConfig
  const list = read()
  list.unshift({ name: trimmed, config: snapshot, ts: Date.now() })
  write(list)
  items.value = read()
}

/** 按时间戳删除 */
export function removeHistory(ts: number) {
  write(read().filter((i) => i.ts !== ts))
  items.value = read()
}

/** 清空全部历史 */
export function clearHistory() {
  localStorage.removeItem(STORAGE_KEY)
  items.value = []
}

export function useHistory() {
  const { loadConfig } = useFrameConfig()

  function restore(item: HistoryItem) {
    // 恢复时合并快照，保证缺字段时回退默认值
    loadConfig({ ...item.config })
  }

  return {
    items,
    loadHistory,
    saveHistory,
    removeHistory,
    clearHistory,
    restore,
  }
}
