// 驱动器：watch frameConfig → 写 :root CSS 变量，预览实时更新
import { ref, watch, type WatchSource } from 'vue'
import type { FrameConfig } from '../core/types'
import { footerTextColor } from '../core/colorUtils'
import { applyShowToggles } from '../core/showToggles'

/**
 * INFO 字体「悬停预览」临时覆盖：在字体下拉中鼠标经过某选项时暂存其字体栈，
 * 画板 INFO 实时跟随；移开置 null 即恢复真实设置。
 * 走独立的 ref 而非 frameConfig，避免污染撤销历史、也不改真实值。
 */
export const previewFont = ref<string | null>(null)
/**
 * 当前正在悬停预览的「目标字体字段」（如 'lensFontFamily'）；null = 无预览。
 * 必须记录目标字段：否则悬停任一组的字体下拉，画板上所有 INFO 文字都会跟着一起变
 * （如悬停「镜头型号」的字体，EXIF 文字也同时变）。
 */
export const previewFontField = ref<string | null>(null)

/** 仅当悬停的正是本组时才返回预览字体，避免预览串组 */
function previewOf(field: string): string | null {
  return previewFontField.value === field ? previewFont.value : null
}

type CssVarMap = Record<string, (c: FrameConfig) => string>

// FrameConfig 字段 → CSS 变量 的映射（仅预览布局所需的变量）
const VAR_MAP: CssVarMap = {
  '--frame-pad-x': (c) => `${c.padding}px`,
  '--frame-pad-top': (c) => `${c.padding}px`,
  '--frame-pad-bottom': (c) => `${c.padding + c.borderRatio}px`,
  '--img-scale': (c) => `${c.scale}%`,
  '--dist-photo-logo': (c) => `${c.distPhotoLogo}px`,
  '--dist-logo-text': (c) => `${c.distLogoText}px`,
  '--dist-bottom': (c) => `${c.distBottom}px`,
  '--photo-shadow': (c) => {
    const s = c.shadow
    const alpha = Math.min(0.85, s * 0.85).toFixed(3)
    return `0 ${18 * s}px ${60 * s}px rgba(0,0,0,${alpha})`
  },
  '--frame-color': (c) => c.borderColor,
  // 无边框且无背景扩展（padding=0 且 bgExpand=0）时：画板/背景层跟随照片圆角，
  // 形成圆角卡片，避免照片圆角外露出方形的背景/边框色块。
  '--frame-radius': (c) => {
    const noFrame = c.padding <= 0 && c.bgExpand <= 0
    return `${noFrame ? c.photoRadius : c.borderRadius}px`
  },
  // 边框内缘圆角（= 外圆角 - 边框宽），供背景内容区裁切，保证同心；
  // 无边框时跟随照片圆角
  '--frame-radius-inner': (c) => {
    const noFrame = c.padding <= 0 && c.bgExpand <= 0
    return `${noFrame ? c.photoRadius : Math.max(0, c.borderRadius - c.padding)}px`
  },
  '--img-radius': (c) => `${c.photoRadius}px`,
  // 整体 INFO 字体：不受某一组字体下拉的悬停预览影响（预览只作用于被悬停的那一组）
  '--font-family': (c) => c.fontFamily,
  '--font-size': (c) => `${c.fontSize}px`,
  '--text-weight': (c) => `${c.textWeight}`,
  '--text-opacity': (c) => `${c.textOpacity}`,
  // INFO 文字颜色随背景自适应：纯色浅底 → 黑字，其余 → 白字
  '--footer-text-color': (c) => footerTextColor(c.bgMode, c.bgColor, 0.95),
  '--logo-size': (c) => `${c.logoSize}px`,
  '--logo-opacity': (c) => `${c.logoOpacity}`,
  '--logo-display': (c) => (c.showLogo ? 'block' : 'none'),
  '--camera-model-size': (c) => `${c.cameraModelSize}px`,
  '--camera-model-weight': (c) => `${c.cameraModelWeight}`,
  '--camera-model-gap': (c) => `${c.cameraModelGap}px`,
  '--camera-model-opacity': (c) => `${c.cameraModelOpacity}`,
  '--camera-model-italic': (c) => (c.cameraModelItalic ? 'italic' : 'normal'),
  '--camera-model-display': (c) => (c.showCameraModel ? 'block' : 'none'),
  '--camera-model-font-family': (c) => previewOf('cameraModelFont') ?? c.cameraModelFont,
  '--camera-model-offset-x': (c) => `${c.cameraModelOffsetX}px`,
  '--camera-model-offset-y': (c) => `${c.cameraModelOffsetY}px`,
  '--exif-display': (c) => (c.showExif ? 'block' : 'none'),
  '--date-display': (c) => (c.showDate && c.dateText ? 'block' : 'none'),
  // EXIF / 镜头 / 日期 独立文本样式：独立字段优先，缺省（null）跟随整体 INFO 样式。
  // 字体项叠加 hover 预览，但仅当悬停的正是本组时才生效，保证「悬停镜头字体时只有镜头文字变」。
  '--exif-font-family': (c) => previewOf('exifFontFamily') ?? c.exifFontFamily ?? c.fontFamily,
  '--exif-font-size': (c) => `${(c.exifFontSize ?? c.fontSize)}px`,
  '--exif-text-weight': (c) => `${c.exifTextWeight ?? c.textWeight}`,
  '--exif-text-opacity': (c) => `${c.exifTextOpacity ?? c.textOpacity}`,
  '--lens-font-family': (c) => previewOf('lensFontFamily') ?? c.lensFontFamily ?? c.fontFamily,
  '--lens-font-size': (c) => `${(c.lensFontSize ?? c.fontSize)}px`,
  '--lens-text-weight': (c) => `${c.lensTextWeight ?? c.textWeight}`,
  '--lens-text-opacity': (c) => `${c.lensTextOpacity ?? c.textOpacity}`,
  '--date-font-family': (c) => previewOf('dateFontFamily') ?? c.dateFontFamily ?? c.fontFamily,
  '--date-font-size': (c) => `${(c.dateFontSize ?? c.fontSize)}px`,
  '--date-text-weight': (c) => `${c.dateTextWeight ?? c.textWeight}`,
  '--date-text-opacity': (c) => `${c.dateTextOpacity ?? c.textOpacity}`,
  // 各组独立文本颜色：独立字段优先，缺省（null）跟随整体自适应色（随背景明暗取黑/白）
  '--exif-text-color': (c) => c.exifTextColor ?? footerTextColor(c.bgMode, c.bgColor, 0.95),
  '--lens-text-color': (c) => c.lensTextColor ?? footerTextColor(c.bgMode, c.bgColor, 0.95),
  '--date-text-color': (c) => c.dateTextColor ?? footerTextColor(c.bgMode, c.bgColor, 0.95),
  '--camera-model-color': (c) => c.cameraModelColor ?? footerTextColor(c.bgMode, c.bgColor, 0.95),
}

// 上次写入的变量值：patch 高频触发（滑块 input 每秒可达 60~120 次）时，
// 大多数变量值并未变化，差分写入把每次 ~50 次 style.setProperty 缩减为 0~2 次。
const lastVars = new Map<string, string>()

function applyVars(config: FrameConfig, root: HTMLElement): void {
  // 显示开关 → 生效配置：隐藏边框时 padding/borderRadius 等归零，预览布局随之铺满
  const eff = applyShowToggles(config)
  for (const [name, fn] of Object.entries(VAR_MAP)) {
    const v = fn(eff)
    if (lastVars.get(name) !== v) {
      root.style.setProperty(name, v)
      lastVars.set(name, v)
    }
  }
}

/**
 * 将 frameConfig 同步到 :root 的 CSS 变量。
 * 返回 stop 句柄以便卸载时清理。
 */
export function useCssVars(getConfig: () => FrameConfig) {
  const root = document.documentElement

  // 立即写入一次
  applyVars(getConfig(), root)

  // 深度 watch，任一字段变化即更新
  const stop = watch(
    getConfig as WatchSource<FrameConfig>,
    (cfg) => applyVars(cfg, root),
    { deep: true, flush: 'sync' },
  )

  // 悬停预览变化（字体值或目标字段任一变化）：重算变量（差分写入，未变化的变量不写）
  const stopPreview = watch([previewFont, previewFontField], () => applyVars(getConfig(), root))

  return {
    stop: () => {
      stop()
      stopPreview()
    },
    applyNow: () => applyVars(getConfig(), root),
  }
}
