// GPU 首选项（仅桌面端实际生效）：
// - 交互：检测系统显示适配器列表 → 用户下拉选择具体显卡 → 按其类型落地
//   （独显类写 GpuPreference=2 高性能，核显类写 GpuPreference=1 节能；"自动"不干预）。
// - 偏好持久化在 localStorage（'framelab-gpu-pref'，值为 'auto' 或显卡名称），启动时按名称
//   重新匹配并重申注册表；设备列表变化找不到所选显卡时回退为不干预。
// - WebView2 的实际 GPU 选择最终由 Windows/驱动决定；未生效时可在首选项中一键
//   打开 Windows 图形设置（ms-settings:graphics）手动指定。
import { isTauri } from './env'

export interface GpuInfo {
  name: string
  /** 名称启发式判定：true = 独显（NVIDIA/GeForce/Radeon RX 等） */
  discrete: boolean
}

export const GPU_PREF_KEY = 'framelab-gpu-pref'

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(cmd, args)
}

/** 列出系统全部显示适配器（仅桌面端；网页端返回空） */
export async function listGpus(): Promise<GpuInfo[]> {
  if (!isTauri) return []
  return tauriInvoke<GpuInfo[]>('list_gpus')
}

/** 读取用户选择的显卡（'auto' = 由系统决定，否则为显卡名称） */
export function getGpuSelection(): string {
  try {
    const v = localStorage.getItem(GPU_PREF_KEY) || 'auto'
    // 旧版三态/布尔值兼容：一律回退 auto，由用户重新选择
    if (v === 'dgpu' || v === 'igpu' || v === '0' || v === '1') return 'auto'
    return v
  } catch {
    return 'auto'
  }
}

/** 保存显卡选择并立即落地注册表（重启应用后由 Windows/驱动生效） */
export async function setGpuSelection(selection: string): Promise<void> {
  try {
    localStorage.setItem(GPU_PREF_KEY, selection)
  } catch {
    /* ignore */
  }
  if (!isTauri) return
  await applyGpuSelection(selection)
}

/** 把选择落地为注册表 GpuPreference：按所选显卡的类型映射高性能/节能 */
async function applyGpuSelection(selection: string): Promise<void> {
  if (!isTauri || selection === 'auto') return
  const gpus = await listGpus()
  const hit = gpus.find((g) => g.name === selection)
  if (!hit) return // 设备列表变化：找不到所选显卡则不干预
  await tauriInvoke('set_gpu_preference_mode', { mode: hit.discrete ? 'dgpu' : 'igpu' })
}

/** 启动时按用户选择重申 GPU 首选项（幂等；失败静默不打扰启动） */
export async function applyGpuPreferenceOnStartup(): Promise<void> {
  if (!isTauri) return
  try {
    await applyGpuSelection(getGpuSelection())
  } catch {
    /* ignore */
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
