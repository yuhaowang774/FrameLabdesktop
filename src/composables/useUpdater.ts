// 启动自动检查更新（安装版链路）：延迟静默检查 → 发现新版本供 UI（右下角提醒卡片）主动提示。
// - 检查失败、被限流、已是最新：全部静默，不打扰使用；
// - 「跳过此版本」持久化记录，后续更高版本仍会提醒；
// - 检查 / 下载安装复用 @tauri-apps/plugin-updater（更新源与签名公钥见 tauri.conf.json plugins.updater）；
// - 仅桌面端生效（网页端无更新概念，调用即空操作）。
import { ref } from 'vue'
import { isTauri } from '../platform/env'
import { compareVersions } from '../core/updateLog'
import { getAutoUpdatePref } from './usePrefs'

/** 启动后延迟：避开首屏（图库加载 / 大图解码），8 秒后静默发起 */
const CHECK_DELAY_MS = 8000
/** 检查请求超时：网络不可用时快速失败，避免请求悬挂 */
const CHECK_TIMEOUT_MS = 15000
const SKIP_KEY = 'framelab-skip-version'

export interface AvailableUpdate {
  version: string
  /** 更新说明（发布脚本 latest.json 的 notes 字段） */
  notes: string
  /** 发布日期（ISO 字符串） */
  date: string
}

export type InstallState = 'idle' | 'downloading' | 'installing' | 'restarting' | 'error'

// ===== 跳过版本（localStorage 持久化）=====
export function getSkipVersion(): string {
  try {
    return localStorage.getItem(SKIP_KEY) ?? ''
  } catch {
    return ''
  }
}

/** 记录「跳过此版本」（null = 清除） */
export function setSkipVersion(v: string | null): void {
  try {
    if (v) localStorage.setItem(SKIP_KEY, v)
    else localStorage.removeItem(SKIP_KEY)
  } catch {
    /* localStorage 不可用：本次会话仍按内存态处理，下次启动不再跳过 */
  }
}

/** 是否提醒该版本：版本有效且高于已跳过版本才提醒（空版本号不提醒） */
export function shouldNotifyVersion(latest: string, skipped: string): boolean {
  if (!latest) return false
  if (!skipped) return true
  return compareVersions(latest, skipped) > 0
}

// ===== 模块级单例状态（提醒卡片与首选项共享）=====
const available = ref<AvailableUpdate | null>(null)
const installState = ref<InstallState>('idle')
const installProgress = ref<number | null>(null)
const installError = ref('')
/** 后台检查互斥：启动调度与开关启用触发的检查不并发 */
let checking = false
/** 启动调度幂等：同一会话只调度一次（组件可能在模块切换中反复挂载） */
let startupScheduled = false

/** 静默检查一次：发现更高版本且未跳过时写入 available（供提醒卡片显示）。失败静默返回 null。 */
export async function checkInBackground(): Promise<AvailableUpdate | null> {
  if (!isTauri || checking) return null
  checking = true
  try {
    const { check } = await import('@tauri-apps/plugin-updater')
    const update = await check({ timeout: CHECK_TIMEOUT_MS })
    if (!update) return null
    const hit: AvailableUpdate = {
      version: update.version,
      notes: update.body ?? '',
      date: update.date ?? '',
    }
    if (!shouldNotifyVersion(hit.version, getSkipVersion())) return null
    available.value = hit
    return hit
  } catch {
    return null // 网络异常 / 被限流：静默，不打扰
  } finally {
    checking = false
  }
}

/** 启动调度（App 挂载调用）：读偏好 → 延迟 → 静默检查；幂等。 */
export function scheduleStartupUpdateCheck(): void {
  if (startupScheduled || !isTauri) return
  startupScheduled = true
  if (!getAutoUpdatePref()) return
  setTimeout(() => {
    void checkInBackground()
  }, CHECK_DELAY_MS)
}

/** 稍后：关闭提醒（本次会话不再显示；下次启动会重新检查） */
export function dismissUpdate(): void {
  available.value = null
}

/** 跳过此版本：持久化后关闭提醒（该版本不再提示，更高版本仍会提示） */
export function skipUpdateVersion(): void {
  const v = available.value?.version
  if (v) setSkipVersion(v)
  available.value = null
}

/**
 * 立即更新：重新检查 → downloadAndInstall（进度写入 installProgress）→ 重启应用。
 * 下载/安装期间由 installState 驱动卡片状态；失败进入 error（可重试）。
 */
export async function installUpdate(): Promise<void> {
  if (
    installState.value === 'downloading' ||
    installState.value === 'installing' ||
    installState.value === 'restarting'
  ) {
    return
  }
  if (!available.value) return
  installState.value = 'downloading'
  installProgress.value = 0
  installError.value = ''
  try {
    const { check } = await import('@tauri-apps/plugin-updater')
    const update = await check({ timeout: CHECK_TIMEOUT_MS })
    if (!update) {
      // 两次检查之间版本被撤下（理论不发生）：按已是最新处理
      available.value = null
      installState.value = 'idle'
      return
    }
    let total = 0
    let received = 0
    await update.downloadAndInstall((event) => {
      if (event.event === 'Started') {
        total = event.data.contentLength ?? 0
      } else if (event.event === 'Progress') {
        received += event.data.chunkLength
        if (total > 0) installProgress.value = Math.min(99, Math.round((received / total) * 100))
      } else if (event.event === 'Finished') {
        installState.value = 'installing'
      }
    })
    // Windows 静默安装：downloadAndInstall 返回即安装完成，复用既有 restart_app 拉起新版本
    installState.value = 'restarting'
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('restart_app')
  } catch (err) {
    installState.value = 'error'
    installError.value = String((err as Error)?.message ?? err)
  }
}

/** 组合式入口：提醒卡片与首选项共用同一份模块级状态 */
export function useUpdater() {
  return {
    available,
    installState,
    installProgress,
    installError,
    installUpdate,
    dismissUpdate,
    skipUpdateVersion,
  }
}

// ===== 开发演示（仅 DEV 构建，不进入正式包）=====
// 用途：本地预览「发现新版本」提醒卡片 UI（线上无更高版本时真实检查不会命中）。
// 用法：控制台执行 localStorage.setItem('framelab-demo-update','0.2.9') 后刷新页面；
// 清除：localStorage.removeItem('framelab-demo-update')。
// 注意：演示数据不触发真实下载——点「立即更新」会重新联网检查，线上无更高版本时卡片自动收起。
if (import.meta.env.DEV) {
  try {
    const demo = localStorage.getItem('framelab-demo-update')
    if (demo) {
      available.value = {
        version: demo,
        notes:
          '（演示数据）「发现新版本」提醒卡片预览。正式环境由更新源（latest.json）提供真实版本号与更新说明。',
        date: new Date().toISOString(),
      }
    }
  } catch {
    /* localStorage 不可用：忽略 */
  }
}
