// 模板缩略图：由模板配置程序化生成 SVG 示意图（无需真实照片即可预览样式）。
//
// 一致性保证：
// - 画布几何与 core/exporter.ts 同源（padding / borderRatio / bgExpand / bgBottomRatio / scale / frameRatio）；
// - duo / inline 的 INFO 排版直接复用 core/infoLayout 的共享计算（预览与导出同一函数）；
// - 文字颜色复用 core/colorUtils 的明暗自适应规则。
// 因此缩略图的留白比例、圆角、信息区排布与真实成片一致，仅把照片替换为示意渐变。
import type { FrameConfig } from './types'
import { defaultFrameConfig } from './types'
import { DESIGN_CONTAINER, phoneBrandOf } from './constants'
import { computeFooterLayout, computeMagazineLayout, computeCardLayout, computeVerticalLayout, computePosterLayout, computeCalendarLayout, computeSportLayout, calendarAccentColor, magazineTitleFontSize, measureTextWidth, cardThemeColors, cardBadgeColors, CARD_RADIUS, CARD_BADGE_FONT_SIZE, MAG_SUB_SIZE, MAG_SWATCH_COUNT, MAG_SWATCH_W, MAG_SWATCH_H, CLASSIC_SIDE_INSET, CLASSIC_ROW_GAP, LENS_LINE_GAP, CAL_COL_PITCH, CAL_CELL_W, CAL_DAY_SIZE } from './infoLayout'
import { footerTextColor, logoAutoColor, hexLuminance } from './colorUtils'
import { exportFrame } from './exporter'
import type { ImgSource } from './bgRenderer'
import { sourceSize } from './photoEdit'
import { resolveLogo, preloadBrandLogo } from '../composables/useLogoStore'
import { FALLBACK_PALETTE } from './photoPalette'

/** 示意文本：让 INFO 按真实字宽排版（模板本身不保存 EXIF 文本） */
const DEMO = {
  exif: '50mm f/1.8 1/200s ISO400',
  date: '2026.08.30',
  model: 'ILCE-7RM5',
  lens: 'FE 50mm F1.8',
}

/** 示意照片宽高比（3:2） */
const DEMO_ASPECT = 3 / 2
/** 示意运动遥测（sport 布局模板缩略图渲染源；模板本身不保存遥测数据） */
const DEMO_TELEMETRY: FrameConfig['telemetry'] = {
  distanceKm: 12.4,
  durationS: 5025,
  avgSpeedKmh: 8.9,
  maxSpeedKmh: 15.2,
  elevGainM: 486,
  maxAltM: 1240,
  startTime: '2026-08-30T06:40:00',
  points: [
    { x: 0.06, y: 0.12 }, { x: 0.18, y: 0.3 }, { x: 0.32, y: 0.24 }, { x: 0.44, y: 0.48 },
    { x: 0.58, y: 0.66 }, { x: 0.5, y: 0.82 }, { x: 0.66, y: 0.92 }, { x: 0.8, y: 0.78 },
    { x: 0.72, y: 0.56 }, { x: 0.88, y: 0.4 }, { x: 0.94, y: 0.18 },
  ],
}
/** 无真实 Logo 时的兜底宽高比（与 FooterInfo 一致） */
const FALLBACK_LOGO_RATIO = 2.6
/** 文字墨迹高度占字号的比例（示意条高度） */
const INK_RATIO = 0.66
/** 字宽测量的兜底系数（jsdom 等无真实 measureText 环境） */
const FALLBACK_CHAR_RATIO = 0.52

let uid = 0

export interface ThumbOptions {
  /** Logo 宽高比（w/h）；缺省用 2.6 兜底 */
  logoRatio?: number
}

/** 保留两位小数，避免 SVG 属性出现长浮点 */
function r2(v: number): number {
  return Math.round(v * 100) / 100
}

/** 运行环境是否支持 canvas 文字测量（仅探测一次，避免无 canvas 环境反复报错） */
let measureAvailable: boolean | null = null

/** 文本宽度：无真实测量环境时按字符数估算，保证缩略图始终有内容 */
function textWidth(text: string, font: string, size: number): number {
  if (measureAvailable === null) {
    try {
      measureAvailable = !!document.createElement('canvas').getContext('2d')
    } catch {
      measureAvailable = false
    }
  }
  const w = measureAvailable ? measureTextWidth(text, font) : 0
  return w > 0 ? w : text.length * size * FALLBACK_CHAR_RATIO
}

/** 生成模板缩略图的 SVG 源码 */
export function templateThumbSvg(config: Partial<FrameConfig>, opts: ThumbOptions = {}): string {
  const c: FrameConfig = { ...defaultFrameConfig, ...config }
  const gid = `tt${++uid}`
  const logoRatio = opts.logoRatio && opts.logoRatio > 0 ? opts.logoRatio : FALLBACK_LOGO_RATIO

  // ===== 画布几何（设计 px，与 exporter.ts 同源）=====
  const pad = Math.max(0, c.padding)
  const padBottom = pad + Math.max(0, c.borderRatio)
  const bgExpand = Math.max(0, c.bgExpand || 0)
  const bgBottomExpand = bgExpand + Math.max(0, c.bgBottomRatio || 0)

  const photoW = (DESIGN_CONTAINER * c.scale) / 100
  const photoH = photoW / DEMO_ASPECT
  // 比例模式：反推内容高使「整体画布」宽高比 = frameRatio（与 exporter 同源）
  const contentH = c.frameRatio
    ? Math.max(0, (DESIGN_CONTAINER + 2 * bgExpand + 2 * pad) / c.frameRatio - bgBottomExpand - pad - padBottom)
    : photoH

  const canvasW = DESIGN_CONTAINER + 2 * bgExpand + 2 * pad
  const canvasH = contentH + pad + padBottom + bgExpand + bgBottomExpand

  const photoX = pad + bgExpand + (DESIGN_CONTAINER - photoW) / 2
  const photoY = pad + bgExpand + (c.frameRatio ? (contentH - photoH) / 2 : 0)

  const innerW = canvasW - 2 * pad
  const innerH = canvasH - pad - padBottom

  const noFrame = pad <= 0 && bgExpand <= 0
  const outerR = Math.max(0, noFrame ? c.photoRadius : c.borderRadius)
  const innerR = Math.max(0, noFrame ? c.photoRadius : c.borderRadius - pad)
  const photoR = Math.max(0, Math.min(c.photoRadius, Math.min(photoW, photoH) / 2))

  // ===== 颜色 =====
  const text = footerTextColor(c.bgMode, c.bgColor, 0.95)
  // Logo 着色复用与导出端同一解析（'auto' → 浅底黑 / 深底白）
  const logoFill = logoAutoColor(c.logoColor, c.bgMode, c.bgColor)
  const shadowOpacity = r2(Math.max(0, Math.min(1, c.shadow)) * 0.5)

  // ===== INFO 示意元素 =====
  const ink = (size: number) => Math.max(1, size * INK_RATIO)
  const bar = (x: number, y: number, size: number, w: number, opacity: number, color: string) =>
    w <= 0
      ? ''
      : `<rect x="${r2(x)}" y="${r2(y + size / 2 - ink(size) / 2)}" width="${r2(w)}" height="${r2(ink(size))}" rx="${r2(ink(size) / 2)}" fill="${color}" opacity="${r2(opacity)}"/>`

  const exifFontStr = `${c.textWeight} ${c.fontSize}px ${c.fontFamily}`
  const modelFontStr = `${c.cameraModelItalic ? 'italic ' : ''}${c.cameraModelWeight} ${c.cameraModelSize}px ${c.cameraModelFont}`

  const exifW = textWidth(DEMO.exif, exifFontStr, c.fontSize)
  const dateW = textWidth(DEMO.date, modelFontStr, c.cameraModelSize)
  const modelW = textWidth(DEMO.model, modelFontStr, c.cameraModelSize)
  const lensW = textWidth(DEMO.lens, exifFontStr, c.fontSize)
  const logoW = c.logoSize * logoRatio

  let info = ''
  // 引擎（computeFooterLayout/computeMagazineLayout/computeVerticalLayout/computeCardLayout 之外的
  // 共享布局函数）输出的是内容区坐标系（照片左上角为原点）；SVG 其余图层为画布坐标系。
  // 这三个分支的元素先写入 infoContent，最后统一平移 (pad + bgExpand) 对齐到画布坐标。
  let infoContent = ''
  if (c.infoLayout === 'duo' || c.infoLayout === 'inline') {
    // duo / inline：直接复用预览与导出共用的默认排版
    const layout = computeFooterLayout(
      { ...c, exifText: DEMO.exif, dateText: DEMO.date, cameraModel: DEMO.model, lensText: DEMO.lens },
      canvasH - pad - bgExpand,
      logoRatio,
    )
    if (c.showExif) infoContent += bar(layout.exif.x, layout.exif.y, c.fontSize, exifW, c.textOpacity, text)
    if (c.showDate) infoContent += bar(layout.date.x, layout.date.y, c.cameraModelSize, dateW, c.cameraModelOpacity, text)
    if (c.showCameraModel) infoContent += bar(layout.model.x, layout.model.y, c.cameraModelSize, modelW, c.cameraModelOpacity, text)
    if (c.showLens) infoContent += bar(layout.lens.x, layout.lens.y, c.fontSize, lensW, c.textOpacity, text)
    if (c.showLogo) {
      infoContent += `<rect x="${r2(layout.logo.x)}" y="${r2(layout.logo.y)}" width="${r2(logoW)}" height="${r2(c.logoSize)}" rx="${r2(c.logoSize * 0.12)}" fill="${logoFill}" opacity="${r2(c.logoOpacity)}"/>`
    }
    if (layout.divider) {
      infoContent += `<rect x="${r2(layout.divider.x)}" y="${r2(layout.divider.y)}" width="${r2(Math.max(1, c.fontSize * 0.06))}" height="${r2(layout.divider.h)}" fill="${text}" opacity="0.28"/>`
    }
  } else if (c.infoLayout === 'magazine') {
    // magazine：顶部标题区 + 底部左取色色卡 / 右机型+参数+日期（与 computeMagazineLayout 同源）
    const layout = computeMagazineLayout(
      { ...c, exifText: DEMO.exif, dateText: DEMO.date, cameraModel: DEMO.model, lensText: DEMO.lens },
      canvasH - pad - bgExpand,
    )
    const titleText = c.infoTitle || ''
    const subText = c.showDate ? `PHOTOGRAPHED IN : ${DEMO.date}` : ''
    const titleSize = magazineTitleFontSize(c)
    const titleW = titleText ? textWidth(titleText, `700 ${titleSize}px ${c.fontFamily}`, titleSize) : 0
    const subW = subText ? textWidth(subText, `500 ${MAG_SUB_SIZE}px ${c.fontFamily}`, MAG_SUB_SIZE) : 0
    if (titleText) infoContent += bar(layout.title.x, layout.title.y, titleSize, titleW, 0.95, text)
    if (subText) infoContent += bar(layout.subtitle.x, layout.subtitle.y, MAG_SUB_SIZE, subW, 0.55, text)
    if (c.showPalette) {
      for (let i = 0; i < MAG_SWATCH_COUNT; i++) {
        infoContent += `<rect x="${r2(layout.palette.x + i * MAG_SWATCH_W)}" y="${r2(layout.palette.y)}" width="${r2(MAG_SWATCH_W)}" height="${r2(MAG_SWATCH_H)}" fill="${FALLBACK_PALETTE[i % FALLBACK_PALETTE.length]}"/>`
        if (c.paletteHex) {
          infoContent += `<text x="${r2(layout.palette.x + i * MAG_SWATCH_W + MAG_SWATCH_W / 2)}" y="${r2(layout.palette.y + MAG_SWATCH_H + 11)}" font-size="9" text-anchor="middle" fill="${text}" opacity="0.6">${FALLBACK_PALETTE[i % FALLBACK_PALETTE.length].toUpperCase()}</text>`
        }
      }
    }
    if (c.showCameraModel) infoContent += bar(layout.model.x - modelW, layout.model.y, c.cameraModelSize, modelW, c.cameraModelOpacity, text)
    if (c.showExif) infoContent += bar(layout.exif.x - exifW, layout.exif.y, c.fontSize, exifW, c.textOpacity * 0.6, text)
  } else if (c.infoLayout === 'card') {
    // card：直接复用预览与导出共用的 computeCardLayout（卡片底 + 左右列墨条 + 联名标块）
    const layout = computeCardLayout(
      { ...c, exifText: DEMO.exif, dateText: DEMO.date, cameraModel: DEMO.model, lensText: DEMO.lens },
      canvasH - pad - bgExpand,
    )
    const theme = cardThemeColors(c.infoCardTheme)
    infoContent += `<rect x="${r2(layout.card.x)}" y="${r2(layout.card.y)}" width="${r2(layout.card.w)}" height="${r2(layout.card.h)}" rx="${r2(CARD_RADIUS)}" fill="${theme.card}"/>`
    if (c.showCameraModel) infoContent += bar(layout.model.x, layout.model.y, layout.model.h, layout.model.w, 0.95, theme.primary)
    if (layout.date) infoContent += bar(layout.date.x, layout.date.y, layout.date.h, layout.date.w, 0.55, theme.secondary)
    if (c.showExif) infoContent += bar(layout.exif.x, layout.exif.y, layout.exif.h, layout.exif.w, 0.95, theme.primary)
    if (layout.lens) infoContent += bar(layout.lens.x, layout.lens.y, layout.lens.h, layout.lens.w, 0.55, theme.secondary)
    if (layout.badge) {
      const phone = phoneBrandOf(c.brand)
      if (phone?.badge.text) {
        const colors = cardBadgeColors(c.cardBadgeBg, c.cardBadgeFg, c.brand)
        infoContent += `<rect x="${r2(layout.badge.x)}" y="${r2(layout.badge.y)}" width="${r2(layout.badge.w)}" height="${r2(layout.badge.h)}" rx="${r2(4)}" fill="${colors.bg}"/>`
        // 标块文字示意条（居中短条，真实宽度随联名文字变化）
        infoContent += bar(
          layout.badge.x + layout.badge.w * 0.18,
          layout.badge.y + layout.badge.h / 2 - CARD_BADGE_FONT_SIZE / 2,
          CARD_BADGE_FONT_SIZE,
          layout.badge.w * 0.64,
          0.95,
          colors.fg,
        )
      }
    }
  } else if (c.infoLayout === 'vertical') {
    // vertical：复用 computeVerticalLayout 共享计算；文字旋转 90° 后为竖直墨条
    //（列 x = 列左缘，厚度 = 生效字号 × INK_RATIO，长度 = 示意文本宽）
    const layout = computeVerticalLayout(
      { ...c, exifText: DEMO.exif, dateText: DEMO.date, cameraModel: DEMO.model, lensText: DEMO.lens },
      canvasH - pad - bgExpand,
    )
    const vbar = (x: number, y: number, size: number, len: number, opacity: number) =>
      `<rect x="${r2(x)}" y="${r2(y)}" width="${r2(size * INK_RATIO)}" height="${r2(Math.max(1, len))}" rx="${r2((size * INK_RATIO) / 2)}" fill="${text}" opacity="${r2(opacity)}"/>`
    if (c.showCameraModel) infoContent += vbar(layout.model.x, layout.model.y, c.cameraModelSize, modelW, c.cameraModelOpacity)
    if (c.showExif) infoContent += vbar(layout.exif.x, layout.exif.y, c.fontSize, exifW, c.textOpacity)
    if (c.showLens && c.lensText) infoContent += vbar(layout.lens.x, layout.lens.y, c.fontSize, lensW, c.textOpacity)
    if (c.showDate) infoContent += vbar(layout.date.x, layout.date.y, c.dateFontSize ?? c.fontSize, dateW, c.dateTextOpacity ?? c.textOpacity)
  } else if (c.infoLayout === 'poster') {
    // poster：复用 computePosterLayout 共享计算（机型/标语居中条 + 四栏数值/单位条 + 分隔线）。
    // jsdom 无 canvas 时列宽实测为 0，各列收拢中轴——结构仍在，真实宽度以浏览器为准。
    const layout = computePosterLayout(
      { ...c, exifText: DEMO.exif, dateText: DEMO.date, cameraModel: DEMO.model, lensText: DEMO.lens },
      canvasH - pad - bgExpand,
    )
    if (c.showCameraModel) infoContent += bar(r2(pad + bgExpand + layout.model.x - modelW / 2), r2(pad + bgExpand + layout.model.y), c.cameraModelSize, modelW, c.cameraModelOpacity, text)
    if (layout.title && c.infoTitle) infoContent += bar(r2(pad + bgExpand + layout.title.x - 60), r2(pad + bgExpand + layout.title.y), 20, 120, 0.9, text)
    for (const col of layout.cols) {
      infoContent += bar(r2(pad + bgExpand + col.x), r2(pad + bgExpand + col.valueY), c.fontSize, col.w, c.textOpacity, text)
      infoContent += bar(r2(pad + bgExpand + col.x), r2(pad + bgExpand + col.unitY), Math.round(c.fontSize * 0.62), col.w, 0.55, text)
    }
    for (const d of layout.dividers) {
      infoContent += `<rect x="${r2(pad + bgExpand + d.x)}" y="${r2(pad + bgExpand + d.y)}" width="1" height="${r2(d.h)}" fill="${text}" opacity="0.25"/>`
    }
  } else if (c.infoLayout === 'calendar') {
    // calendar：年月标题条 + 分隔线 + 星期表头 + 6×7 公历日数字网格（高亮日实心圆点）。
    // 与 computeCalendarLayout 同源；农历小字省略（缩略图太小），以数字网格传达版式。
    const layout = computeCalendarLayout(c, canvasH - pad - bgExpand, new Date(2026, 8, 14))
    const gridW = CAL_COL_PITCH * 6 + CAL_CELL_W
    const cellCx = (col: number) => pad + bgExpand + layout.gridX + col * CAL_COL_PITCH + CAL_CELL_W / 2
    infoContent += `<rect x="${r2(pad + bgExpand + layout.gridX)}" y="${r2(layout.titleYearY + 4)}" width="${r2(gridW * 0.28)}" height="${r2(20)}" rx="10" fill="${text}" opacity="0.9"/>`
    infoContent += `<rect x="${r2(pad + bgExpand + layout.gridX + gridW * 0.72)}" y="${r2(layout.titleMonthY + 4)}" width="${r2(gridW * 0.28)}" height="${r2(8)}" rx="4" fill="${text}" opacity="0.5"/>`
    infoContent += `<rect x="${r2(pad + bgExpand + layout.gridX)}" y="${r2(layout.ruleY)}" width="${r2(gridW)}" height="1" fill="${text}" opacity="0.25"/>`
    for (let col = 0; col < 7; col++) {
      infoContent += `<circle cx="${r2(cellCx(col))}" cy="${r2(layout.weekdayY + 8)}" r="2" fill="${col === 0 ? layout.accent : text}" opacity="${col === 0 ? 0.9 : 0.45}"/>`
    }
    for (const row of layout.weeks) {
      for (const cell of row) {
        if (!cell) continue
        const cx = cellCx(cell.col)
        const cy = pad + bgExpand + cell.y + CAL_DAY_SIZE / 2
        if (cell.highlight) {
          infoContent += `<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(CAL_DAY_SIZE * 0.72)}" fill="${layout.accent}"/>`
          infoContent += `<text x="${r2(cx)}" y="${r2(cy + CAL_DAY_SIZE * 0.36)}" font-size="${r2(CAL_DAY_SIZE * 0.8)}" font-weight="700" text-anchor="middle" fill="#ffffff">${cell.day}</text>`
        } else {
          infoContent += `<text x="${r2(cx)}" y="${r2(cy + CAL_DAY_SIZE * 0.36)}" font-size="${r2(CAL_DAY_SIZE * 0.8)}" text-anchor="middle" fill="${text}" opacity="0.85">${cell.day}</text>`
        }
      }
    }
  } else if (c.infoLayout === 'sport') {
    // sport：机型/标语条 + 轨迹缩略卡（示意折线）+ 四栏数值/单位条 + 分隔线。
    // 与 computeSportLayout 同源；无遥测数据时仅绘制机型/标语示意条。
    const layout = computeSportLayout({ ...c, telemetry: c.telemetry ?? DEMO_TELEMETRY }, canvasH - pad - bgExpand)
    if (layout.model && c.showCameraModel) infoContent += bar(r2(pad + bgExpand + layout.model.x - modelW / 2), r2(pad + bgExpand + layout.model.y), c.cameraModelSize, modelW, c.cameraModelOpacity, text)
    if (layout.title && c.infoTitle) infoContent += bar(r2(pad + bgExpand + layout.title.x - 60), r2(pad + bgExpand + layout.title.y), 20, 120, 0.9, text)
    if (layout.track) {
      const t = layout.track
      infoContent += `<rect x="${r2(pad + bgExpand + t.x)}" y="${r2(pad + bgExpand + t.y)}" width="${r2(t.w)}" height="${r2(t.h)}" rx="${r2(10)}" fill="${text}" opacity="0.1"/>`
      if (layout.trackPoints.length >= 2) {
        const pts = layout.trackPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${r2(pad + bgExpand + p.x)} ${r2(pad + bgExpand + p.y)}`).join(' ')
        infoContent += `<path d="${pts}" fill="none" stroke="${calendarAccentColor(c)}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" opacity="0.95"/>`
      }
    }
    for (const col of layout.cols) {
      infoContent += bar(r2(pad + bgExpand + col.x), r2(pad + bgExpand + col.valueY), c.fontSize, col.w, c.textOpacity, text)
      infoContent += bar(r2(pad + bgExpand + col.x), r2(pad + bgExpand + col.unitY), Math.round(c.fontSize * 0.62), col.w, 0.55, text)
    }
    for (const d of layout.dividers) {
      infoContent += `<rect x="${r2(pad + bgExpand + d.x)}" y="${r2(pad + bgExpand + d.y)}" width="1" height="${r2(d.h)}" fill="${text}" opacity="0.25"/>`
    }
  } else {
    // classic：与 computeClassicLayout 完全同构——自底向上 日期 → EXIF 块(含镜头行) → 型号 → Logo，
    // 只为显示行占位，行距 CLASSIC_ROW_GAP，镜头行以 LENS_LINE_GAP 附在参数行下；水平对齐跟随 overlayAlign
    // （center=行中心，left/right=缘内缩锚点，Logo 由渲染端按自身宽度平移，示意条直接按宽定位）。
    // 底锚（画布坐标）：canvasBottom(调用方传 H - pad - bgExpand，本函数再 + pad 还原画布系) - overlayBottom
    //  → 画布 bottom = canvasH - bgExpand - overlayBottom（与测试/预览/导出三方对齐，勿多减 pad）
    const bottom = canvasH - c.overlayBottom
    const exifSize = c.exifFontSize ?? c.fontSize
    const lensSize = c.lensFontSize ?? c.fontSize
    const dateSize = c.dateFontSize ?? c.fontSize
    const exifBlockH = c.showLens && c.lensText ? exifSize + LENS_LINE_GAP + lensSize : exifSize
    const alignX = (w: number) => {
      const x0 = pad + bgExpand
      if (c.overlayAlign === 'left') return x0 + CLASSIC_SIDE_INSET
      if (c.overlayAlign === 'right') return x0 + DESIGN_CONTAINER - w - CLASSIC_SIDE_INSET
      return x0 + (DESIGN_CONTAINER - w) / 2
    }
    type Row = { h: number; draw: (top: number) => string }
    const rows: Row[] = []
    if (c.showDate) rows.push({ h: dateSize, draw: (y) => bar(alignX(dateW), y, dateSize, dateW, c.dateTextOpacity ?? c.textOpacity, text) })
    if (c.showExif) {
      rows.push({
        h: exifBlockH,
        draw: (y) => {
          let s = bar(alignX(exifW), y, exifSize, exifW, c.textOpacity, text)
          if (c.showLens) s += bar(alignX(lensW), y + exifSize + LENS_LINE_GAP, lensSize, lensW, c.textOpacity, text)
          return s
        },
      })
    }
    if (c.showCameraModel) rows.push({ h: c.cameraModelSize, draw: (y) => bar(alignX(modelW), y, c.cameraModelSize, modelW, c.cameraModelOpacity, text) })
    if (c.showLogo) {
      rows.push({
        h: c.logoSize,
        draw: (y) =>
          `<rect x="${r2(alignX(logoW))}" y="${r2(y)}" width="${r2(logoW)}" height="${r2(c.logoSize)}" rx="${r2(c.logoSize * 0.12)}" fill="${logoFill}" opacity="${r2(c.logoOpacity)}"/>`,
      })
    }
    // 底部锚点：自底向上堆叠（rows 为自底向上顺序）；顶部锚点：阅读序（rows 逆序）自顶向下堆叠，
    // 与 computeClassicLayout 的顶部锚点镜像规则一致
    if (c.overlayAnchor === 'top') {
      let y = c.overlayBottom
      for (let i = rows.length - 1; i >= 0; i--) {
        info += rows[i].draw(y)
        y += rows[i].h + CLASSIC_ROW_GAP
      }
    } else {
      let y = bottom
      for (let i = 0; i < rows.length; i++) {
        info += rows[i].draw(y - rows[i].h)
        y -= rows[i].h + CLASSIC_ROW_GAP
      }
    }
  }

  // 引擎坐标分支统一平移到画布坐标（修复：此前直接以内容坐标入画，
  // 整体偏移了 pad + bgExpand——杂志刊头标题 y=-96 被裁出画布）
  if (infoContent) {
    info += `<g transform="translate(${r2(pad + bgExpand)}, ${r2(pad + bgExpand)})">${infoContent}</g>`
  }

  // ===== 图层绘制（与 exporter 同序：画板 → 边框 → 背景 → 照片 → INFO）=====
  // 示意照片：天空渐变 + 一枚暖色太阳，让缩略图有"照片感"，与模糊背景拉开层次
  const photoFill = `url(#${gid}p)`
  const blurPx = Math.max(0, c.blur)

  // 设备样机（手机壳）：边框环（evenodd 内收带）+ 顶部灵动岛胶囊，与 drawDeviceMockup 同比例
  let mockup = ''
  if (c.deviceMockup === 'phone-dark' || c.deviceMockup === 'phone-light') {
    const base = Math.max(photoW, photoH)
    const t = Math.min(40, Math.max(6, base * 0.016))
    const outerR = Math.max(0, Math.min(photoR, Math.min(photoW, photoH) / 2))
    const bezel = c.deviceMockup === 'phone-dark' ? '#17181A' : '#D7D9DD'
    const iw = Math.min(photoW * 0.26, photoH * 0.42)
    const ih = Math.max(8, Math.min(photoH * 0.032, iw * 0.38))
    const ix = photoX + photoW / 2 - iw / 2
    const iy = photoY + Math.max(t * 0.55, photoH * 0.014)
    mockup =
      `<path fill-rule="evenodd" fill="${bezel}" d="${svgRoundRect(photoX, photoY, photoW, photoH, outerR)} ${svgRoundRect(photoX + t, photoY + t, photoW - t * 2, photoH - t * 2, Math.max(0, outerR - t))}"/>`
      + `<rect x="${r2(ix)}" y="${r2(iy)}" width="${r2(iw)}" height="${r2(ih)}" rx="${r2(ih / 2)}" fill="#101013"/>`
  } else if (c.deviceMockup === 'film-dark' || c.deviceMockup === 'film-warm') {
    // 胶片壳（同 drawFilmShell）：片基环（上下厚）+ 齿孔行 + 底部三角记号
    const base = Math.max(photoW, photoH)
    const side = Math.min(28, Math.max(6, base * 0.022))
    const long = Math.min(64, Math.max(12, side * 2.2))
    const outerR = Math.max(0, Math.min(photoR, Math.min(photoW, photoH) / 2))
    const baseC = c.deviceMockup === 'film-dark' ? '#16140F' : '#2A211A'
    const holeW = Math.max(2.4, side * 0.5)
    const holeH = Math.max(1.8, long * 0.2)
    let holes = ''
    for (let x = holeW * 1.05; x < photoW - holeW; x += holeW * 2.1) {
      for (const y of [photoY + long * 0.22, photoY + photoH - long * 0.22 - holeH]) {
        holes += `<rect x="${r2(photoX + x)}" y="${r2(y)}" width="${r2(holeW)}" height="${r2(holeH)}" rx="${r2(holeH * 0.35)}" fill="#ffffff" fill-opacity="0.15"/>`
      }
    }
    mockup = `<path fill-rule="evenodd" fill="${baseC}" d="${svgRoundRect(photoX, photoY, photoW, photoH, outerR)} ${svgRoundRect(photoX + side, photoY + long, photoW - side * 2, photoH - long * 2, Math.max(0, outerR - side))}"/>` + holes
  } else if (c.deviceMockup === 'camera-dark' || c.deviceMockup === 'camera-silver') {
    // 相机机身壳（与 drawCameraShell 同比例）：机身环 + 金属顶盖 + 皮革握把 + 按钮（细节裁在环内）
    const dark = c.deviceMockup === 'camera-dark'
    const base = Math.max(photoW, photoH)
    const t = Math.min(96, Math.max(20, base * 0.048))
    const outerR = Math.max(0, Math.min(photoR, Math.min(photoW, photoH) / 2))
    const innerR2 = Math.max(0, outerR - t)
    const body = dark ? '#1B1C1F' : '#CFD2D7'
    const plate = dark ? '#C6CAD1' : '#E3E5E9'
    const grip = dark ? '#232428' : '#2A2B2F'
    const plateH = t * 0.74
    const gripW = Math.min(t * 1.02, photoW * 0.16)
    const clipId = `${gid}mk`
    mockup =
      `<clipPath id="${clipId}"><path fill-rule="evenodd" d="${svgRoundRect(photoX, photoY, photoW, photoH, outerR)} ${svgRoundRect(photoX + t, photoY + t, photoW - t * 2, photoH - t * 2, innerR2)}"/></clipPath>`
      + `<path fill-rule="evenodd" fill="${body}" d="${svgRoundRect(photoX, photoY, photoW, photoH, outerR)} ${svgRoundRect(photoX + t, photoY + t, photoW - t * 2, photoH - t * 2, innerR2)}"/>`
      + `<g clip-path="url(#${clipId})">`
      + `<rect x="${r2(photoX)}" y="${r2(photoY)}" width="${r2(photoW)}" height="${r2(plateH)}" fill="${plate}"/>`
      + `<rect x="${r2(photoX + photoW - gripW)}" y="${r2(photoY + plateH)}" width="${r2(gripW)}" height="${r2(photoH - plateH)}" fill="${grip}"/>`
      + `<rect x="${r2(photoX)}" y="${r2(photoY + plateH)}" width="${r2(Math.min(t * 0.62, photoW * 0.12))}" height="${r2(photoH - plateH)}" fill="${grip}"/>`
      + `<circle cx="${r2(photoX + photoW - gripW / 2)}" cy="${r2(photoY + photoH * 0.72)}" r="${r2(Math.max(2.4, t * 0.3))}" fill="#0E0F11"/>`
      + `<rect x="${r2(photoX + photoW / 2 - Math.min(photoW * 0.14, t * 1.7) / 2)}" y="${r2(photoY + plateH * 0.17)}" width="${r2(Math.min(photoW * 0.14, t * 1.7))}" height="${r2(plateH * 0.4)}" rx="${r2(t * 0.05)}" fill="#0E0F11"/>`
      + `</g>`
  }

  const bgInner =
    c.bgMode === 'solid'
      ? `<rect x="${r2(pad)}" y="${r2(pad)}" width="${r2(innerW)}" height="${r2(innerH)}" fill="${c.bgColor}"/>`
      : `<g clip-path="url(#${gid}c)"><rect x="${r2(pad - blurPx * 3)}" y="${r2(pad - blurPx * 3)}" width="${r2(innerW + blurPx * 6)}" height="${r2(innerH + blurPx * 6)}" fill="${photoFill}" filter="url(#${gid}b)"/></g>`

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${r2(canvasW)} ${r2(canvasH)}" preserveAspectRatio="xMidYMid meet">`
    + `<defs>`
    + `<linearGradient id="${gid}p" x1="0" y1="0" x2="0.2" y2="1">`
    + `<stop offset="0" stop-color="#93a7bc"/><stop offset="0.58" stop-color="#5f6f81"/><stop offset="0.6" stop-color="#414c59"/><stop offset="1" stop-color="#2c343e"/>`
    + `</linearGradient>`
    + `<filter id="${gid}b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${r2(blurPx)}"/></filter>`
    + `<filter id="${gid}s" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="${r2(c.shadow * 6)}" stdDeviation="${r2(c.shadow * 5)}" flood-color="#000000" flood-opacity="${shadowOpacity}"/></filter>`
    + `<clipPath id="${gid}c"><rect x="${r2(pad)}" y="${r2(pad)}" width="${r2(innerW)}" height="${r2(innerH)}" rx="${r2(innerR)}"/></clipPath>`
    + `<clipPath id="${gid}pc"><rect x="${r2(photoX)}" y="${r2(photoY)}" width="${r2(photoW)}" height="${r2(photoH)}" rx="${r2(photoR)}"/></clipPath>`
    + `</defs>`
    // 0) 画板（边框色兜底）
    + `<rect x="0" y="0" width="${r2(canvasW)}" height="${r2(canvasH)}" rx="${r2(outerR)}" fill="${c.borderColor}"/>`
    // 2) 背景层
    + bgInner
    // 3) 照片层（含阴影与示意内容）
    + `<g filter="${c.shadow > 0 ? `url(#${gid}s)` : 'none'}">`
    + `<rect x="${r2(photoX)}" y="${r2(photoY)}" width="${r2(photoW)}" height="${r2(photoH)}" rx="${r2(photoR)}" fill="${photoFill}"/>`
    + `<g clip-path="url(#${gid}pc)"><circle cx="${r2(photoX + photoW * 0.72)}" cy="${r2(photoY + photoH * 0.34)}" r="${r2(photoW * 0.075)}" fill="#f4e6c8" opacity="0.8"/></g>`
    + `</g>`
    // 3.5) 设备样机（手机壳环 + 灵动岛，照片层之上）
    + mockup
    // 4) INFO 层
    + info
    + `</svg>`
}

/** SVG 圆角矩形路径（供设备样机 evenodd 环使用） */
function svgRoundRect(x: number, y: number, w: number, h: number, r: number): string {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2))
  return `M ${r2(x + radius)} ${r2(y)} H ${r2(x + w - radius)} A ${r2(radius)} ${r2(radius)} 0 0 1 ${r2(x + w)} ${r2(y + radius)} V ${r2(y + h - radius)} A ${r2(radius)} ${r2(radius)} 0 0 1 ${r2(x + w - radius)} ${r2(y + h)} H ${r2(x + radius)} A ${r2(radius)} ${r2(radius)} 0 0 1 ${r2(x)} ${r2(y + h - radius)} V ${r2(y + radius)} A ${r2(radius)} ${r2(radius)} 0 0 1 ${r2(x + radius)} ${r2(y)} Z`
}

/** 生成可直接用于 <img src> 的 dataURL */
export function templateThumbDataUrl(config: Partial<FrameConfig>, opts: ThumbOptions = {}): string {
  return `data:image/svg+xml;utf8,${encodeURIComponent(templateThumbSvg(config, opts))}`
}

// ===== 真实照片渲染版缩略图（更美观，用于运行时浏览器环境）=====

// 内置示例照片为可选资源（网页部署精简包可能不含此文件）：
// 用 import.meta.glob 声明式可选引用，资源缺失时不参与构建，运行时自动降级为程序化 SVG
const demoImageMods = import.meta.glob<string>('../assets/template-demo.jpg', {
  eager: true,
  import: 'default',
})
const DEMO_IMAGE_URL = demoImageMods['../assets/template-demo.jpg'] ?? ''
// 底图降采样上限：缩略图实际显示宽度约 200~400px，1280 已足够清晰（3 倍以上超采样），
// 同时明显降低首次渲染的解码与合成开销
const DEMO_MAX_LONG_EDGE = 1280
const DEMO_JPG_QUALITY = 0.88

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const im = new Image()
    im.onload = () => resolve(im)
    im.onerror = () => reject(new Error(`缩略图底图加载失败: ${src}`))
    // 以 CORS 模式加载：同源 / dataURL / blob 不受影响；跨源资源（如桌面端 asset 协议
    // 配置了 CORS 头时）绘制 canvas 不污染。无 CORS 头的跨源图会 onerror，由调用方回退
    //（TemplatePickerModal 已把 asset 图源读盘转同源数据传入，此处主要为网页直链兜底）。
    im.crossOrigin = 'anonymous'
    im.src = src
  })
}

function downscaleImage(img: ImgSource, maxLongEdge: number): HTMLCanvasElement {
  const { w: nw0, h: nh0 } = sourceSize(img)
  const long = Math.max(nw0, nh0)
  const scale = Math.min(1, maxLongEdge / long)
  const w = Math.max(1, Math.round(nw0 * scale))
  const h = Math.max(1, Math.round(nh0 * scale))
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const ctx = c.getContext('2d')
  if (ctx) ctx.drawImage(img, 0, 0, w, h)
  return c
}

/** 大预览 INFO 覆盖：传入当前照片真实信息，替换示意文本（缺省走 DEMO 示意） */
export interface ThumbInfoOverride {
  exifText?: string
  dateText?: string
  cameraModel?: string
  lensText?: string
  brand?: string
}

export function buildDemoConfig(config: Partial<FrameConfig>, info?: ThumbInfoOverride): FrameConfig {
  return {
    ...defaultFrameConfig,
    ...config,
    exifText: info?.exifText ?? DEMO.exif,
    dateText: info?.dateText ?? DEMO.date,
    cameraModel: info?.cameraModel ?? DEMO.model,
    lensText: info?.lensText ?? DEMO.lens,
    brand: info?.brand ?? 'sony',
    // 示意原始字段：poster 参数表与 infoLayer {gps} 等占位符在无真实照片时也有值可渲染
    exifRaw: config.exifRaw ?? { focalLength: 16, fNumber: 2.8, exposureTime: 1 / 250, iso: 100 },
    // 示意遥测：sport 布局模板缩略图在无真实 GPX 时也有轨迹与参数可渲染
    telemetry: config.telemetry ?? DEMO_TELEMETRY,
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('blob 转 dataURL 失败'))
    reader.readAsDataURL(blob)
  })
}

// ===== 渲染缓存：模板库弹窗高频点击场景的换图提速 =====
// 源图缓存：同一「图片 URL/图源对象 + 降采样上限」→ 已解码/已降采样的源图，
// 避免每次渲染都重新解码大照片（解码是缩略图管线里最重的步骤之一）。
const sourceCache = new Map<string, ImgSource>()
// 模板库样张场景下每套模板一个不同图源（55 套），缓存过小会来回滚动时反复解码/降采样
const SOURCE_CACHE_MAX = 16
// 结果缓存：「模板配置 + INFO + 源图 + 尺寸」→ 渲染产物 dataURL。
// 用户在模板间来回对比挑选时，已看过的模板瞬时换图，无需重跑合成管线。
// 两个缓存均按插入序做简单 FIFO 淘汰（照片切换/模板删除后的旧键自然让位）。
const renderCache = new Map<string, string>()
// 样张模式下「模板 × 样张」组合数 ≈ 模板总数，缓存覆盖整屏以上滚动范围
const RENDER_CACHE_MAX = 80

// 非字符串图源（App 预览 canvas/ImageBitmap 复用）的稳定键：WeakMap 不阻止其回收
const srcObjIds = new WeakMap<ImgSource, string>()
let srcObjSeq = 0
function sourceKeyOf(imageUrl: string | ImgSource): string {
  if (typeof imageUrl === 'string') return imageUrl
  let id = srcObjIds.get(imageUrl)
  if (!id) {
    id = `#src${++srcObjSeq}`
    srcObjIds.set(imageUrl, id)
  }
  return id
}

/** Map 的 FIFO 淘汰：删除最早插入的键 */
function evictOldest<K, V>(map: Map<K, V>): void {
  const first = map.keys().next()
  if (!first.done) map.delete(first.value)
}

/**
 * 用真实照片渲染模板缩略图。
 * imageUrl：图片 URL（字符串，按需加载解码）或已解码图源对象（App 预览 canvas/ImageBitmap
 * 直接复用，零解码——模板库打开/换图不再触发全尺寸解码）。
 * 流程：取源图（缓存）→ 必要时降采样（缓存）→ 用 exporter 完整合成 → 返回 JPG dataURL（缓存）。
 * info：传入当前照片的真实 INFO（exifText/dateText/cameraModel/lensText/brand），
 * 缺省时使用示意文本。渲染失败则降级为程序化 SVG。
 */
export async function renderTemplateThumbDataUrl(
  config: Partial<FrameConfig>,
  imageUrl: string | ImgSource = DEMO_IMAGE_URL,
  maxLongEdge: number = DEMO_MAX_LONG_EDGE,
  info?: ThumbInfoOverride,
): Promise<string> {
  try {
    const srcKey0 = sourceKeyOf(imageUrl)
    // 结果缓存命中：直接返回已渲染的 dataURL（来回对比模板时瞬时换图）
    const cacheKey = JSON.stringify([config, info ?? null, srcKey0, maxLongEdge])
    const cached = renderCache.get(cacheKey)
    if (cached) return cached

    // 源图缓存：解码 + 降采样只做一次，后续渲染复用
    const srcKey = `${srcKey0}|${maxLongEdge}`
    let source = sourceCache.get(srcKey)
    if (!source) {
      if (typeof imageUrl === 'string') {
        const img = await loadImageElement(imageUrl)
        source =
          img.naturalWidth > maxLongEdge || img.naturalHeight > maxLongEdge
            ? downscaleImage(img, maxLongEdge)
            : img
      } else {
        source = downscaleImage(imageUrl, maxLongEdge)
      }
      sourceCache.set(srcKey, source)
      if (sourceCache.size > SOURCE_CACHE_MAX) evictOldest(sourceCache)
    }
    const full = buildDemoConfig(config, info)
    // 复刻 applyTemplateToState 的 Logo 自适应：模板未显式定义 logoColor 时，
    // 浅色纯色底用近黑、其余用白（否则白 Logo 画在白色底上不可见——大预览/缩略图的缺失根因）
    if (config.logoColor == null) {
      const lightSolid = full.bgMode === 'solid' && hexLuminance(full.bgColor) > 0.6
      full.logoColor = lightSolid ? '#1a1a1a' : '#ffffff'
    }
    // 品牌 Logo 与预览/导出同源：按模板明暗自适应取色，预加载真实 SVG 后传入合成器。
    // （exportFrame 未提供 logo 时跳过 Logo 绘制——此前真实缩略图/大预览缺失品牌 Logo 的根因）
    let logo: HTMLCanvasElement | undefined
    if (full.showLogo && full.brand) {
      try {
        const fill = logoAutoColor(full.logoColor, full.bgMode, full.bgColor)
        await preloadBrandLogo(full.brand, fill)
        logo = resolveLogo(full.brand, fill)
      } catch {
        logo = undefined
      }
    }
    const result = await exportFrame(source, full, { format: 'jpg', jpgQuality: DEMO_JPG_QUALITY, logo })
    const url = await blobToDataUrl(result.blob)
    renderCache.set(cacheKey, url)
    if (renderCache.size > RENDER_CACHE_MAX) evictOldest(renderCache)
    return url
  } catch (e) {
    console.warn('[templateThumb] 真实缩略图渲染失败，回退到 SVG:', e)
    return templateThumbDataUrl(config)
  }
}
