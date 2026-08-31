// 独立显卡加速（仅桌面端有效）：
// - 默认行为：启动时检测独显（Win32_VideoController），有独显则自动写入 Windows
//   「GPU 首选项」注册表（GpuPreference=2 = 高性能），无需用户手动开启；
//   用户可在「文件 → 首选项」中查看状态/关闭。
// - 偏好持久化在 localStorage（'0' = 用户显式关闭），启动时按状态重申注册表
//   （注册表可能被系统或用户清理）。
// - WebView2 的实际 GPU 选择最终由 Windows/驱动决定；未生效时可在首选项中一键
//   打开 Windows 图形设置（ms-settings:graphics）手动指定。
import { isTauri } from './env'

export const GPU_PREF_KEY = 'framelab-gpu-pref'

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(cmd, args)
}

export function getGpuPrefEnabled(): boolean {
  try {
    // 默认开启：仅当用户显式关闭（'0'）时为 false
    return localStorage.getItem(GPU_PREF_KEY) !== '0'
  } catch {
    return true
  }
}

/** 设置独显加速：写 localStorage + 桌面端写注册表（重启应用后生效） */
export async function setGpuPrefEnabled(enabled: boolean): Promise<void> {
  try {
    localStorage.setItem(GPU_PREF_KEY, enabled ? '1' : '0')
  } catch {
    /* ignore */
  }
  if (!isTauri) return
  await tauriInvoke('set_gpu_preference', { enabled })
}

/**
 * 启动时默认逻辑：有独显且未被用户关闭 → 自动写入 GPU 首选项（幂等，重启后生效）。
 * 无独显（或查询失败）时不写入。
 */
export async function applyGpuPreferenceOnStartup(): Promise<void> {
  if (!isTauri) return
  if (!getGpuPrefEnabled()) return
  try {
    const [hasDgpu] = await detectDiscreteGpu()
    if (hasDgpu) await tauriInvoke('set_gpu_preference', { enabled: true })
  } catch {
    /* 查询失败：不写入，不打扰启动 */
  }
}

/** 检测系统独立显卡：返回 (是否有独显, 独显名称列表) */
export async function detectDiscreteGpu(): Promise<[boolean, string[]]> {
  if (!isTauri) return [false, []]
  return tauriInvoke<[boolean, string[]]>('detect_discrete_gpu')
}

/** 打开 Windows「图形设置」页，用户可在其中手动为应用指定高性能 GPU */
export async function openGraphicsSettings(): Promise<void> {
  if (!isTauri) return
  await tauriInvoke('open_graphics_settings')
}
