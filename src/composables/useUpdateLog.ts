// 更新后弹窗检测：启动时对比「当前运行版本」与「上次记录版本」（localStorage）。
// - 首次安装（无记录）：只写记录，不弹窗（新用户不需要"更新了什么"）
// - 版本升级：返回本次更新条目（供弹窗高亮），并写回新版本
// - 版本相同 / 降级：只写回，不弹窗
import { compareVersions, findUpdateEntry, type UpdateEntry } from '../core/updateLog'

const KEY = 'framelab-last-version'

export interface UpdateHit {
  /** 本次更新条目（版本号与当前运行版本一致） */
  entry: UpdateEntry
  /** 升级前的版本号 */
  from: string
}

/** 读取上次记录的版本号（无记录返回空串） */
export function getLastVersion(): string {
  try {
    return localStorage.getItem(KEY) ?? ''
  } catch {
    return ''
  }
}

function setLastVersion(v: string): void {
  try {
    localStorage.setItem(KEY, v)
  } catch {
    /* 存储不可用时静默：下次启动会再次弹窗，可接受 */
  }
}

/**
 * 启动检测：传入当前运行版本。
 * 命中升级（有日志条目）返回 { entry, from }，否则返回 null。
 */
export function detectUpdate(current: string): UpdateHit | null {
  const last = getLastVersion()
  setLastVersion(current)
  if (!last) return null // 首次安装
  if (compareVersions(current, last) <= 0) return null // 相同版本 / 降级
  const entry = findUpdateEntry(current)
  if (!entry) return null // 升级到未入日志的版本（理论不发生）：不弹
  return { entry, from: last }
}
