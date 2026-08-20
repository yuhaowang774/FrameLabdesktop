// 双端持久化适配层（保持同步 API，业务代码无感知）：
// - 网页端：直接读写 localStorage。
// - Tauri 桌面端：模块加载阶段（顶层 await）从 Rust 后端 AppData 目录预载
//   全部 JSON 到内存，随后同步读内存；写操作更新内存并防抖落盘，
//   每个 key 对应 AppData 下一个 JSON 文件（见 src-tauri/src/lib.rs）。
//
// 注意：main.ts 必须把本模块放在所有业务模块之前 import，
// 保证各 composable 模块级初始化读档时数据已就绪。
import { isTauri } from './env'

const memory = new Map<string, string>()
const pending = new Map<string, string | null>() // null = 待删除
let flushTimer: number | null = null

/** 桌面端需要持久化到 AppData 的 key 清单（与各 composable 的 STORAGE_KEY 对应） */
const MANAGED_KEYS = [
  'frame-templates',
  'photoFrameHistory',
  'frame-ui-layout',
  'frame-export-options',
  'framelab-last-folder',
]

async function preload(): Promise<void> {
  const { invoke } = await import('@tauri-apps/api/core')
  await Promise.all(
    MANAGED_KEYS.map(async (k) => {
      try {
        const content = await invoke<string | null>('read_app_json', { filename: k })
        if (content != null) memory.set(k, content)
      } catch {
        /* 读取失败按空处理 */
      }
    }),
  )
}

async function flush(): Promise<void> {
  flushTimer = null
  const { invoke } = await import('@tauri-apps/api/core')
  for (const [k, v] of pending) {
    try {
      if (v === null) await invoke('clear_app_json', { filename: k })
      else await invoke('write_app_json', { filename: k, content: v })
    } catch {
      /* 落盘失败：保留在 pending，下次写入时重试 */
      return
    }
  }
  pending.clear()
}

function scheduleFlush(): void {
  if (flushTimer != null) return
  flushTimer = window.setTimeout(() => void flush(), 400)
}

// 桌面端顶层 await：阻塞依赖本模块的业务模块初始化，确保读档顺序正确
if (isTauri) {
  await preload()
}

export function storageGet(key: string): string | null {
  if (!isTauri) return localStorage.getItem(key)
  return memory.get(key) ?? null
}

export function storageSet(key: string, value: string): void {
  if (!isTauri) {
    localStorage.setItem(key, value)
    return
  }
  memory.set(key, value)
  pending.set(key, value)
  scheduleFlush()
}

export function storageRemove(key: string): void {
  if (!isTauri) {
    localStorage.removeItem(key)
    return
  }
  memory.delete(key)
  pending.set(key, null)
  scheduleFlush()
}
