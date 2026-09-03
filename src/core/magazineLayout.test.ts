// 新增布局引擎的回归测试：magazine（杂志编辑）/ classic 按显示行堆叠 / inline 手机品牌 Logo 去重。
// jsdom 无 canvas：宽度测量返回 0（右对齐 x 退化为「右缘 - 内缩」），断言只依赖几何常量与相对关系。
import { describe, it, expect, beforeAll, vi } from 'vitest'
import { defaultFrameConfig, type FrameConfig } from './types'
import { DESIGN_CONTAINER } from './constants'
import {
  computeClassicLayout,
  computeFooterLayout,
  computeMagazineLayout,
  MAG_TITLE_SIZE,
  MAG_TITLE_TOP,
  MAG_SUB_GAP,
  MAG_SUB_SIZE,
  MAG_ROW_GAP,
  MAG_RIGHT_INSET,
  MAG_BOTTOM_INSET,
  MAG_SWATCH_COUNT,
  MAG_SWATCH_W,
  MAG_SWATCH_H,
  CLASSIC_ROW_GAP,
  CLASSIC_SIDE_INSET,
} from './infoLayout'

const CANVAS_BOTTOM = 1200
const CENTER = DESIGN_CONTAINER / 2

beforeAll(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
})

function cfg(patch: Partial<FrameConfig> = {}): FrameConfig {
  return { ...defaultFrameConfig, ...patch }
}

describe('classic 按显示行堆叠（隐藏行不占位）', () => {
  it('仅显示型号：型号行底部贴齐底缘锚点（旧行为会被隐藏行抬高）', () => {
    const c = cfg({
      showCameraModel: true,
      cameraModel: 'A7R V',
      showExif: false,
      showDate: false,
      showLens: false,
      showLogo: false,
      overlayBottom: 60,
    })
    const L = computeClassicLayout(c, CANVAS_BOTTOM)
    expect(L.model.y + c.cameraModelSize).toBeCloseTo(CANVAS_BOTTOM - 60, 6)
  })

  it('水平对齐：center=行中点；left=左缘内缩；right=右缘内缩（jsdom 宽度为 0）', () => {
    const base = {
      showCameraModel: true,
      cameraModel: 'A7R V',
      showExif: false,
      showDate: false,
      showLens: false,
      showLogo: false,
    }
    const centerL = computeClassicLayout(cfg({ ...base, overlayAlign: 'center' }), CANVAS_BOTTOM)
    const leftL = computeClassicLayout(cfg({ ...base, overlayAlign: 'left' }), CANVAS_BOTTOM)
    const rightL = computeClassicLayout(cfg({ ...base, overlayAlign: 'right' }), CANVAS_BOTTOM)
    expect(centerL.model.x).toBeCloseTo(CENTER, 6)
    expect(leftL.model.x).toBeCloseTo(CLASSIC_SIDE_INSET, 6)
    expect(rightL.model.x).toBeCloseTo(DESIGN_CONTAINER - CLASSIC_SIDE_INSET, 6)
    // 上下留白不受水平对齐影响
    expect(rightL.model.y).toBeCloseTo(centerL.model.y, 6)
  })

  it('仅显示日期：日期行底部贴齐底缘锚点', () => {
    const c = cfg({ showDate: true, dateText: '2026/08/27', overlayBottom: 46 })
    const L = computeClassicLayout(c, CANVAS_BOTTOM)
    expect(L.date.y + 30).toBeCloseTo(CANVAS_BOTTOM - 46, 6)
  })

  it('仅显示 Logo：Logo 底部贴齐底缘锚点（字标装裱场景）', () => {
    const c = cfg({ showLogo: true, overlayBottom: 64 })
    const L = computeClassicLayout(c, CANVAS_BOTTOM)
    expect(L.logo.y + c.logoSize).toBeCloseTo(CANVAS_BOTTOM - 64, 6)
  })

  it('机型 + 参数两行：参数贴底、机型在其上方一个行距处', () => {
    const c = cfg({
      showCameraModel: true,
      cameraModel: 'A7R V',
      showExif: true,
      exifText: '50mm f/1.8 1/200s ISO200',
      overlayBottom: 85,
    })
    const L = computeClassicLayout(c, CANVAS_BOTTOM)
    expect(L.exif.y + c.fontSize).toBeCloseTo(CANVAS_BOTTOM - 85, 6)
    expect(L.model.y + c.cameraModelSize).toBeCloseTo(L.exif.y - CLASSIC_ROW_GAP, 6)
  })

  it('全隐藏时返回的坐标不抛错、不越界为负', () => {
    const c = cfg({ showCameraModel: false, showExif: false, showDate: false, showLogo: false })
    const L = computeClassicLayout(c, CANVAS_BOTTOM)
    expect(Number.isFinite(L.logo.y)).toBe(true)
    expect(L.logo.y).toBeGreaterThanOrEqual(0)
  })
})

describe('inline 悬浮双行：手机品牌 Logo 去重', () => {
  const BASE = {
    infoLayout: 'inline' as const,
    showLogo: true,
    showCameraModel: true,
    cameraModel: 'A7R V',
    overlayBottom: 22,
  }

  it('手机品牌（文字标 Logo 与机型重复）：行1 仅机型居中', () => {
    const c = cfg({ ...BASE, brand: 'xiaomi' })
    const L = computeFooterLayout(c, CANVAS_BOTTOM, 2.6)
    // 宽度测量为 0（jsdom）：机型单独居中 → x = 中点
    expect(L.model.x).toBeCloseTo(CENTER, 6)
  })

  it('相机品牌（图形 Logo）：Logo 与机型内联，机型在 Logo 右侧', () => {
    const c = cfg({ ...BASE, brand: 'sony' })
    const L = computeFooterLayout(c, CANVAS_BOTTOM, 2.6)
    const logoW = c.logoSize * 2.6
    expect(L.logo.x).toBeLessThan(CENTER)
    expect(L.model.x).toBeGreaterThan(CENTER)
    // 机型 x - Logo x = Logo 宽 + 行内间距（间距 > 0）
    expect(L.model.x - L.logo.x).toBeGreaterThan(logoW)
  })
})

describe('magazine 杂志编辑布局', () => {
  const BASE: Partial<FrameConfig> = {
    infoLayout: 'magazine',
    padding: 120,
    borderRatio: 71,
    overlayBottom: 40,
    showCameraModel: true,
    cameraModel: 'A7R V',
    showExif: true,
    exifText: '55mm f/4.5 1/200s ISO100',
    showDate: true,
    dateText: 'JUN 10th, 2025',
  }

  it('标题区位于上边留白内：y 为负，副标题紧随标题一个行距', () => {
    const c = cfg(BASE)
    const L = computeMagazineLayout(c, CANVAS_BOTTOM)
    expect(L.title.y).toBeCloseTo(-(120 + 0) + MAG_TITLE_TOP, 6)
    expect(L.title.y).toBeLessThan(0)
    expect(L.subtitle.y).toBeCloseTo(L.title.y + MAG_TITLE_SIZE + MAG_SUB_GAP, 6)
    // 副标题底部仍在照片顶（内容区 y=0）之上
    expect(L.subtitle.y + MAG_SUB_SIZE).toBeLessThanOrEqual(0)
  })

  it('右侧信息块自底向上：参数贴底缘锚点、机型在其上方一个行距处（右对齐）', () => {
    const c = cfg(BASE)
    const L = computeMagazineLayout(c, CANVAS_BOTTOM)
    expect(L.exif.y + 30).toBeCloseTo(CANVAS_BOTTOM - 40, 6)
    expect(L.model.y + c.cameraModelSize).toBeCloseTo(L.exif.y - MAG_ROW_GAP, 6)
    expect(L.exif.x).toBeCloseTo(DESIGN_CONTAINER - MAG_RIGHT_INSET, 6)
  })

  it('取色色卡在底部左侧，与机型行垂直居中对齐，宽度 = 5 格', () => {
    const c = cfg(BASE)
    const L = computeMagazineLayout(c, CANVAS_BOTTOM)
    expect(L.palette.x).toBe(MAG_BOTTOM_INSET)
    expect(L.palette.w).toBe(MAG_SWATCH_COUNT * MAG_SWATCH_W)
    expect(L.palette.h).toBe(MAG_SWATCH_H)
    expect(L.palette.y + MAG_SWATCH_H / 2).toBeCloseTo(L.model.y + c.cameraModelSize / 2, 6)
  })

  it('关闭参数行：机型块下沉贴底，色卡随之对齐', () => {
    const c = cfg({ ...BASE, showExif: false })
    const L = computeMagazineLayout(c, CANVAS_BOTTOM)
    expect(L.model.y + c.cameraModelSize).toBeCloseTo(CANVAS_BOTTOM - 40, 6)
    expect(L.palette.y + MAG_SWATCH_H / 2).toBeCloseTo(L.model.y + c.cameraModelSize / 2, 6)
  })

  it('标题空文本时标题区坐标仍有效（渲染端按内容显隐）', () => {
    const c = cfg({ ...BASE, infoTitle: '' })
    const L = computeMagazineLayout(c, CANVAS_BOTTOM)
    expect(L.title.y).toBeCloseTo(-120 + MAG_TITLE_TOP, 6)
  })
})
