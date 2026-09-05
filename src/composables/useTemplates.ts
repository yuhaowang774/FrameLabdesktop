// 模板系统：内置预设 + 用户自定义模板（可导出/导入 JSON）。
// 模板仅保存 FrameConfig 装饰参数（不含 photoSrc、照片变换与位置，避免污染用户主图）。
// 背景模板库已取消；内置模板前两张为用户样例的像素级复刻（白框参数卡 / 圆角悬浮·模糊延展），
// 其余复刻自「水印审美」样张归纳的风格（Desktop/水印审美，2026-09-03）：
// 极简装裱 / 居中机型参数 / 全幅铭牌条 / 工程测绘 / 胶片暗房 / 轻量悬浮 / 复古 CCD / 杂志编辑。
// 画廊签名款（手写签名 + 数字/单位双行四栏参数）暂未收录：签名属用户自定义图形，四栏双行
// 单元格超出 INFO 布局引擎能力。
// 列表缩略图由 core/templateThumb.ts 按 config 程序化生成，与成片几何一致。
import { reactive } from 'vue'
import type { FrameConfig } from '../core/types'
import { defaultFrameConfig } from '../core/types'
import { hexLuminance } from '../core/colorUtils'
import { useFrameConfig } from './useFrameConfig'
import { backfillInfoFromRaw, isInfoMissing, INFO_PLACEHOLDER, parseDisplayDate, formatDate } from './useExif'

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
  /** 一句话说明（模板选择弹窗右侧展示）；自定义模板缺省 */
  desc?: string
}

// 内置预设：与两张用户样例逐像素对齐（Desktop/相框样式，2026-08-28 实测），
// 见《相框风格分析与模板更新.md》；选择模板后右栏参数随之更新，用户可继续在右栏微调。
const BUILTIN: FrameTemplate[] = [
  {
    id: 'm_duo_card',
    name: '白框参数卡',
    desc: '经典白底等宽边框 + 左侧机型/右侧参数排布',
    category: 'frame',
    builtin: true,
    // 样例1：白底等宽边 26 + 底部加宽 66；INFO 左=镜头(20粗)+机型(17灰) / 中=Logo / 右=参数(20粗)+日期(17灰)，
    // 右栏右缘对齐照片右缘（内缩 20），竖线浅灰、Logo 右缘贴竖线；几何常量见 core/infoLayout.ts
    config: {
      bgMode: 'solid',
      bgColor: '#ffffff',
      borderColor: '#ffffff',
      padding: 27,
      // 下边留白由边框负责（borderRatio），背景纯色不下延（bgBottomRatio=0），
      // 避免「背景纯色下边」与「边框下边」两层职责重叠。
      borderRatio: 69,
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
    desc: '圆角悬浮照片 + 背景模糊向外延展',
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
  {
    id: 'm_matte_serif',
    name: '白卡装裱·衬线字标',
    desc: '白卡装裱 + 衬线字标 INFO 排版',
    category: 'frame',
    builtin: true,
    // 样张「HASSELBLAD」：大幅白卡纸装裱（四边留白 22 / 底部 152），仅底部一行斜体衬线字，
    // 克制、高级。机型行用 Didot 斜体呈现"字标感"（随照片 EXIF 型号）；classic 布局
    // 只为显示行分配位置，overlayBottom 60 让单行机型落在底部留白的视觉中点。
    config: {
      bgMode: 'solid',
      bgColor: '#ffffff',
      borderColor: '#ffffff',
      padding: 22,
      borderRatio: 130,
      photoRadius: 0,
      borderRadius: 0,
      scale: 100,
      shadow: 0,
      frameRatio: null,
      infoLayout: 'classic',
      overlayAlign: 'center',
      overlayBottom: 60,
      showLogo: false,
      showCameraModel: true,
      cameraModelFont: "Didot, 'Bodoni MT', 'Times New Roman', serif",
      cameraModelSize: 26,
      cameraModelWeight: 600,
      cameraModelItalic: true,
      showExif: false,
      showLens: false,
      showDate: false,
      fontFamily: "'Helvetica Neue', Arial, sans-serif",
      fontSize: 15,
      textWeight: 400,
      textOpacity: 0.6,
    },
  },
  {
    id: 'm_center_params',
    name: '白底居中·机型参数',
    desc: '白底居中布局 + 机型参数居中排布',
    category: 'frame',
    builtin: true,
    // 样张「XIAOMI 15 | LEICA」/「OPPO Find X8 Ultra」：白底加宽下边带，居中两行——
    // 上行机型（黑、粗）、下行参数（灰、细），无 Logo 不抢戏，官方水印的通用形制。
    config: {
      bgMode: 'solid',
      bgColor: '#ffffff',
      borderColor: '#ffffff',
      padding: 27,
      borderRatio: 159,
      photoRadius: 0,
      borderRadius: 0,
      scale: 100,
      shadow: 0,
      frameRatio: null,
      infoLayout: 'classic',
      overlayAlign: 'center',
      overlayBottom: 85,
      showLogo: false,
      showCameraModel: true,
      cameraModelSize: 24,
      cameraModelWeight: 700,
      showExif: true,
      showLens: false,
      showDate: false,
      fontSize: 18,
      textWeight: 400,
      textOpacity: 0.7,
    },
  },
  {
    id: 'm_strip_plate',
    name: '全幅白条·铭牌',
    desc: '全幅白条 + 底部铭牌式信息栏',
    category: 'frame',
    builtin: true,
    // 样张「iPhone 16 Pro」：照片全幅铺满，仅在底部压一条窄白带（118），
    // 左机型 / 中 Logo / 右日期三段式，像机身铭牌。duo 布局右缘自动对齐照片右缘。
    config: {
      bgMode: 'solid',
      bgColor: '#ffffff',
      borderColor: '#ffffff',
      padding: 0,
      borderRatio: 118,
      photoRadius: 0,
      borderRadius: 0,
      scale: 100,
      shadow: 0,
      frameRatio: null,
      infoLayout: 'duo',
      overlayAlign: 'center',
      overlayBottom: 44,
      showLogo: true,
      logoSize: 22,
      logoOpacity: 1,
      logoColor: '#1a1a1a',
      showCameraModel: true,
      cameraModelSize: 26,
      cameraModelWeight: 500,
      showExif: false,
      showLens: false,
      showDate: true,
      dateFormat: 'date',
      fontSize: 18,
      textWeight: 400,
      textOpacity: 1,
    },
  },
  {
    id: 'm_tech_silver',
    name: '银灰测绘·等宽参数',
    desc: '银灰测绘风格 + 等宽参数行',
    category: 'frame',
    builtin: true,
    // 样张「XIAOMI 14 | LEICA」：银灰底色 + 等宽字体的数据美学；信息分居下边两角——
    // 左镜头+机型、右参数+日期（原样张右下为 GPS 坐标，引擎暂无 GPS 字段，以日期替代；
    // 左上角品牌标同样超出布局引擎能力，未复刻）。
    config: {
      bgMode: 'solid',
      bgColor: '#C9C5CD',
      borderColor: '#C9C5CD',
      padding: 77,
      borderRatio: 143,
      photoRadius: 0,
      borderRadius: 0,
      scale: 100,
      shadow: 0,
      frameRatio: null,
      infoLayout: 'duo',
      overlayAlign: 'center',
      overlayBottom: 118,
      showLogo: false,
      showCameraModel: true,
      cameraModelFont: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
      cameraModelSize: 22,
      cameraModelWeight: 600,
      showExif: true,
      showLens: true,
      showDate: true,
      dateFormat: 'dash',
      fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
      fontSize: 20,
      textWeight: 400,
      textOpacity: 0.8,
    },
  },
  {
    id: 'm_film_noir',
    name: '胶片暗房·黑框',
    desc: '胶片暗房 + 深色底黑框展示',
    category: 'frame',
    builtin: true,
    // 样张「XIAOMI 13 PRO | LEICA」：纯黑边框营造暗房出片感，左下白色机型、右下浅灰参数；
    // 原样张照片四周的胶片毛边（不规则白边）超出照片层渲染能力，以直边照片近似。
    config: {
      bgMode: 'solid',
      bgColor: '#000000',
      borderColor: '#000000',
      padding: 60,
      borderRatio: 126,
      photoRadius: 0,
      borderRadius: 0,
      scale: 100,
      shadow: 0,
      frameRatio: null,
      infoLayout: 'duo',
      overlayAlign: 'center',
      overlayBottom: 66,
      showLogo: false,
      showCameraModel: true,
      cameraModelSize: 24,
      cameraModelWeight: 700,
      showExif: true,
      showLens: false,
      showDate: false,
      fontSize: 20,
      textWeight: 400,
      textOpacity: 0.75,
    },
  },
  {
    id: 'm_float_badge',
    name: '轻量悬浮·型号水印',
    desc: '轻量悬浮 + 型号水印式标注',
    category: 'frame',
    builtin: true,
    // 样张「DJI OSMO POCKET 4P」：不做画框，照片全幅，底部中央一行 Logo+型号半透明白字，
    // 不干扰画面。bgMode 用 blur(0) 使悬浮文字获得与 inline 悬浮款一致的可读性投影。
    config: {
      bgMode: 'blur',
      blur: 0,
      padding: 0,
      borderRatio: 0,
      photoRadius: 0,
      borderRadius: 0,
      scale: 100,
      shadow: 0,
      frameRatio: null,
      infoLayout: 'inline',
      overlayAlign: 'center',
      overlayBottom: 22,
      showLogo: true,
      logoSize: 22,
      logoOpacity: 0.92,
      logoColor: '#ffffff',
      showCameraModel: true,
      cameraModelSize: 22,
      cameraModelWeight: 500,
      cameraModelOpacity: 0.92,
      showExif: false,
      showLens: false,
      showDate: false,
      fontSize: 18,
      textWeight: 400,
      textOpacity: 1,
    },
  },
  {
    id: 'm_ccd_stamp',
    name: '复古CCD·日期戳',
    desc: '复古 CCD + 日期戳点缀',
    category: 'frame',
    builtin: true,
    // 样张「2008/10/04」：无边框全幅照片，右下角一枚等宽粗体橙色数字日期，模拟 2000 年代
    // CCD 相机的机内日期打印。等宽字体由全局字体下发；右下角 = classic 布局右对齐
    // （overlayAlign right，行宽由引擎实测，换日期格式也不会出界）；橙色为 CCD 日期戳标志性配色。
    config: {
      bgMode: 'blur',
      blur: 0,
      padding: 0,
      borderRatio: 0,
      photoRadius: 0,
      borderRadius: 0,
      scale: 100,
      shadow: 0,
      frameRatio: null,
      infoLayout: 'classic',
      overlayAlign: 'right',
      overlayBottom: 46,
      showLogo: false,
      showCameraModel: false,
      showExif: false,
      showLens: false,
      showDate: true,
      dateFormat: 'date',
      fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
      fontSize: 30,
      textWeight: 700,
      textOpacity: 1,
      dateTextColor: '#FFB43B',
    },
  },
  {
    id: 'm_magazine_edit',
    name: '杂志编辑·标题色卡',
    desc: '杂志双栏 + 标题与取色色卡',
    category: 'frame',
    builtin: true,
    // 样张「Nature's poetry」：白框非对称杂志排版——顶部大标题 + "PHOTOGRAPHED IN : 日期"
    // 副标题，底部左侧从照片取色的五格色卡、右侧大号机型 + 灰色参数。对称大留白 padding 120
    // 容纳标题区，下边加宽 71 放色卡与信息块。标题文本可自定义（INFO 面板），色卡随照片换色。
    config: {
      bgMode: 'solid',
      bgColor: '#ffffff',
      borderColor: '#ffffff',
      padding: 120,
      borderRatio: 71,
      photoRadius: 0,
      borderRadius: 0,
      scale: 100,
      shadow: 0,
      frameRatio: null,
      infoLayout: 'magazine',
      overlayAlign: 'center',
      overlayBottom: 40,
      infoTitle: "Nature's poetry",
      showPalette: true,
      showLogo: false,
      showCameraModel: true,
      cameraModelSize: 30,
      cameraModelWeight: 600,
      showExif: true,
      showLens: false,
      showDate: true,
      dateFormat: 'en',
      fontSize: 17,
      textWeight: 500,
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
 * - 模板只覆盖装饰/布局参数；照片内容/变换/位置与 EXIF 语义参数（eqFocal/cropFactor）保留当前照片的；
 * - INFO 文本缺失（空或「自定义」占位）时从照片 exifRaw 自动回填（含型号/品牌占位恢复），
 *   模板开启显示仍无数据的字段才落「自定义」占位并汇总返回；
 * - INFO 文本字体/字号/粗细/透明度的用户独立设置保留；颜色随模板背景自适应：
 *   模板显式定义优先，未定义时文字回「自动」（null → 渲染端按底色黑白），Logo 按底色明暗取黑/白，
 *   白框模板自动得到深色 Logo，用户无需手动调节。
 *
 * @returns 缺失的 INFO 字段中文名列表（模板开启了显示但无内容，已用「自定义」占位）；
 *          空数组 = 信息齐全。调用方可据此弹框提示。
 */
export function applyTemplateToState(config: Partial<FrameConfig>): string[] {
  const { state, loadConfig } = useFrameConfig()
  // 模板背景明暗（模板未指定背景时沿用当前背景）：浅色纯色底 → 深色 Logo
  const bgMode = config.bgMode ?? state.bgMode
  const bgColor = config.bgColor ?? state.bgColor
  const lightSolid = bgMode === 'solid' && hexLuminance(bgColor) > 0.6
  const next: FrameConfig = {
    ...defaultFrameConfig,
    ...config,
    // ===== 照片自身内容 / 变换 / 位置：永远保留当前照片的 =====
    photoSrc: state.photoSrc,
    photoX: state.photoX,
    photoY: state.photoY,
    photoRotation: state.photoRotation,
    photoCrop: state.photoCrop,
    bgScale: state.bgScale,
    bgOffsetX: state.bgOffsetX,
    bgOffsetY: state.bgOffsetY,
    canvasH: state.canvasH,
    exifRaw: state.exifRaw,
    eqFocal: state.eqFocal,
    cropFactor: state.cropFactor,
    // ===== 层显示开关（showBackground/showBorder/showInfo）：保留用户当前值，
    // 不被 defaultFrameConfig 兜底 true 覆盖——应用模板不应把用户手动关闭的层悄悄打开，
    // 否则开关被重置为 on 而面板未必展开，造成「切开不展开」的错乱。 =====
    showBackground: state.showBackground,
    showBorder: state.showBorder,
    showInfo: state.showInfo,
    // ===== INFO 文本独立样式：字体/字号/粗细/透明度保留用户设置；颜色随模板背景自适应 =====
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
    exifTextColor: config.exifTextColor ?? null,
    lensTextColor: config.lensTextColor ?? null,
    dateTextColor: config.dateTextColor ?? null,
    cameraModelColor: config.cameraModelColor ?? null,
    logoColor: config.logoColor ?? (lightSolid ? '#1a1a1a' : '#ffffff'),
    // ===== INFO 文本：先保留现值，缺失的从 exifRaw 回填 =====
    exifText: state.exifText,
    dateText: state.dateText,
    lensText: state.lensText,
    cameraModel: state.cameraModel,
    brand: state.brand,
    dateFormat: config.dateFormat ?? state.dateFormat,
  }
  backfillInfoFromRaw(next)
  // 模板开启显示但内容仍缺失的字段：用「自定义」占位并汇总，供调用方弹框提示。
  // 无 EXIF 的照片：品牌/型号也视为未识别（brand 残留的只是全局默认值，如 sony）
  const missing: string[] = []
  if ((config.showExif ?? state.showExif) && isInfoMissing(next.exifText)) {
    next.exifText = INFO_PLACEHOLDER
    missing.push('EXIF 参数')
  }
  if ((config.showLens ?? state.showLens) && isInfoMissing(next.lensText)) {
    next.lensText = INFO_PLACEHOLDER
    missing.push('镜头信息')
  }
  if ((config.showDate ?? state.showDate) && isInfoMissing(next.dateText)) {
    next.dateText = INFO_PLACEHOLDER
    missing.push('拍摄日期')
  }
  if ((config.showCameraModel ?? state.showCameraModel) && isInfoMissing(next.cameraModel)) {
    next.cameraModel = INFO_PLACEHOLDER
    missing.push('相机型号')
  }
  if ((config.showLogo ?? state.showLogo) && !next.exifRaw) {
    next.brand = INFO_PLACEHOLDER
    missing.push('品牌信息')
  }
  recalcCanvasHAfterTemplate(state, next)
  // 模板自带 dateFormat：dateText 若为旧格式文本，反解日期后按模板格式重拼
  // （无 EXIF 原始日期的照片用 parseDisplayDate 从展示文本反解；解析失败保留原文本）
  if (config.dateFormat && config.dateFormat !== state.dateFormat) {
    const rawDate = next.exifRaw?.dateTimeOriginal ?? parseDisplayDate(next.dateText)
    if (rawDate) next.dateText = formatDate(rawDate, next.dateFormat)
  }
  loadConfig(next)
  return missing
}

/**
 * 模板应用后按新边框参数重算画布总高：内容区高不变（照片不随模板缩放），
 * 画布 = 内容高 + 上下 padding×2 + 底边 borderRatio。旧 canvasH 为 0（未初始化）时跳过。
 * 不重算会导致大 padding 模板（银灰测绘/杂志编辑等）把内容区错误压缩、INFO 锚点整体错位。
 */
export function recalcCanvasHAfterTemplate(old: FrameConfig, next: FrameConfig): void {
  if (!old.canvasH) return
  const contentH = old.canvasH - old.padding - (old.padding + old.borderRatio)
  next.canvasH = Math.max(0, contentH + next.padding * 2 + next.borderRatio)
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
