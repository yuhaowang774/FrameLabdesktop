// INFO 布局共享计算：duo（杂志双栏）、inline（悬浮居中双行）与 card（手机白底水印卡）的默认排版。
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
import { DESIGN_CONTAINER, phoneBrandOf } from './constants'
import { modelAlias } from './modelAlias'
import { MODEL_MARK_SCALE } from './modelMarks'
import { hexLuminance } from './colorUtils'
import { lunarLabel } from './lunar'
import { posterParams, parseDisplayDate } from '../composables/useExif'

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

// ===== 经典纵向堆叠（classic）共享常量（预览与导出同源，避免两端公式漂移）=====
export const CLASSIC_ROW_GAP = 16 // 元素垂直间距（设计 px）
export const LENS_LINE_GAP = 6 // classic 下镜头行与 EXIF 参数行的行距（设计 px）
export const CLASSIC_SIDE_INSET = 40 // overlayAlign 左/右对齐时距内容区左右缘的内缩（设计 px）

// ===== 各组「生效样式」解析 =====
// EXIF / 镜头 / 日期 独立字段优先，缺省（null）跟随整体 INFO 样式；
// 型号组本就独立（无 null 回退）。
// 关键点：布局高度与文本宽度测量必须基于「生效样式」而非硬用全局 fontSize/fontFamily，
// 否则单独调大某组字号/换字体后，行高与宽度测量失准 → 行重叠、右缘对齐失效、预览与导出错位。
export interface TextStyle {
  size: number
  font: string
  weight: number
  opacity: number
}
export function exifTextStyle(cfg: FrameConfig): TextStyle {
  return {
    size: cfg.exifFontSize ?? cfg.fontSize,
    font: cfg.exifFontFamily ?? cfg.fontFamily,
    weight: cfg.exifTextWeight ?? cfg.textWeight,
    opacity: cfg.exifTextOpacity ?? cfg.textOpacity,
  }
}
export function lensTextStyle(cfg: FrameConfig): TextStyle {
  return {
    size: cfg.lensFontSize ?? cfg.fontSize,
    font: cfg.lensFontFamily ?? cfg.fontFamily,
    weight: cfg.lensTextWeight ?? cfg.textWeight,
    opacity: cfg.lensTextOpacity ?? cfg.textOpacity,
  }
}
export function dateTextStyle(cfg: FrameConfig): TextStyle {
  return {
    size: cfg.dateFontSize ?? cfg.fontSize,
    font: cfg.dateFontFamily ?? cfg.fontFamily,
    weight: cfg.dateTextWeight ?? cfg.textWeight,
    opacity: cfg.dateTextOpacity ?? cfg.textOpacity,
  }
}
export function modelTextStyle(cfg: FrameConfig): TextStyle {
  return {
    size: cfg.cameraModelSize,
    font: cfg.cameraModelFont,
    weight: cfg.cameraModelWeight,
    opacity: cfg.cameraModelOpacity,
  }
}

/** 生成 canvas font 字符串（measureText / ctx.font 共用，保证测量与绘制一致） */
export function toCanvasFont(s: TextStyle, italic = false): string {
  return `${italic ? 'italic ' : ''}${s.weight} ${s.size}px ${s.font}`
}

/**
 * 计算 duo / inline 布局的默认排版。
 * @param cfg 相框配置
 * @param canvasBottom 画布底缘（内容区坐标系 y 值 = 实测画板高 − padding − bgExpand）
 * @param logoRatio Logo 宽高比（w/h；无 Logo 时用 2.6 兜底）
 * @param modelMarkRatio 机型字标宽高比（w/h；null = 未启用字标或未就绪，按文字测宽）
 */
export function computeFooterLayout(
  cfg: FrameConfig,
  canvasBottom: number,
  logoRatio: number,
  modelMarkRatio: number | null = null,
): FooterLayout {
  const center = DESIGN_CONTAINER / 2
  const exifS = exifTextStyle(cfg)
  const lensS = lensTextStyle(cfg)
  const modelS = modelTextStyle(cfg)
  // 日期样式完全独立（dateFontSize ?? 全局，与 EXIF/镜头组同语义）：
  // duo 下不再继承机型样式组——调整机型字号/字体/颜色时日期纹丝不动（用户反馈：两者必须独立控制）。
  // duo 模板的日期外观由模板自带 dateFontSize/dateTextWeight 明确指定（见 useTemplates 内置模板）。
  const dateS = dateTextStyle(cfg)
  const exifH = exifS.size
  const modelH = modelS.size
  const showDate = cfg.showDate && !!cfg.dateText
  const showExif = cfg.showExif && !!cfg.exifText
  const hasLens = cfg.showLens && !!cfg.lensText
  // 纵向锚点：bottom = 自画布底缘向上量（默认）；top = 自画布顶缘向下量（报头式）。
  // 画布顶缘（内容区坐标）= -(padding + bgExpand)——与 magazine 刊头（MAG_TITLE_TOP）和
  // 底部锚点「画布底缘」语义对称：overlayBottom 恒以画布边缘为基准，文字落在顶边留白带内。
  // duo 分支不响应 top（左右双栏与分隔竖线几何绑定下边留白带，翻转语义不明），
  // 仅 inline 分支持持顶部锚点——行序镜像后自顶向下堆叠。
  const bottom = cfg.overlayAnchor === 'top' && cfg.infoLayout !== 'duo'
    ? -(cfg.padding + cfg.bgExpand) + cfg.overlayBottom
    : canvasBottom - cfg.overlayBottom
  const topDown = cfg.overlayAnchor === 'top' && cfg.infoLayout !== 'duo'
  const logoW = cfg.logoSize * logoRatio

  // ===== 杂志双栏（duo）：左=镜头(粗)+机型(灰细) / 中=Logo / 右栏=参数(粗)+日期(灰细)，右栏右缘对齐照片右缘 =====
  if (cfg.infoLayout === 'duo') {
    // 宽度测量用各组生效样式：单独改 EXIF/日期字体或字号后，右缘对齐仍然准确
    const exifW = measureTextWidth(cfg.exifText, toCanvasFont(exifS))
    const dateW = measureTextWidth(cfg.dateText, toCanvasFont(dateS))
    const rightW = Math.max(showExif ? exifW : 0, showDate ? dateW : 0)
    const rightX = DESIGN_CONTAINER - DUO_INSET - rightW
    // 日期行高用生效字号（dateFontSize ?? 全局）：单独调大日期字号后仍按实际渲染高度预留，
    // 避免溢出行距与上方 EXIF 参数行重叠
    // （回归：应用 duo 模板保留用户日期独立字号后，按机型字号预留导致重叠）。
    const dateH = dateS.size
    const dateY = bottom - dateH
    const exifY = showDate ? dateY - DUO_ROW_GAP - exifH : bottom - exifH
    // 文字块高度：右栏（参数+日期）与左栏（镜头+机型）取较高者。
    // 任一组字号被单独调大时块同步增高，避免两栏内部行重叠。
    const rightH =
      (showExif ? exifH : 0) + (showExif && showDate ? DUO_ROW_GAP : 0) + (showDate ? dateH : 0)
    const leftH = (hasLens ? lensS.size + DUO_ROW_GAP : 0) + modelH
    const blockH = Math.max(0, Math.max(rightH, leftH))
    const blockTop = bottom - blockH
    // 左栏：镜头行顶对齐块顶；有镜头时机型行贴底（两栏最后一行底对齐，
    // 不随日期行独立字号变高而上移），无镜头时机型行在块内垂直居中
    const modelY = hasLens ? bottom - modelH : blockTop + (blockH - modelH) / 2
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
          ? // 竖线覆盖信息文字块高度：顶部对齐块顶（SONY/镜头行），底部对齐块底（日期行底），
            // 不侵入下方白框留白带（参考样例：竖线止于文字底部），调下边宽度时信息块随之居中于留白上方
            { x: dividerX, y: blockTop, h: Math.max(0, bottom - blockTop) }
          : null,
    }
  }

  // ===== 悬浮居中双行（inline）：行1 = Logo + 机型 内联居中；行2 = 参数 居中；日期 = 参数下方独立居中行 =====
  // 自底向上：日期（开启时贴底）→ 行2 参数 → 行1（Logo+机型）/ 镜头行。
  // 回归修复：此前日期 y 与 EXIF 参数行相同（两者同开时完全重叠），改为独立占位行。
  // 审查报告 R10：测宽必须与绘制同源（营销名映射），否则 inline 居中行偏移、右对齐宽度失真。
  // 机型字标启用且已就绪（modelMarkRatio 非空）时按字标实际宽高比测宽，行1 居中与字标渲染一致
  const modelW =
    modelMarkRatio != null
      ? cfg.cameraModelSize * MODEL_MARK_SCALE * modelMarkRatio
      : measureTextWidth(modelAlias(cfg.cameraModel), toCanvasFont(modelS, cfg.cameraModelItalic))
  const showModel = cfg.showCameraModel && !!cfg.cameraModel
  // 手机品牌的 Logo 是文字标记（HUAWEI/XIAOMI…），与机型文本（通常含品牌名）并排显示会重复，
  // 行1 仅保留机型居中；相机品牌的图形 Logo 正常内联。
  const showLogoInline = cfg.showLogo && !phoneBrandOf(cfg.brand)
  const row1H = Math.max(showLogoInline ? cfg.logoSize : 0, showModel ? modelH : 0)
  const groupW = showLogoInline
    ? (showModel ? logoW + INLINE_LOGO_GAP + modelW : logoW)
    : modelW
  const logoX = center - groupW / 2
  // 镜头行：行1（Logo+机型）的相邻独立居中行（showLens 开启时占位，避免与机型行重叠）
  const hasLensRow = cfg.showLens && !!cfg.lensText

  let exifY: number
  let row1Y: number
  let lensY: number
  let dateY: number
  if (topDown) {
    // 顶部锚点（报头式）：视觉行序不变（镜头行 → 行1(Logo+机型) → 参数 → 日期），
    // 整块搬到顶缘下方自顶向下堆叠（bottom 已换算为 overlayBottom 自顶 y）
    let cursor = bottom
    lensY = cursor
    if (hasLensRow) cursor += lensS.size + INLINE_ROW_GAP
    row1Y = cursor
    cursor += row1H + INLINE_ROW_GAP
    exifY = cursor
    if (showExif) cursor += exifH + INLINE_ROW_GAP
    dateY = cursor
  } else {
    let cursor = bottom
    dateY = showDate ? cursor - dateS.size : bottom
    if (showDate) cursor -= dateS.size + INLINE_ROW_GAP
    exifY = cursor - exifH
    row1Y = exifY - INLINE_ROW_GAP - row1H
    lensY = hasLensRow ? row1Y - INLINE_ROW_GAP - lensS.size : row1Y
  }
  return {
    exif: { x: center - measureTextWidth(cfg.exifText, toCanvasFont(exifS)) / 2, y: exifY },
    // 日期行独立居中（测宽居中，与 EXIF 行同规则）
    date: {
      x: center - measureTextWidth(cfg.dateText, toCanvasFont(dateS)) / 2,
      y: dateY,
    },
    model: {
      x: showLogoInline ? logoX + logoW + INLINE_LOGO_GAP : center - modelW / 2,
      y: row1Y + (row1H - modelH) / 2,
    },
    lens: { x: center, y: lensY },
    logo: { x: logoX, y: row1Y },
    divider: null,
  }
}

/**
 * 计算经典纵向堆叠（classic）的默认排版：从下往上 = 日期 / EXIF(含镜头行) / 相机型号 / Logo。
 * 只为「开启且内容非空」的行分配位置（隐藏行不再占位），自底向上依次堆叠。
 * 水平锚点跟随 overlayAlign（渲染端按锚点语义对齐，布局不做测宽，任何字体下都精确）：
 * - center：x = 行中心（预览 -50% 平移 / 导出 textAlign:center）
 * - left：x = 左缘内缩锚点（渲染端左对齐）
 * - right：x = 右缘内缩锚点（渲染端右对齐：导出 textAlign:right / 预览 -100% 平移）
 * 与 computeFooterLayout 同源，预览（FooterInfo）与导出（exporter）共用，避免两端公式漂移。
 * 各行高度取各组生效字号（独立 ?? 整体），单独调大某组字号时整块自动上移，不会与相邻行重叠。
 * @param cfg 相框配置
 * @param canvasBottom 画布底缘（内容区坐标系 y 值）
 */
export function computeClassicLayout(cfg: FrameConfig, canvasBottom: number): FooterLayout {
  const center = DESIGN_CONTAINER / 2
  const exifS = exifTextStyle(cfg)
  const lensS = lensTextStyle(cfg)
  const dateS = dateTextStyle(cfg)
  const modelS = modelTextStyle(cfg)
  const showDate = cfg.showDate && !!cfg.dateText
  const hasLens = cfg.showLens && !!cfg.lensText
  const showExif = cfg.showExif && !!cfg.exifText
  const showModel = cfg.showCameraModel && !!cfg.cameraModel
  // 水平锚点（语义见函数注释）：不依赖文本宽度测量
  const rowX = () =>
    cfg.overlayAlign === 'left' ? CLASSIC_SIDE_INSET : cfg.overlayAlign === 'right' ? DESIGN_CONTAINER - CLASSIC_SIDE_INSET : center
  // EXIF 块高 = EXIF 行 +（镜头行 + 固定行距）：镜头行是块内附加行（仅当 EXIF 行也显示时）。
  // showExif 关闭但 showLens 开启时：镜头行升级为独立堆叠行（可独立拖拽）——
  // 修复：此前镜头行嵌在 EXIF 块内，参数行关闭时镜头行随容器一起消失（画布上不显示）。
  const lensInBlock = hasLens && showExif
  const exifBlockH = lensInBlock ? exifS.size + LENS_LINE_GAP + lensS.size : exifS.size
  // 顶部锚点（报头式）：阅读序（Logo → 型号 → 参数(+镜头) → 独立镜头行 → 日期）自顶向下堆叠，
  // 与底部锚点互为镜像——同一行序、锚点边互换（画布顶缘 = -(pad + bgExpand)，与底部「画布底缘」
  // 语义对称，overlayBottom 恒以画布边缘为基准）。首行 Logo 按 showLogo 占位推进
  // （底部锚点里 Logo 是末行无需推进；顶部锚点是首行，隐藏时也必须跳过其位）。
  if (cfg.overlayAnchor === 'top') {
    let cursor = -(cfg.padding + cfg.bgExpand) + cfg.overlayBottom
    const logo = { x: rowX(), y: cursor }
    if (cfg.showLogo) cursor += cfg.logoSize + CLASSIC_ROW_GAP
    const model = { x: rowX(), y: cursor }
    if (showModel) cursor += modelS.size + CLASSIC_ROW_GAP
    const exif = { x: rowX(), y: cursor }
    const lens = lensInBlock
      ? { x: exif.x, y: exif.y + exifS.size + LENS_LINE_GAP }
      : { x: rowX(), y: cursor }
    if (showExif) cursor += exifBlockH + CLASSIC_ROW_GAP
    if (hasLens && !showExif) cursor += lensS.size + CLASSIC_ROW_GAP
    const date = { x: rowX(), y: cursor }
    return { exif, date, model, lens, logo, divider: null }
  }
  const bottomEdge = canvasBottom - cfg.overlayBottom
  // 自底向上：日期 → EXIF(+镜头) / 镜头独立行 → 型号 → Logo，未开启/无内容的行不占位
  let cursor = bottomEdge
  const date = { x: rowX(), y: cursor - dateS.size }
  if (showDate) cursor -= dateS.size + CLASSIC_ROW_GAP
  const exif = { x: rowX(), y: cursor - exifBlockH }
  if (showExif) cursor -= exifBlockH + CLASSIC_ROW_GAP
  // 镜头行坐标：块内附加行（跟随 EXIF，渲染端不独立拖拽）或独立行（showExif 关闭时，占位堆叠）
  const lens = lensInBlock
    ? { x: exif.x, y: exif.y + exifS.size + LENS_LINE_GAP }
    : { x: rowX(), y: cursor - lensS.size }
  if (hasLens && !showExif) cursor -= lensS.size + CLASSIC_ROW_GAP
  const model = { x: rowX(), y: cursor - modelS.size }
  if (showModel) cursor -= modelS.size + CLASSIC_ROW_GAP
  const logo = { x: rowX(), y: cursor - cfg.logoSize }
  return {
    exif: exif,
    date: date,
    model: model,
    lens: lens,
    logo: logo,
    divider: null,
  }
}

// ===== card（手机白底水印卡）：对标小米标准徕卡水印排版 =====
export const CARD_INSET = 24 // 卡片距照片左右缘 / 内容左右内边距（同一值）
export const CARD_PAD_V = 18 // 卡片上下内边距
export const CARD_ROW_GAP = 10 // 卡内行距
export const CARD_RADIUS = 12 // 卡片圆角
export const CARD_BADGE_GAP = 16 // 右列与标块间距
export const CARD_BADGE_H = 34 // 标块高度
export const CARD_BADGE_FONT_SIZE = 20 // 标块文字字号（设计 px）

/** card 主题配色：白卡深字 / 黑卡浅字 */
export function cardThemeColors(theme: 'white' | 'black'): { card: string; primary: string; secondary: string } {
  return theme === 'black'
    ? { card: '#0D0D0D', primary: '#F2F2F2', secondary: '#9A9A9A' }
    : { card: '#FFFFFF', primary: '#1A1A1A', secondary: '#8A8A8A' }
}

/**
 * card 联名标块配色（预览与导出同源）：用户自定义优先，null 回退品牌默认。
 * 品牌默认：底色 = badge.bg ?? accent；文字色 = badge.fg ?? '#ffffff'；无匹配品牌回退黑底白字。
 */
export function cardBadgeColors(
  cfgBg: string | null | undefined,
  cfgFg: string | null | undefined,
  brandId: string,
): { bg: string; fg: string } {
  const phone = phoneBrandOf(brandId)
  return {
    bg: cfgBg ?? phone?.badge.bg ?? phone?.accent ?? '#111111',
    fg: cfgFg ?? phone?.badge.fg ?? '#ffffff',
  }
}

export interface CardRect {
  x: number
  y: number
  w: number
  h: number
}

/** card 布局的完整默认排版结果（内容区坐标） */
export interface CardLayout {
  card: CardRect
  model: CardRect
  date: CardRect | null
  exif: CardRect
  lens: CardRect | null
  badge: { x: number; y: number; w: number; h: number } | null
}

/**
 * 计算 card 白底水印卡的默认排版：左列（机型+日期）/ 右列（EXIF+镜头，右对齐）/ 右端联名标块。
 * @param cfg 相框配置
 * @param canvasBottom 画布底缘（内容区坐标系 y 值 = 实测画板高 − padding − bgExpand）
 */
export function computeCardLayout(cfg: FrameConfig, canvasBottom: number): CardLayout {
  const modelS = modelTextStyle(cfg)
  const exifS = exifTextStyle(cfg)
  const lensS = lensTextStyle(cfg)
  const dateS = dateTextStyle(cfg)
  const showModel = cfg.showCameraModel && !!cfg.cameraModel
  const showDate = cfg.cardShowDate && cfg.showDate && !!cfg.dateText
  const showExif = cfg.showExif && !!cfg.exifText
  const showLens = cfg.showLens && !!cfg.lensText

  // 型号统一走营销名映射（与导出/预览一致）；审查报告 R10：此前仅注释声称、代码未做
  const modelText = modelAlias(cfg.cameraModel)
  const modelW = showModel ? measureTextWidth(modelText, toCanvasFont(modelS, cfg.cameraModelItalic)) : 0
  const exifW = showExif ? measureTextWidth(cfg.exifText, toCanvasFont(exifS)) : 0
  const lensW = showLens ? measureTextWidth(cfg.lensText, toCanvasFont(lensS)) : 0
  const dateW = showDate ? measureTextWidth(cfg.dateText, toCanvasFont(dateS)) : 0

  // 标块：手机品牌且有联名文字时显示
  const phone = phoneBrandOf(cfg.brand)
  const badgeText = phone?.badge.text ?? null
  const badgeFont = `600 ${CARD_BADGE_FONT_SIZE}px ${cfg.fontFamily}`
  const badgeW = badgeText ? measureTextWidth(badgeText, badgeFont) + 24 : 0
  const badge = badgeText
    ? { x: 0, y: 0, w: badgeW, h: CARD_BADGE_H } // x/y 在卡片定位后回填
    : null

  // 左列高（机型 + 可选日期）；右列高（EXIF + 可选镜头）
  const leftH = modelS.size + (showDate ? CARD_ROW_GAP + dateS.size : 0)
  const rightH = exifS.size + (showLens ? CARD_ROW_GAP + lensS.size : 0)
  const contentH = Math.max(leftH, rightH, phone ? CARD_BADGE_H : 0)
  const cardH = CARD_PAD_V * 2 + contentH
  const card: CardRect = {
    x: CARD_INSET,
    y: Math.max(0, canvasBottom - cfg.overlayBottom - cardH),
    w: DESIGN_CONTAINER - CARD_INSET * 2,
    h: cardH,
  }

  const leftX = card.x + CARD_INSET
  const rightEdge = card.x + card.w - CARD_INSET - (badge ? badgeW + CARD_BADGE_GAP : 0)
  const row1Top = card.y + CARD_PAD_V

  // 左列：机型上行（缺省机型时日期占首行）；右列：EXIF 上行 + 镜头下行（右对齐）
  const model: CardRect = {
    x: leftX,
    y: row1Top + (contentH - (showDate ? modelS.size + CARD_ROW_GAP + dateS.size : modelS.size)) / 2,
    w: modelW,
    h: modelS.size,
  }
  const date: CardRect | null = showDate
    ? { x: leftX, y: model.y + modelS.size + CARD_ROW_GAP, w: dateW, h: dateS.size }
    : null
  const exif: CardRect = {
    x: rightEdge - exifW,
    y: row1Top + (contentH - (showLens ? exifS.size + CARD_ROW_GAP + lensS.size : exifS.size)) / 2,
    w: exifW,
    h: exifS.size,
  }
  const lens: CardRect | null = showLens
    ? { x: rightEdge - lensW, y: exif.y + exifS.size + CARD_ROW_GAP, w: lensW, h: lensS.size }
    : null
  if (badge) {
    badge.x = card.x + card.w - CARD_INSET - badgeW
    badge.y = card.y + (cardH - CARD_BADGE_H) / 2
  }
  return { card, model, date, exif, lens, badge }
}

// ===== magazine（杂志编辑）：顶部标题区 + 底部左取色色卡 / 右机型+参数+日期 =====
// 标题区位于上边留白内（模板把 padding 调大以容纳标题），底部信息右对齐照片右缘。
export const MAG_TITLE_INSET = 34 // 标题/副标题距内容区左缘
export const MAG_TITLE_TOP = 24 // 标题顶距画板顶缘（上边留白内）
export const MAG_TITLE_SIZE = 44 // 标题字号（设计 px）
// 标题专用衬线字体（预览/导出同源）：杂志刊头气质，与正文无衬线形成对比；
// 同时与最初参考样张（"Nature's poetry" 无衬线粗体）拉开区分度
export const MAG_TITLE_FONT = "Didot, 'Bodoni MT', 'Playfair Display', Georgia, 'Times New Roman', serif"
/** duo 分隔竖线最小高度（设计 px）：预览与导出共用（审查报告 R15，此前两端下限不一致） */
export const DIVIDER_MIN_H = 20
/** duo 分隔竖线透明度：预览 CSS 与导出绘制共用（审查报告 R15，此前 0.18/0.2 不一致） */
export const DIVIDER_ALPHA = 0.2
export const MAG_SUB_SIZE = 16 // 副标题字号（"PHOTOGRAPHED IN : 日期"）
export const MAG_SUB_GAP = 16 // 副标题与标题行距
export const MAG_SUB_LETTER_SPACING = 3 // 副标题字距
export const MAG_BOTTOM_INSET = 26 // 色卡距内容区左缘/下缘基准
export const MAG_SWATCH_W = 88 // 单个色块宽
export const MAG_SWATCH_H = 30 // 色块高
export const MAG_SWATCH_COUNT = 5 // 色块数
export const MAG_HEX_SIZE = 10 // 色卡 hex 色号字号（设计 px）
export const MAG_HEX_LETTER_SPACING = 0.4 // 色卡 hex 色号字距（设计 px）
export const MAG_HEX_OFFSET_Y = 3 // hex 色号距色卡下缘（设计 px）
export const MAG_RIGHT_INSET = 26 // 右侧文字块距内容区右缘
export const MAG_ROW_GAP = 12 // 右侧文字块行距

export interface MagazineLayout {
  /** 顶部大标题（上边留白内，左对齐） */
  title: { x: number; y: number }
  /** 标题实际字号（长标题自适应缩小后，渲染端据此绘制） */
  titleSize: number
  /** 副标题（PHOTOGRAPHED IN : 日期，左对齐）——日期只在副标题出现，不进右侧信息块 */
  subtitle: { x: number; y: number }
  /** 取色色卡条（底部左侧） */
  palette: { x: number; y: number; w: number; h: number }
  /** 右侧信息块：x 为右缘锚点（渲染端右对齐：导出 textAlign:right / 预览 -100% 平移） */
  model: { x: number; y: number }
  exif: { x: number; y: number }
}

/**
 * magazine 标题字号：超长标题按可用宽度自适应缩小（下限 22px），避免溢出右缘被裁断。
 * 测宽失败（jsdom）时返回基准字号，由渲染端兜底。
 */
export function magazineTitleFontSize(cfg: FrameConfig): number {
  if (!cfg.infoTitle) return MAG_TITLE_SIZE
  // 审查报告 R11：测宽字体必须与绘制完全一致（MAG_TITLE_FONT + italic 700），
  // 此前用 cfg.fontFamily 常规体测宽 → 自适应缩小量失准，长标题仍可能溢出右缘
  const w = measureTextWidth(cfg.infoTitle, `italic 700 ${MAG_TITLE_SIZE}px ${MAG_TITLE_FONT}`)
  const maxW = DESIGN_CONTAINER - MAG_TITLE_INSET - MAG_RIGHT_INSET
  if (w <= 0 || w <= maxW) return MAG_TITLE_SIZE
  return Math.max(22, Math.floor(MAG_TITLE_SIZE * (maxW / w)))
}

/**
 * 计算 magazine 布局的默认排版（内容区坐标，预览与导出同源）。
 * 标题区 y 以画板顶缘为基准换算到内容坐标系（负值 = 上边留白内）。
 * 右侧信息块只给右缘锚点、不做文本测宽（渲染端右对齐，任何字体/字号下都精确贴齐）。
 * @param cfg 相框配置
 * @param canvasBottom 画布底缘（内容区坐标系 y 值）
 */
export function computeMagazineLayout(cfg: FrameConfig, canvasBottom: number): MagazineLayout {
  const exifS = exifTextStyle(cfg)
  const modelS = modelTextStyle(cfg)
  const showExif = cfg.showExif && !!cfg.exifText

  // ===== 顶部标题区（上边留白内）：长标题自适应缩小，副标题随实际字号下移 =====
  const titleSize = magazineTitleFontSize(cfg)
  const titleY = -(cfg.padding + cfg.bgExpand) + MAG_TITLE_TOP
  const subtitleY = titleY + titleSize + MAG_SUB_GAP

  // ===== 底部右侧信息块：自底向上 参数 → 机型，右缘锚点 =====
  let cursor = canvasBottom - cfg.overlayBottom
  const exif = { x: DESIGN_CONTAINER - MAG_RIGHT_INSET, y: cursor - exifS.size }
  if (showExif) cursor -= exifS.size + MAG_ROW_GAP
  const model = { x: DESIGN_CONTAINER - MAG_RIGHT_INSET, y: cursor - modelS.size }

  // ===== 底部左侧取色色卡：与机型行垂直居中对齐 =====
  const palette = {
    x: MAG_BOTTOM_INSET,
    y: model.y + (modelS.size - MAG_SWATCH_H) / 2,
    w: MAG_SWATCH_COUNT * MAG_SWATCH_W,
    h: MAG_SWATCH_H,
  }

  return {
    title: { x: MAG_TITLE_INSET, y: titleY },
    titleSize,
    subtitle: { x: MAG_TITLE_INSET, y: subtitleY },
    palette,
    model,
    exif,
  }
}

// ===== vertical（竖排装裱，风格 C）：文字旋转 90° 沿照片左缘竖排 =====
// 对标徕卡/画廊签名款：文字列贴照片左缘自上而下阅读（旋转 90° 顺时针），
// 列自左向右 = 机型 → 参数 → 镜头 → 日期。整块压在照片上（不做边框带内嵌——
// padding 是四边等宽，带内锚定会因窄边框出界），文字颜色沿用明暗自适应 + 投影。
// 品牌 Logo 不参与竖排（横版字标旋转后观感差，画廊签名款本就无 Logo）；
// 机型字标同理禁用（矢量字标无旋转排版），一律文字渲染。
export const VERT_SIDE_INSET = 44 // 首列距内容区左缘（设计 px）
export const VERT_TOP_INSET = 40 // 文字起点距内容区顶缘（设计 px）
export const VERT_COL_GAP = 14 // 列间距（设计 px，即相邻列字号行盒之间的空隙）

/**
 * 计算 vertical 竖排布局的默认排版（内容区坐标，预览与导出同源）。
 * 复用 FooterLayout 承载：各元素 {x, y} = 该列旋转后文字起点的「列左缘 / 顶缘」，
 * 列厚度 = 该组生效字号（旋转后行盒宽度），文字长度即向下延伸量（渲染端旋转绘制）。
 * 已知限制：超长参数行可能超出照片下缘（竖排文字长度不受画布约束），靠用户关闭字段缓解。
 * @param cfg 相框配置
 * @param canvasBottom 画布底缘（内容区坐标系 y 值；当前竖排几何未用到，保留与其它布局同参签名）
 */
export function computeVerticalLayout(cfg: FrameConfig, canvasBottom: number): FooterLayout {
  void canvasBottom
  const exifS = exifTextStyle(cfg)
  const lensS = lensTextStyle(cfg)
  const modelS = modelTextStyle(cfg)
  const hasLens = cfg.showLens && !!cfg.lensText
  const showExif = cfg.showExif && !!cfg.exifText
  const showModel = cfg.showCameraModel && !!cfg.cameraModel
  const topY = VERT_TOP_INSET
  // 列自左向右推进：列宽 = 该列生效字号 + 列距；隐藏列不占位（位置仍赋值，渲染端按开关跳过）
  let x = VERT_SIDE_INSET
  const model = { x, y: topY }
  if (showModel) x += modelS.size + VERT_COL_GAP
  const exif = { x, y: topY }
  if (showExif) x += exifS.size + VERT_COL_GAP
  const lens = { x, y: topY }
  if (hasLens) x += lensS.size + VERT_COL_GAP
  const date = { x, y: topY }
  return { exif, date, model, lens, logo: { x, y: topY }, divider: null }
}

// ===== poster（海报参数表）：机型 + 刊头标语 + 四栏「数值/单位」参数表 =====
// 学习「大师水印」画册款：底部留白带自下而上 = 参数表 → 刊头标语(可选, infoTitle) → 机型(可选)。
// 四栏 = 焦距(mm) / 光圈(f) / 快门(s) / ISO，数值来自 exifRaw（缺失栏跳过），栏间细线分隔。
// 数值行字号 = 全局 fontSize（粗）、单位行 = dateFontSize ?? fontSize*0.62（细）。
export const POSTER_COL_GAP = 26 // 栏间距（分隔线居中）
export const POSTER_ROW_GAP = 12 // 参数表与标语/机型行距
export const POSTER_V_GAP = 8 // 数值与单位行距

export interface PosterColumn {
  /** 列左缘（内容区坐标），数值/单位在列内居中（渲染端 textAlign=center） */
  x: number
  w: number
  value: string
  unit: string
  /** 数值行顶 / 单位行顶（内容区坐标） */
  valueY: number
  unitY: number
}

export interface PosterLayout {
  /** 机型行（x = 行中心锚点；渲染端居中绘制，优先机型字标） */
  model: FooterRect
  /** 刊头标语行（infoTitle，衬线斜体，x = 行中心锚点）；未填写为 null */
  title: FooterRect | null
  cols: PosterColumn[]
  dividers: Array<{ x: number; y: number; h: number }>
}

/**
 * 计算 poster 海报参数表的默认排版（内容区坐标，预览与导出同源）。
 * 无 EXIF 参数时参数表为空（cols/dividers 空），仅渲染机型/标语行。
 * 注意：列宽用 measureTextWidth 实测，无 canvas 环境（jsdom/测试）宽度为 0、各列收拢到中轴，
 * 位置仅保证结构正确——真实渲染以浏览器实测为准。
 */
export function computePosterLayout(cfg: FrameConfig, canvasBottom: number): PosterLayout {
  const center = DESIGN_CONTAINER / 2
  const modelS = modelTextStyle(cfg)
  const valueSize = cfg.fontSize
  const unitSize = cfg.dateFontSize ?? Math.round(cfg.fontSize * 0.62)

  // 自底向上：单位行贴 overlayBottom → 数值行 → 标语 → 机型
  const unitY = canvasBottom - cfg.overlayBottom - unitSize
  const valueY = unitY - POSTER_V_GAP - valueSize

  const params = posterParams(cfg.exifRaw, { eqFocal: cfg.eqFocal, cropFactor: cfg.cropFactor })
  const cols: PosterColumn[] = []
  const dividers: Array<{ x: number; y: number; h: number }> = []
  if (params.length) {
    const widths = params.map((p) =>
      Math.max(
        measureTextWidth(p.v, `${cfg.textWeight} ${valueSize}px ${cfg.fontFamily}`),
        measureTextWidth(p.u, `400 ${unitSize}px ${cfg.fontFamily}`),
      ),
    )
    const total = widths.reduce((a, b) => a + b, 0) + (params.length - 1) * POSTER_COL_GAP
    let cursor = center - total / 2
    const colH = unitY + unitSize - valueY
    params.forEach((p, i) => {
      cols.push({ x: cursor, w: widths[i], value: p.v, unit: p.u, valueY, unitY })
      if (i > 0) dividers.push({ x: cursor - POSTER_COL_GAP / 2, y: valueY, h: colH })
      cursor += widths[i] + POSTER_COL_GAP
    })
  }

  // 顶部行：标语（可选）在参数表上方，机型（可选）在最上；位置恒输出，渲染端按开关跳过
  let top = params.length ? valueY : canvasBottom - cfg.overlayBottom
  let title: FooterRect | null = null
  if (cfg.infoTitle) {
    top -= POSTER_ROW_GAP + MAG_SUB_SIZE
    title = { x: center, y: top }
  }
  const model: FooterRect = { x: center, y: top - POSTER_ROW_GAP - modelS.size }

  return { model, title, cols, dividers }
}

// ===== calendar（月历边框）：底部留白带渲染「年月标题行 + 星期表头 + 6 行公历/农历网格」 =====
// 学习 FrameElf「日历边框」：网格水平居中于内容区，拍摄日期用强调色圆点标记；
// 农历标注由 core/lunar.ts 换算（初一显示农历月名）。几何常量三端共用。
export const CAL_COL_PITCH = 72 // 列距（含单元格间隙；单元格本身右对齐下一列起点）
export const CAL_CELL_W = 64 // 单元格宽（文本居中锚 = 列中心）
export const CAL_ROW_H = 58 // 行高（公历日 + 农历行 + 呼吸）
export const CAL_DAY_SIZE = 26 // 公历日字号
export const CAL_LUNAR_SIZE = 13 // 农历字号
export const CAL_WEEKDAY_SIZE = 15 // 星期表头字号
export const CAL_TITLE_SIZE = 34 // 年份字号（衬线）
export const CAL_MONTH_SIZE = 15 // 月名字号
export const CAL_TITLE_RULE_GAP = 20 // 标题行基线到分隔线
export const CAL_WEEKDAY_GAP = 16 // 分隔线到星期表头
export const CAL_GRID_GAP = 12 // 星期表头到首行

const CAL_MONTH_ZH = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二']
const CAL_MONTH_EN = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER']

export interface CalendarCell {
  /** 列号 0..6（0 = 周日） */
  col: number
  /** 公历日（1–31） */
  day: number
  /** 农历短文本（初一 → 农历月名，如「八月」；其余如「十五」「廿三」） */
  lunar: string
  /** 公历日文本 top（内容区坐标；文本按列中心居中绘制） */
  y: number
  /** 拍摄日期强调 */
  highlight: boolean
}

export interface CalendarLayout {
  /** 网格左缘（内容区坐标）；网格宽 = 7 × CAL_COL_PITCH − (CAL_COL_PITCH − CAL_CELL_W) */
  gridX: number
  /** 年份（左对齐锚点，衬线）与月名（右对齐锚点），同一行 */
  titleYearY: number
  titleMonthY: number
  /** 标题下分隔线 y（内容区坐标） */
  ruleY: number
  /** 星期表头 top */
  weekdayY: number
  /** 首行公历日 top */
  firstRowY: number
  /** 6 行 × 7 列（空位 null），行内元素携带绝对 y */
  weeks: Array<Array<CalendarCell | null>>
  /** 高亮日期强调色（已按明暗/自定义解析，渲染端直接用） */
  accent: string
  /** 月名文本（如「SEPTEMBER · 九月」）与年份数字（如「2026」） */
  titleYearText: string
  titleMonthText: string
}

/** 日历强调色：自定义优先；浅色纯色底用珊瑚红，深底/照片底用暖橙（暗角/照片上更可辨） */
export function calendarAccentColor(cfg: FrameConfig): string {
  if (cfg.calendarAccent) return cfg.calendarAccent
  return cfg.bgMode === 'solid' && hexLuminance(cfg.bgColor) > 0.6 ? '#D4553F' : '#E8A54B'
}

/** 日历基准日期：优先拍摄日期文本（用户可改），其次 EXIF 原始日期，最后今天 */
export function calendarRefDate(cfg: FrameConfig, refDate?: Date): Date {
  if (refDate) return refDate
  const parsed = parseDisplayDate(cfg.dateText) ?? parseDisplayDate(cfg.exifRaw?.dateTimeOriginal ?? '')
  if (parsed) {
    const m = parsed.match(/^(\d{4})[:/-](\d{1,2})[:/-](\d{1,2})/)
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  }
  return new Date()
}

/**
 * 计算 calendar 月历布局（内容区坐标，预览与导出同源）。
 * 网格底部贴 overlayBottom，向上堆叠：网格 → 星期表头 → 分隔线 → 年月标题行。
 * 恒输出 6 行（空位 null），保证不同月份留白带高度稳定、缩略图不跳动。
 * @param cfg 相框配置
 * @param canvasBottom 画布底缘（内容区坐标系 y 值）
 * @param refDate 测试注入的基准日期；缺省由 calendarRefDate 推导
 */
export function computeCalendarLayout(cfg: FrameConfig, canvasBottom: number, refDate?: Date): CalendarLayout {
  const ref = calendarRefDate(cfg, refDate)
  const year = ref.getFullYear()
  const month = ref.getMonth()
  const accent = calendarAccentColor(cfg)

  // 网格几何：水平居中
  const gridW = CAL_COL_PITCH * 6 + CAL_CELL_W
  const gridX = (DESIGN_CONTAINER - gridW) / 2
  const rows = 6
  const gridH = rows * CAL_ROW_H

  // 自底向上：网格 → 星期表头 → 分隔线 → 年月标题行
  const firstRowY = canvasBottom - cfg.overlayBottom - gridH
  const weekdayY = firstRowY - CAL_GRID_GAP - CAL_WEEKDAY_SIZE
  const ruleY = weekdayY - CAL_WEEKDAY_GAP
  const titleY = ruleY - CAL_TITLE_RULE_GAP - CAL_TITLE_SIZE

  // 月历网格：首日星期（0=周日）+ 当月天数 → 6 行 × 7 列（空位 null）
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const firstWeekday = new Date(year, month, 1).getDay()
  // 高亮日 = 基准日期当日（当月内才有意义）
  const weeks: Array<Array<CalendarCell | null>> = []
  let day = 1
  for (let r = 0; r < rows; r++) {
    const row: Array<CalendarCell | null> = []
    for (let col = 0; col < 7; col++) {
      const idx = r * 7 + col
      if (idx < firstWeekday || day > daysInMonth) {
        row.push(null)
        continue
      }
      const cellDate = new Date(year, month, day)
      row.push({
        col,
        day,
        lunar: cfg.calendarShowLunar ? lunarLabel(cellDate) : '',
        y: firstRowY + r * CAL_ROW_H,
        highlight: day === ref.getDate(),
      })
      day++
    }
    weeks.push(row)
  }

  return {
    gridX,
    titleYearY: titleY,
    titleMonthY: titleY + (CAL_TITLE_SIZE - CAL_MONTH_SIZE) / 2,
    ruleY,
    weekdayY,
    firstRowY,
    weeks,
    accent,
    titleYearText: `${year}`,
    titleMonthText: `${CAL_MONTH_EN[month]} · ${CAL_MONTH_ZH[month]}月`,
  }
}

// ===== sport（运动遥测）：底部留白带渲染「轨迹缩略卡 + 四栏数值/单位遥测参数 + 标语/机型」 =====
// 学习 FrameElf「运动边框」：距离/时长/均速/爬升四栏（数值粗大在上、单位细小在下，
// 栏间细线，与 poster 同构）；轨迹缩略卡居中置于参数表上方（GPX 轨迹等比缩放）。
export const SPORT_COL_GAP = 26 // 栏间距（分隔线居中，与 poster 一致）
export const SPORT_ROW_GAP = 14 // 遥测表与上方元素的行距
export const SPORT_V_GAP = 8 // 数值与单位行距
export const SPORT_TRACK_W = 150 // 轨迹缩略卡宽
export const SPORT_TRACK_H = 96 // 轨迹缩略卡高
export const SPORT_TRACK_RADIUS = 10 // 轨迹卡圆角
export const SPORT_TRACK_PAD = 12 // 轨迹卡内边距（轨迹线与卡缘距离）

export interface SportLayout {
  /** 机型行（居中锚点）；未开启为 null */
  model: FooterRect | null
  /** 标语行（infoTitle，衬线斜体，居中锚点）；未填写为 null */
  title: FooterRect | null
  /** 轨迹缩略卡（内容区坐标）；关闭或无轨迹为 null */
  track: { x: number; y: number; w: number; h: number } | null
  /** 轨迹折线（内容区坐标，等比缩放至卡内） */
  trackPoints: Array<{ x: number; y: number }>
  cols: PosterColumn[]
  dividers: Array<{ x: number; y: number; h: number }>
}

/** 时长列显示值：分钟取整（GPX 无时间标签时 durationS=0 → 列跳过） */
function sportDurationMin(durationS: number): string {
  return `${Math.max(1, Math.round(durationS / 60))}`
}

/** 由遥测数据组装遥测列（缺失字段自动跳过）；无遥测返回空数组 */
export function sportColumns(telemetry: FrameConfig['telemetry']): Array<{ value: string; unit: string }> {
  if (!telemetry) return []
  const out: Array<{ value: string; unit: string }> = []
  if (telemetry.distanceKm > 0) out.push({ value: telemetry.distanceKm >= 100 ? telemetry.distanceKm.toFixed(0) : telemetry.distanceKm.toFixed(1), unit: 'km' })
  if (telemetry.durationS > 0) out.push({ value: sportDurationMin(telemetry.durationS), unit: 'min' })
  if (telemetry.avgSpeedKmh > 0) out.push({ value: telemetry.avgSpeedKmh.toFixed(1), unit: 'km/h' })
  if (telemetry.elevGainM > 0) out.push({ value: `${Math.round(telemetry.elevGainM)}`, unit: 'm' })
  return out
}

/**
 * 计算 sport 运动遥测布局（内容区坐标，预览与导出同源）。
 * 无遥测数据时仅渲染标语/机型行（cols/track 为空）。
 */
export function computeSportLayout(cfg: FrameConfig, canvasBottom: number): SportLayout {
  const center = DESIGN_CONTAINER / 2
  const modelS = modelTextStyle(cfg)
  const valueSize = cfg.fontSize
  const unitSize = cfg.dateFontSize ?? Math.round(cfg.fontSize * 0.62)

  // 自底向上：单位行贴 overlayBottom → 数值行
  const unitY = canvasBottom - cfg.overlayBottom - unitSize
  const valueY = unitY - SPORT_V_GAP - valueSize

  const fields = sportColumns(cfg.telemetry)
  const cols: PosterColumn[] = []
  const dividers: Array<{ x: number; y: number; h: number }> = []
  if (fields.length) {
    const widths = fields.map((p) =>
      Math.max(
        measureTextWidth(p.value, `${cfg.textWeight} ${valueSize}px ${cfg.fontFamily}`),
        measureTextWidth(p.unit, `400 ${unitSize}px ${cfg.fontFamily}`),
      ),
    )
    const total = widths.reduce((a, b) => a + b, 0) + (fields.length - 1) * SPORT_COL_GAP
    let cursor = center - total / 2
    const colH = unitY + unitSize - valueY
    fields.forEach((p, i) => {
      cols.push({ x: cursor, w: widths[i], value: p.value, unit: p.unit, valueY, unitY })
      if (i > 0) dividers.push({ x: cursor - SPORT_COL_GAP / 2, y: valueY, h: colH })
      cursor += widths[i] + SPORT_COL_GAP
    })
  }

  // 轨迹缩略卡：居中置于遥测表上方（等比缩放归一化轨迹 → 卡内绘制区）
  const pts = cfg.telemetry?.points ?? []
  let track: SportLayout['track'] = null
  let trackPoints: Array<{ x: number; y: number }> = []
  if (cfg.sportShowTrack && pts.length >= 2) {
    track = { x: center - SPORT_TRACK_W / 2, y: valueY - SPORT_ROW_GAP - SPORT_TRACK_H, w: SPORT_TRACK_W, h: SPORT_TRACK_H }
    const pad = SPORT_TRACK_PAD
    const innerW = SPORT_TRACK_W - pad * 2
    const innerH = SPORT_TRACK_H - pad * 2
    trackPoints = pts.map((p) => ({
      x: track!.x + pad + p.x * innerW,
      y: track!.y + SPORT_TRACK_H - pad - p.y * innerH,
    }))
  }

  // 顶部行：标语在轨迹卡/遥测表上方，机型在最上
  let top = cols.length
    ? valueY
    : track
      ? track.y
      : canvasBottom - cfg.overlayBottom
  let title: FooterRect | null = null
  if (cfg.infoTitle) {
    top -= SPORT_ROW_GAP + MAG_SUB_SIZE
    title = { x: center, y: top }
  }
  const model = cfg.showCameraModel && cfg.cameraModel ? { x: center, y: top - SPORT_ROW_GAP - modelS.size } : null

  return { model, title, track, trackPoints, cols, dividers }
}
