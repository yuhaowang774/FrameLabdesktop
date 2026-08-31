// 应用偏好设置：localStorage 持久化，供「首选项」弹窗读写、各功能模块读取。
// 与 GPU 偏好（platform/gpu.ts）同层，但统一收敛在首选项 UI 中管理。
const KEYS = {
  exportFormat: 'framelab-pref-export-format',
  exportQuality: 'framelab-pref-export-quality',
  historyLimit: 'framelab-pref-history-limit',
  startupTemplate: 'framelab-pref-startup-template',
} as const

const DEFAULT_HISTORY_LIMIT = 100

function read(key: string, fallback: string): string {
  try {
    return localStorage.getItem(key) ?? fallback
  } catch {
    return fallback
  }
}
function write(key: string, v: string): void {
  try {
    localStorage.setItem(key, v)
  } catch {
    /* localStorage 不可用时静默忽略 */
  }
}

// ===== 导出：默认格式与 JPG 画质 =====
export type ExportFormatPref = 'png' | 'jpg'
export function getExportFormatPref(): ExportFormatPref {
  return read(KEYS.exportFormat, 'png') === 'jpg' ? 'jpg' : 'png'
}
export function setExportFormatPref(v: ExportFormatPref): void {
  write(KEYS.exportFormat, v)
}

export function getExportQualityPref(): number {
  const n = Number(read(KEYS.exportQuality, '0.95'))
  return Number.isFinite(n) ? Math.min(1, Math.max(0.5, n)) : 0.95
}
export function setExportQualityPref(v: number): void {
  write(KEYS.exportQuality, String(v))
}

// ===== 编辑：历史记录上限 =====
export const HISTORY_LIMIT_OPTIONS = [20, 50, 100, 200] as const
export function getHistoryLimitPref(): number {
  const n = Number(read(KEYS.historyLimit, String(DEFAULT_HISTORY_LIMIT)))
  return (HISTORY_LIMIT_OPTIONS as readonly number[]).includes(n) ? n : DEFAULT_HISTORY_LIMIT
}
export function setHistoryLimitPref(v: number): void {
  write(KEYS.historyLimit, String(v))
}

// ===== 编辑：启动默认模板（内置模板 id；空串 = 不应用） =====
export function getStartupTemplatePref(): string {
  return read(KEYS.startupTemplate, '')
}
export function setStartupTemplatePref(v: string): void {
  write(KEYS.startupTemplate, v)
}
