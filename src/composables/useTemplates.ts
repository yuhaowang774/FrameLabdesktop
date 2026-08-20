// 模板系统：内置预设 + 用户自定义模板（可导出/导入 JSON），对标 LrC 预设。
// 模板仅保存 FrameConfig 装饰参数（不含 photoSrc、照片变换与位置，避免污染用户主图）。
import { reactive } from 'vue'
import type { FrameConfig } from '../core/types'
import { storageGet, storageSet } from '../platform/storage'

const STORAGE_KEY = 'frame-templates'

export type TemplateCategory = 'frame' | 'background' | 'all'

export interface FrameTemplate {
  id: string
  name: string
  category: TemplateCategory
  /** 预设配置（不含 photoSrc） */
  config: Partial<FrameConfig>
  builtin?: boolean
}

// 内置预设（阶段 18）：相框/背景/全量预设
const BUILTIN: FrameTemplate[] = [
  {
    id: 'b_classic',
    name: '经典暗边框',
    category: 'all',
    builtin: true,
    config: {
      bgMode: 'default',
      blur: 40,
      padding: 80,
      scale: 90,
      radius: 20,
      shadow: 0.5,
      showLogo: true,
      showExif: true,
      showCameraModel: true,
    },
  },
  {
    id: 'b_clean',
    name: '极简无边',
    category: 'all',
    builtin: true,
    config: {
      bgMode: 'none',
      padding: 0,
      scale: 100,
      radius: 0,
      shadow: 0,
      overlayAlign: 'center',
      overlayBottom: 30,
      showLogo: true,
      showExif: true,
    },
  },
  {
    id: 'b_warm',
    name: '暖调留白',
    category: 'all',
    builtin: true,
    config: {
      bgMode: 'custom',
      blur: 10,
      padding: 120,
      scale: 80,
      radius: 8,
      shadow: 0.3,
    },
  },
  {
    id: 'f_thick',
    name: '粗边框',
    category: 'frame',
    builtin: true,
    config: { padding: 160, radius: 0, shadow: 0.7 },
  },
  {
    id: 'f_round',
    name: '圆角卡片',
    category: 'frame',
    builtin: true,
    config: { padding: 90, radius: 36, shadow: 0.6 },
  },
  {
    id: 'bg_blur',
    name: '强模糊背景',
    category: 'background',
    builtin: true,
    config: { bgMode: 'default', blur: 80 },
  },
  {
    id: 'bg_none',
    name: '无背景铺满',
    category: 'background',
    builtin: true,
    config: { bgMode: 'none', padding: 0, scale: 100 },
  },
]

const templates = reactive<FrameTemplate[]>([])

function load(): FrameTemplate[] {
  try {
    const raw = storageGet(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as FrameTemplate[]
      // 合并内置（内置始终存在），用户自定义追加
      const custom = parsed.filter((t) => !t.builtin)
      return [...BUILTIN, ...custom]
    }
  } catch {
    /* ignore */
  }
  return [...BUILTIN]
}

function persist() {
  const custom = templates.filter((t) => !t.builtin)
  try {
    storageSet(STORAGE_KEY, JSON.stringify(custom))
  } catch {
    /* ignore */
  }
}

(() => {
  templates.push(...load())
})()

function makeId(): string {
  return `tpl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

/** 仅导出与装饰相关的字段（排除主图与位置/变换，避免污染） */
function toTemplateConfig(cfg: FrameConfig): Partial<FrameConfig> {
  const { photoSrc, photoX, photoY, photoRotation, photoCrop, bgScale, bgOffsetX, bgOffsetY, ...rest } = cfg
  void photoSrc
  void photoX
  void photoY
  void photoRotation
  void photoCrop
  void bgScale
  void bgOffsetX
  void bgOffsetY
  return { ...rest }
}

export function useTemplates() {
  function saveCurrent(name: string, cfg: FrameConfig, category: TemplateCategory = 'all'): void {
    const trimmed = name.trim()
    if (!trimmed) return
    templates.unshift({
      id: makeId(),
      name: trimmed,
      category,
      config: toTemplateConfig(cfg),
    })
    persist()
  }

  function remove(id: string): void {
    const idx = templates.findIndex((t) => t.id === id)
    if (idx >= 0 && !templates[idx].builtin) {
      templates.splice(idx, 1)
      persist()
    }
  }

  function exportJson(id: string): string {
    const t = templates.find((x) => x.id === id)
    if (!t) return ''
    return JSON.stringify({ kind: 'frame-template', version: 1, template: t }, null, 2)
  }

  function importJson(text: string): { ok: boolean; error?: string } {
    try {
      const obj = JSON.parse(text)
      if (obj.kind !== 'frame-template' || !obj.template) {
        return { ok: false, error: '不是有效的模板文件' }
      }
      const t = obj.template as FrameTemplate
      templates.unshift({
        id: makeId(),
        name: t.name + ' (导入)',
        category: t.category || 'all',
        config: t.config,
      })
      persist()
      return { ok: true }
    } catch {
      return { ok: false, error: '解析失败' }
    }
  }

  return {
    templates,
    saveCurrent,
    remove,
    exportJson,
    importJson,
    toTemplateConfig,
  }
}
