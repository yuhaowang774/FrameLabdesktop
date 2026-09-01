// GPU 首选项（仅桌面端实际生效）：
// - 三种模式：auto = 由 Windows 决定（不干预注册表）；dgpu = 独显高性能（GpuPreference=2）；
//   igpu = 核显节能（GpuPreference=1）。
// - 偏好持久化在 localStorage（'framelab-gpu-pref'），启动时按模式重申注册表。
// - WebView2 的实际 GPU 选择最终由 Windows/驱动决定；未生效时可在首选项中一键
//   打开 Windows 图形设置（ms-settings:graphics）手动指定。
import { isTauri } from './env'

export type GpuPrefMode = 'auto' | 'dgpu' | 'igpu'

export const GPU_PREF_KEY = 'framelab-gpu-pref'

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(cmd, args)
}

/** 读取 GPU 首选项模式（含旧版布尔值兼容：'0'→auto，缺省→dgpu） */
export function getGpuPrefMode(): GpuPrefMode {
  try {
    const v = localStorage.getItem(GPU_PREF_KEY)
    if (v === 'dgpu' || v === 'igpu' || v === 'auto') return v
    if (v === '0') return 'auto'
    return 'dgpu'
  } catch {
    return 'dgpu'
  }
}

/** 设置 GPU 首选项模式：写 localStorage + 桌面端写注册表（重启应用后生效） */
export async function setGpuPrefMode(mode: GpuPrefMode): Promise<void> {
  try {
    localStorage.setItem(GPU_PREF_KEY, mode)
  } catch {
    /* ignore */
  }
  if (!isTauri) return
  await tauriInvoke('set_gpu_preference_mode', { mode })
}

/**
 * 启动时按用户模式重申 GPU 首选项：
 * - igpu：直接写节能（无需独显检测）；
 * - dgpu：检测到独显才写高性能；
 * - auto：不干预。
 */
export async function applyGpuPreferenceOnStartup(): Promise<void> {
  if (!isTauri) return
  const mode = getGpuPrefMode()
  try {
    if (mode === 'igpu') {
      await tauriInvoke('set_gpu_preference_mode', { mode })
      return
    }
    if (mode !== 'dgpu') return
    const [hasDgpu] = await detectDiscreteGpu()
    if (hasDgpu) await tauriInvoke('set_gpu_preference_mode', { mode: 'dgpu' })
  } catch {
    /* 查询/写入失败：不打扰启动 */
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
