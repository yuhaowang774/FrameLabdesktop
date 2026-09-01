// 模板系统：内置预设 + 用户自定义模板（可导出/导入 JSON）。
// 模板仅保存 FrameConfig 装饰参数（不含 photoSrc、照片变换与位置，避免污染用户主图）。
// 背景模板库已取消；内置模板为两张用户样例的像素级复刻（白框参数卡 / 圆角悬浮·模糊延展）。
// 列表缩略图由 core/templateThumb.ts 按 config 程序化生成，与成片几何一致。
import { reactive } from 'vue'
import type { FrameConfig } from '../core/types'
import { useFrameConfig } from './useFrameConfig'
import { buildExifText, formatDate, cleanLens } from './useExif'

const STORAGE_KEY = 'frame-templates'

// 'background' 类别仅为兼容旧的自定义模板数据保留，已无独立 UI 入口
export type TemplateCategory = 'frame' | 'background' | 'all'

export interface FrameTemplate {
  id: string
  name: string
  category: TemplateCategory
  /** 预设配置（不含 photoSrc） */
  config: Partial<FrameConfig>
  builtin?: boolean
}

// 内置预设：与两张用户样例逐像素对齐（Desktop/相框样式，2026-08-28 实测），
// 见《相框风格分析与模板更新.md》；选择模板后右栏参数随之更新，用户可继续在右栏微调。
const BUILTIN: FrameTemplate[] = [
  {
    id: 'm_duo_card',
    name: '白框参数卡',
    category: 'frame',
    builtin: true,
    // 样例1：白底等宽边 26 + 底部加宽 66；INFO 左=镜头(20粗)+机型(17灰) / 中=Logo / 右=参数(20粗)+日期(17灰)，
    // 右栏右缘对齐照片右缘（内缩 20），竖线浅灰、Logo 右缘贴竖线；几何常量见 core/infoLayout.ts
    config: {
      bgMode: 'solid',
      bgColor: '#ffffff',
      borderColor: '#ffffff',
      padding: 27,
      borderRatio: 0,
      bgBottomRatio: 69,
      photoRadius: 0,
      borderRadius: 0,
      scale: 100,
      shadow: 0.12,
      frameRatio: null,
      infoLayout: 'duo',
      overlayAlign: 'center',
      overlayBottom: 18,
      showLogo: true,
      logoSize: 20,
      logoOpacity: 1,
      showCameraModel: true,
      // 样例实测机型行为 17px/#777 灰细小字；直接复刻后在深色区域几乎看不清，
      // 故微调为 18px / 0.75 —— 仍比参数行小且淡，但能看清（duo 下日期沿用此样式组）
      cameraModelSize: 18,
      cameraModelWeight: 400,
      cameraModelOpacity: 0.75,
      showExif: true,
      showLens: true,
      showDate: true,
      dateFormat: 'dash',
      fontSize: 20,
      textWeight: 700,
      textOpacity: 1,
    },
  },
  {
    id: 'm_float_round',
    name: '圆角悬浮·模糊延展',
    category: 'frame',
    builtin: true,
    // 样例2：照片大圆角+阴影悬浮，四周原图模糊延展（四边 100 / 底部 190）；
    // INFO 悬浮居中双行：行1 = Logo(白,高20)+机型(20) 内联、行2 = 参数(18)，底边距 29
    config: {
      bgMode: 'blur',
      blur: 60,
      bgExpand: 100,
      bgBottomRatio: 90,
      padding: 0,
      borderRatio: 0,
      photoRadius: 35,
      shadow: 0.45,
      scale: 100,
      frameRatio: null,
      infoLayout: 'inline',
      overlayAlign: 'center',
      overlayBottom: 29,
      showLogo: true,
      logoSize: 20,
      logoOpacity: 1,
      logoColor: '#ffffff',
      showCameraModel: true,
      cameraModelSize: 20,
      cameraModelWeight: 400,
      cameraModelOpacity: 1,
      showExif: true,
      showLens: false,
      showDate: false,
      fontSize: 18,
      textWeight: 400,
      textOpacity: 1,
    },
  },
]

const templates = reactive<FrameTemplate[]>([])

function load(): FrameTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
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
    localStorage.setItem(STORAGE_KEY, JSON.stringify(custom))
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

/**
 * 仅导出与装饰/排版相关的字段：排除主图与位置/变换，
 * 并剔除当前照片的 EXIF 内容（型号 / EXIF 文本 / 日期 / 镜头 / 品牌）。
 * 后者属于每张照片自身数据，存进模板会把 A 照片的型号带到 B 照片上。
 * 显示开关（showXxx）属于模板设计的一部分，正常保留。
 */
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
  // 照片自身内容：不进模板
  const {
    cameraModel,
    exifText,
    exifRaw,
    dateText,
    lensText,
    brand,
    ...tpl
  } = rest
  void cameraModel
  void exifText
  void exifRaw
  void dateText
  void lensText
  void brand
  return { ...tpl }
}

/**
 * 应用模板到「当前编辑状态」（与模板面板点击行为一致，供首选项「启动默认模板」复用）：
 * 模板只覆盖装饰/布局参数；当前照片的 EXIF 文本/型号/品牌/位置/变换与用户对
 * INFO 文本的独立样式（字体/字号/粗细/透明度/颜色）一律保留。
 *
 * @returns 缺失的 INFO 字段中文名列表（模板开启了显示但无内容，已用「自定义」占位）；
 *          空数组 = 信息齐全。调用方可据此弹框提示。
 */
export function applyTemplateToState(config: Partial<FrameConfig>): string[] {
  const { state, loadConfig } = useFrameConfig()
  // INFO 文本被「复位 INFO」清空时，从 exifRaw 兜底重建，避免应用模板后参数行无内容
  const raw = state.exifRaw
  let exifText = state.exifText || (raw ? buildExifText(raw, { eqFocal: state.eqFocal, cropFactor: state.cropFactor }) : '')
  let dateText = state.dateText || (raw?.dateTimeOriginal ? formatDate(raw.dateTimeOriginal, state.dateFormat) : '')
  let lensText = state.lensText || (raw ? cleanLens(raw.lensMake, raw.lensModel) ?? '' : '')
  // 模板开启显示但内容缺失的字段：用「自定义」占位并汇总，供调用方弹框提示
  const missing: string[] = []
  const showExif = config.showExif ?? state.showExif
  const showLens = config.showLens ?? state.showLens
  const showDate = config.showDate ?? state.showDate
  const showModel = config.showCameraModel ?? state.showCameraModel
  if (showExif && !exifText) {
    exifText = '自定义'
    missing.push('EXIF 参数')
  }
  if (showLens && !lensText) {
    lensText = '自定义'
    missing.push('镜头信息')
  }
  if (showDate && !dateText) {
    dateText = '自定义'
    missing.push('拍摄日期')
  }
  const cameraModel = state.cameraModel
  if (showModel && !cameraModel) missing.push('相机型号')
  loadConfig({
    ...config,
    // ===== 以下为照片自身内容 / 用户设置，覆盖模板中可能残留的同名字段 =====
    photoSrc: state.photoSrc,
    photoX: state.photoX,
    photoY: state.photoY,
    photoRotation: state.photoRotation,
    photoCrop: state.photoCrop,
    bgScale: state.bgScale,
    bgOffsetX: state.bgOffsetX,
    bgOffsetY: state.bgOffsetY,
    canvasH: state.canvasH,
    exifText,
    exifRaw: raw,
    dateText,
    cameraModel,
    brand: state.brand,
    lensText,
    exifFontFamily: state.exifFontFamily,
    exifFontSize: state.exifFontSize,
    exifTextWeight: state.exifTextWeight,
    exifTextOpacity: state.exifTextOpacity,
    lensFontFamily: state.lensFontFamily,
    lensFontSize: state.lensFontSize,
    lensTextWeight: state.lensTextWeight,
    lensTextOpacity: state.lensTextOpacity,
    dateFontFamily: state.dateFontFamily,
    dateFontSize: state.dateFontSize,
    dateTextWeight: state.dateTextWeight,
    dateTextOpacity: state.dateTextOpacity,
    exifTextColor: state.exifTextColor,
    lensTextColor: state.lensTextColor,
    dateTextColor: state.dateTextColor,
    cameraModelColor: state.cameraModelColor,
  })
  return missing
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

  /** 清除全部自定义模板（保留内置），供「首选项 → 数据」清理 */
  function clearCustom(): void {
    for (let i = templates.length - 1; i >= 0; i--) {
      if (!templates[i].builtin) templates.splice(i, 1)
    }
    persist()
  }

  return {
    templates,
    saveCurrent,
    remove,
    exportJson,
    importJson,
    toTemplateConfig,
    clearCustom,
  }
}
