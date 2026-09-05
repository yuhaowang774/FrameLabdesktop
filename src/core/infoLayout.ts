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
 */
export function computeFooterLayout(cfg: FrameConfig, canvasBottom: number, logoRatio: number): FooterLayout {
  const center = DESIGN_CONTAINER / 2
  const exifS = exifTextStyle(cfg)
  const lensS = lensTextStyle(cfg)
  const modelS = modelTextStyle(cfg)
  // duo 下日期默认沿用机型样式组（灰细小字，与样例一致）；
  // 只要用户改了一个日期独立属性，就以该组生效样式为准（计算布局/测量宽度）。
  const usesModelDateStyle =
    cfg.infoLayout === 'duo' &&
    cfg.dateFontFamily === null &&
    cfg.dateFontSize === null &&
    cfg.dateTextWeight === null &&
    cfg.dateTextOpacity === null
  const dateS = usesModelDateStyle ? modelS : dateTextStyle(cfg)
  const exifH = exifS.size
  const modelH = modelS.size
  const showDate = cfg.showDate && !!cfg.dateText
  const showExif = cfg.showExif && !!cfg.exifText
  const hasLens = cfg.showLens && !!cfg.lensText
  const bottom = canvasBottom - cfg.overlayBottom
  const logoW = cfg.logoSize * logoRatio

  // ===== 杂志双栏（duo）：左=镜头(粗)+机型(灰细) / 中=Logo / 右栏=参数(粗)+日期(灰细)，右栏右缘对齐照片右缘 =====
  if (cfg.infoLayout === 'duo') {
    // 宽度测量用各组生效样式：单独改 EXIF/日期字体或字号后，右缘对齐仍然准确
    const exifW = measureTextWidth(cfg.exifText, toCanvasFont(exifS))
    const dateFont = toCanvasFont(dateS, usesModelDateStyle ? cfg.cameraModelItalic : false)
    const dateW = measureTextWidth(cfg.dateText, dateFont)
    const rightW = Math.max(showExif ? exifW : 0, showDate ? dateW : 0)
    const rightX = DESIGN_CONTAINER - DUO_INSET - rightW
    const dateY = bottom - modelH
    const exifY = showDate ? dateY - DUO_ROW_GAP - exifH : bottom - exifH
    // 文字块高度：右栏（参数+日期）与左栏（镜头+机型）取较高者。
    // 任一组字号被单独调大时块同步增高，避免两栏内部行重叠。
    const rightH =
      (showExif ? exifH : 0) + (showExif && showDate ? DUO_ROW_GAP : 0) + (showDate ? modelH : 0)
    const leftH = (hasLens ? lensS.size + DUO_ROW_GAP : 0) + modelH
    const blockH = Math.max(0, Math.max(rightH, leftH))
    const blockTop = bottom - blockH
    // 左栏：镜头行顶对齐块顶；无镜头时机型行在块内垂直居中
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
          ? // 竖线覆盖信息文字块高度：顶部对齐块顶（SONY/镜头行），底部对齐块底（日期行底），
            // 不侵入下方白框留白带（参考样例：竖线止于文字底部），调下边宽度时信息块随之居中于留白上方
            { x: dividerX, y: blockTop, h: Math.max(0, bottom - blockTop) }
          : null,
    }
  }

  // ===== 悬浮居中双行（inline）：行1 = Logo + 机型 内联居中；行2 = 参数 居中 =====
  const exifY = bottom - exifH
  const modelW = measureTextWidth(cfg.cameraModel, toCanvasFont(modelS, cfg.cameraModelItalic))
  const showModel = cfg.showCameraModel && !!cfg.cameraModel
  // 手机品牌的 Logo 是文字标记（HUAWEI/XIAOMI…），与机型文本（通常含品牌名）并排显示会重复，
  // 行1 仅保留机型居中；相机品牌的图形 Logo 正常内联。
  const showLogoInline = cfg.showLogo && !phoneBrandOf(cfg.brand)
  const row1H = Math.max(showLogoInline ? cfg.logoSize : 0, showModel ? modelH : 0)
  const row1Y = exifY - INLINE_ROW_GAP - row1H
  const groupW = showLogoInline
    ? (showModel ? logoW + INLINE_LOGO_GAP + modelW : logoW)
    : modelW
  const logoX = center - groupW / 2
  // 镜头行：行1（Logo+机型）上方的独立居中行（showLens 开启时占位，避免与机型行重叠）
  const hasLensRow = cfg.showLens && !!cfg.lensText
  const lensY = hasLensRow ? row1Y - INLINE_ROW_GAP - lensS.size : row1Y
  return {
    exif: { x: center - measureTextWidth(cfg.exifText, toCanvasFont(exifS)) / 2, y: exifY },
    date: { x: center, y: exifY },
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

  // 型号统一走营销名映射（与导出/预览一致）
  const modelText = cfg.cameraModel
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
export const MAG_SUB_SIZE = 16 // 副标题字号（"PHOTOGRAPHED IN : 日期"）
export const MAG_SUB_GAP = 16 // 副标题与标题行距
export const MAG_SUB_LETTER_SPACING = 3 // 副标题字距
export const MAG_BOTTOM_INSET = 26 // 色卡距内容区左缘/下缘基准
export const MAG_SWATCH_W = 88 // 单个色块宽
export const MAG_SWATCH_H = 30 // 色块高
export const MAG_SWATCH_COUNT = 5 // 色块数
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
  const w = measureTextWidth(cfg.infoTitle, `700 ${MAG_TITLE_SIZE}px ${cfg.fontFamily}`)
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
