// INFO 各组（EXIF / 镜头 / 日期 / 型号）独立文本样式与布局的联动回归测试。
// 重点：单独调大某组字号后，行高与块高必须同步变化，不能出现行重叠；
// 且镜头行位置必须与预览 DOM（.exif-text 块内 .lens-line）的排布规则一致。
import { describe, it, expect, beforeAll, vi } from 'vitest'
import { defaultFrameConfig, type FrameConfig } from './types'
import {
  computeClassicLayout,
  computeFooterLayout,
  exifTextStyle,
  lensTextStyle,
  LENS_LINE_GAP,
  CLASSIC_ROW_GAP,
} from './infoLayout'

const CANVAS_BOTTOM = 1200
const EPS = 0.001

// jsdom 未实现 canvas：stub 掉 getContext，避免 "not implemented" 告警噪音。
// 本测试只断言行高/块高，不依赖文本宽度测量（宽度测量在真实浏览器中进行）。
beforeAll(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})

function cfg(patch: Partial<FrameConfig> = {}): FrameConfig {
  return { ...defaultFrameConfig, ...patch }
}

/** classic 下 EXIF 块高（EXIF 行 + 镜头行） */
function exifBlockH(c: FrameConfig): number {
  return c.showLens && c.lensText
    ? exifTextStyle(c).size + LENS_LINE_GAP + lensTextStyle(c).size
    : exifTextStyle(c).size
}

const INFO_ON: Partial<FrameConfig> = {
  showExif: true,
  exifText: '50mm f/1.8 1/200s ISO100',
  showDate: true,
  dateText: '2026/08/27',
  showLens: true,
  lensText: 'FE 55mm F1.8 ZA',
  showCameraModel: true,
  cameraModel: 'A7R V',
}

describe('classic 纵向堆叠：独立字号联动', () => {
  it('默认（全部跟随整体）时顺序正确且各行不重叠', () => {
    const c = cfg(INFO_ON)
    const L = computeClassicLayout(c, CANVAS_BOTTOM)
    // 从下往上：日期 / EXIF(含镜头行) / 型号 / Logo
    expect(L.exif.y + exifBlockH(c)).toBeLessThanOrEqual(L.date.y - CLASSIC_ROW_GAP + EPS)
    expect(L.model.y + c.cameraModelSize).toBeLessThanOrEqual(L.exif.y - CLASSIC_ROW_GAP + EPS)
    expect(L.logo.y + c.logoSize).toBeLessThanOrEqual(L.model.y - CLASSIC_ROW_GAP + EPS)
    // 镜头行紧跟 EXIF 参数行（与预览 .lens-line 的 margin-top 同源）
    expect(L.lens.y).toBeCloseTo(L.exif.y + exifTextStyle(c).size + LENS_LINE_GAP, 6)
  })

  it('单独调大 EXIF 字号：块整体上移，不与日期行重叠', () => {
    const base = cfg(INFO_ON)
    const big = cfg({ ...INFO_ON, exifFontSize: 60 })
    const before = computeClassicLayout(base, CANVAS_BOTTOM)
    const after = computeClassicLayout(big, CANVAS_BOTTOM)
    expect(exifTextStyle(big).size).toBe(60)
    expect(after.exif.y + exifBlockH(big)).toBeLessThanOrEqual(after.date.y - CLASSIC_ROW_GAP + EPS)
    expect(after.exif.y).toBeLessThan(before.exif.y)
    // 日期行不受 EXIF 字号影响（独立样式）
    expect(after.date.y).toBeCloseTo(before.date.y, 6)
  })

  it('单独调大镜头字号：块高随之增加，仍不与其下方日期行重叠', () => {
    const big = cfg({ ...INFO_ON, lensFontSize: 60 })
    const L = computeClassicLayout(big, CANVAS_BOTTOM)
    expect(lensTextStyle(big).size).toBe(60)
    expect(L.exif.y + exifBlockH(big)).toBeLessThanOrEqual(L.date.y - CLASSIC_ROW_GAP + EPS)
    expect(L.lens.y).toBeCloseTo(L.exif.y + exifTextStyle(big).size + LENS_LINE_GAP, 6)
  })

  it('单独调大日期字号：日期行上移，EXIF 块同步让位', () => {
    const big = cfg({ ...INFO_ON, dateFontSize: 60 })
    const base = cfg(INFO_ON)
    const before = computeClassicLayout(base, CANVAS_BOTTOM)
    const after = computeClassicLayout(big, CANVAS_BOTTOM)
    expect(after.date.y).toBeLessThan(before.date.y)
    expect(after.exif.y + exifBlockH(big)).toBeLessThanOrEqual(after.date.y - CLASSIC_ROW_GAP + EPS)
  })

  it('单独调大型号字号：型号行上移，不与 EXIF 块重叠', () => {
    const big = cfg({ ...INFO_ON, cameraModelSize: 60 })
    const L = computeClassicLayout(big, CANVAS_BOTTOM)
    expect(L.model.y + 60).toBeLessThanOrEqual(L.exif.y - CLASSIC_ROW_GAP + EPS)
  })
})

describe('duo 杂志双栏：独立字号联动', () => {
  it('单独调大镜头字号时文字块增高，镜头行不与机型行重叠', () => {
    const big = cfg({ ...INFO_ON, infoLayout: 'duo', lensFontSize: 60 })
    const L = computeFooterLayout(big, CANVAS_BOTTOM, 2.6)
    expect(L.lens.y + lensTextStyle(big).size).toBeLessThanOrEqual(L.model.y + EPS)
  })

  it('只显示日期（无 EXIF/无镜头）时块高为一行，不重复计算', () => {
    const only = cfg({ ...INFO_ON, infoLayout: 'duo', showExif: false, showLens: false })
    const L = computeFooterLayout(only, CANVAS_BOTTOM, 2.6)
    // 日期行底部贴齐底缘
    expect(L.date.y + only.cameraModelSize).toBeCloseTo(CANVAS_BOTTOM - only.overlayBottom, 6)
    // 块内只有一行：机型行顶 = 块顶 = 日期行顶（旧实现会多算一行，把机型行顶推高）
    expect(L.model.y).toBeCloseTo(L.date.y, 6)
  })

  it('单独调大 EXIF 字号时参数行随之上移，日期行不受影响', () => {
    const base = cfg({ ...INFO_ON, infoLayout: 'duo', showLens: false })
    const big = cfg({ ...INFO_ON, infoLayout: 'duo', showLens: false, exifFontSize: 60 })
    const a = computeFooterLayout(base, CANVAS_BOTTOM, 2.6)
    const b = computeFooterLayout(big, CANVAS_BOTTOM, 2.6)
    expect(b.exif.y).toBeLessThan(a.exif.y)
    expect(b.date.y).toBeCloseTo(a.date.y, 6)
  })

  it('竖线固定在内容区水平中线，右栏贴线左、Logo 贴线右', () => {
    const c = cfg({ ...INFO_ON, infoLayout: 'duo', showLens: false })
    const L = computeFooterLayout(c, CANVAS_BOTTOM, 2.6)
    const DESIGN = 1200
    expect(L.divider).not.toBeNull()
    expect(L.divider!.x).toBeCloseTo(DESIGN / 2, 6) // 中线
    expect(L.exif.x).toBeCloseTo(DESIGN / 2 + 21, 6) // 右栏左缘贴线右侧（DUO_DIVIDER_GAP=21）
    expect(L.logo.x + c.logoSize * 2.6).toBeCloseTo(DESIGN / 2 - 28, 6) // Logo 右缘贴线左侧（DUO_LOGO_GAP=28）
  })
})
