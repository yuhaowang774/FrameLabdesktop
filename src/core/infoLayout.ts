// INFO 布局共享计算：duo（杂志双栏）与 inline（悬浮居中双行）的默认排版。
// 预览（FooterInfo.vue）与导出（exporter.ts）共用本模块，保证两端位置一致。
// 所有坐标为内容区坐标系（x=0 为照片左缘，y 向下），单位：设计 px。
//
// 常量来源：用户两张样例（Desktop/相框样式，2026-08-28）像素级实测：
// 样例1（白卡双栏）: padding 26 / 底部加宽 66 / 文字距照片缘 20 / 底边距 22 /
//   参数与镜头行字号 20(粗) / 机型与日期行字号 17(灰#777) / 行距 14 /
//   竖线距右栏文字 21（浅灰 #D3D3D3，高度超出文字块上下各 ~5）/ Logo 右缘距竖线 28 / Logo 高 19
// 样例2（模糊悬浮）: 行1 = Logo(高20) + 机型文字(20)，内联居中，间距 35 /
//   行2 = 参数(18)，行距 21 / 信息底边距 29（相对画布底缘）
import type { FrameConfig } from './types'
import { DESIGN_CONTAINER } from './constants'

/** 单个 INFO 元素的默认位置（内容区坐标，左上角） */
export interface FooterRect {
  x: number
  y: number
}

/** duo/inline 布局的完整默认排版结果 */
export interface FooterLayout {
  exif: FooterRect
  date: FooterRect
  model: FooterRect
  lens: FooterRect
  logo: FooterRect
  /** duo 分隔竖线（其余布局为 null） */
  divider: { x: number; y: number; h: number } | null
}

// ===== duo（杂志双栏）实测常量（样例画板 1200px → 设计坐标系换算；行距/底边距为墨迹间隙换算到文本框坐标）=====
const DUO_INSET = 21 // 文字距照片左右缘
const DUO_ROW_GAP = 8 // 双栏行距（墨迹间隙 14 ≈ 框间隙 8 + 上下墨迹边距）
const DUO_DIVIDER_GAP = 21 // 竖线与右栏文字间距
const DUO_LOGO_GAP = 28 // Logo 右缘与竖线间距
const DUO_DIVIDER_EXTEND = 6 // 竖线超出文字块上下各 6px

// ===== inline（悬浮居中双行）实测常量 =====
const INLINE_ROW_GAP = 19 // 行1(Logo+机型) 与 行2(参数) 间距（墨迹间隙 21 ≈ 框间隙 19）
const INLINE_LOGO_GAP = 35 // 行1 Logo 与机型文字间距

let measureCtx: CanvasRenderingContext2D | null = null

/** 文本宽度测量（离屏 canvas，预览与导出端一致） */
export function measureTextWidth(text: string, font: string): number {
  if (!text) return 0
  if (!measureCtx) measureCtx = document.createElement('canvas').getContext('2d')
  if (!measureCtx) return 0
  measureCtx.font = font
  return measureCtx.measureText(text).width
}

/** EXIF 样式组（参数/镜头行）的 canvas font 字符串 */
function exifFont(cfg: FrameConfig): string {
  return `${cfg.textWeight} ${cfg.fontSize}px ${cfg.fontFamily}`
}

/** 机型样式组（机型/duo 日期行）的 canvas font 字符串 */
function modelFont(cfg: FrameConfig): string {
  return `${cfg.cameraModelItalic ? 'italic ' : ''}${cfg.cameraModelWeight} ${cfg.cameraModelSize}px ${cfg.cameraModelFont}`
}

/**
 * 计算 duo / inline 布局的默认排版。
 * @param cfg 相框配置
 * @param canvasBottom 画布底缘（内容区坐标系 y 值 = 实测画板高 − padding − bgExpand）
 * @param logoRatio Logo 宽高比（w/h；无 Logo 时用 2.6 兜底）
 */
export function computeFooterLayout(cfg: FrameConfig, canvasBottom: number, logoRatio: number): FooterLayout {
  const center = DESIGN_CONTAINER / 2
  const exifH = cfg.fontSize
  const modelH = cfg.cameraModelSize
  const showDate = cfg.showDate && !!cfg.dateText
  const showExif = cfg.showExif && !!cfg.exifText
  const hasLens = cfg.showLens && !!cfg.lensText
  const bottom = canvasBottom - cfg.overlayBottom
  const logoW = cfg.logoSize * logoRatio

  // ===== 杂志双栏（duo）：左=镜头(粗)+机型(灰细) / 中=Logo / 右栏=参数(粗)+日期(灰细)，右栏右缘对齐照片右缘 =====
  if (cfg.infoLayout === 'duo') {
    // duo 下日期使用机型样式组（灰细小字号），与样例一致
    const exifW = measureTextWidth(cfg.exifText, exifFont(cfg))
    const dateW = measureTextWidth(cfg.dateText, modelFont(cfg))
    const rightW = Math.max(showExif ? exifW : 0, showDate ? dateW : 0)
    const rightX = DESIGN_CONTAINER - DUO_INSET - rightW
    const dateY = bottom - modelH
    const exifY = showDate ? dateY - DUO_ROW_GAP - exifH : bottom - exifH
    // 文字块范围（含日期行；无参数时以日期行为块）
    const blockTop = showExif ? exifY : showDate ? dateY - modelH : bottom - modelH
    const blockBottom = showDate ? dateY + modelH : showExif ? exifY + exifH : bottom
    const blockH = Math.max(0, blockBottom - blockTop)
    // 左栏：镜头行顶对齐参数行；无镜头时机型行在块内垂直居中
    const modelY = hasLens ? dateY : blockTop + (blockH - modelH) / 2
    const dividerX = rightX - DUO_DIVIDER_GAP
    const logoX = dividerX - DUO_LOGO_GAP - logoW
    const logoY = blockTop + blockH / 2 - cfg.logoSize / 2
    return {
      exif: { x: rightX, y: exifY },
      date: { x: rightX, y: dateY },
      model: { x: DUO_INSET, y: modelY },
      lens: { x: DUO_INSET, y: blockTop },
      logo: { x: logoX, y: logoY },
      divider:
        showExif || showDate
          ? { x: dividerX, y: blockTop - DUO_DIVIDER_EXTEND, h: blockH + DUO_DIVIDER_EXTEND * 2 }
          : null,
    }
  }

  // ===== 悬浮居中双行（inline）：行1 = Logo + 机型 内联居中；行2 = 参数 居中 =====
  const exifY = bottom - exifH
  const row1H = Math.max(cfg.logoSize, modelH)
  const row1Y = exifY - INLINE_ROW_GAP - row1H
  const modelW = measureTextWidth(cfg.cameraModel, modelFont(cfg))
  const showModel = cfg.showCameraModel && !!cfg.cameraModel
  const groupW = showModel ? logoW + INLINE_LOGO_GAP + modelW : logoW
  const logoX = center - groupW / 2
  return {
    exif: { x: center - measureTextWidth(cfg.exifText, exifFont(cfg)) / 2, y: exifY },
    date: { x: center, y: exifY },
    model: { x: logoX + logoW + INLINE_LOGO_GAP, y: row1Y + (row1H - modelH) / 2 },
    lens: { x: center, y: row1Y },
    logo: { x: logoX, y: row1Y },
    divider: null,
  }
}
