import { describe, it, expect } from 'vitest'
import { mapPhotoRectToConfig, mapBgRectToConfig, bgRectFromConfig } from './dragMap'
import { computeRect, type Rect } from './rectMath'

describe('mapPhotoRectToConfig', () => {
  const availW = 1040
  const padding = 80

  it('正常映射：左上角 + scale', () => {
    const c = mapPhotoRectToConfig({ left: 120, top: 90, width: 520, height: 390 }, availW, padding)
    expect(c.photoX).toBe(120)
    expect(c.photoY).toBe(90)
    expect(c.scale).toBe(Math.round((520 / 1040) * 100)) // 50
  })

  it('scale 上限 100（拖大不超过 100%）', () => {
    const c = mapPhotoRectToConfig({ left: 0, top: 0, width: 2000, height: 1500 }, availW, padding)
    expect(c.scale).toBe(100)
  })

  it('scale 下限 50', () => {
    const c = mapPhotoRectToConfig({ left: 0, top: 0, width: 100, height: 75 }, availW, padding)
    expect(c.scale).toBe(50)
  })

  it('拖拽不引入取整抖动：连续两次相同拖拽 scale 不变', () => {
    // 起始 rect 由 availW*0.6 给出，scale 应精确为 60
    const base: Rect = { left: 200, top: 100, width: availW * 0.6, height: availW * 0.6 * 0.75 }
    const c1 = mapPhotoRectToConfig(base, availW, padding)
    const c2 = mapPhotoRectToConfig(base, availW, padding)
    expect(c1.scale).toBe(c2.scale)
    expect(c1.scale).toBe(60)
    // photoX/photoY 不应被取整（避免亚像素漂移）
    expect(c1.photoX).toBe(base.left)
    expect(c1.photoY).toBe(base.top)
  })
})

describe('mapBgRectToConfig', () => {
  const containerH = 700
  const coverW = 1200 // 默认 cover 宽度

  it('默认（铺满、无偏移）映射为 bgScale=1, offset=0', () => {
    const c = mapBgRectToConfig({ left: 0, top: 0, width: 1200, height: 700 }, containerH, coverW)
    expect(c.bgScale).toBe(1)
    expect(c.bgOffsetX).toBe(0)
    expect(c.bgOffsetY).toBe(0)
  })

  it('1× 铺满时不可平移：向右拖 100 偏移仍为 0（避免白边）', () => {
    const c = mapBgRectToConfig({ left: 100, top: 0, width: 1200, height: 700 }, containerH, coverW)
    expect(c.bgOffsetX).toBe(0)
    expect(c.bgScale).toBe(1)
  })

  it('放大到 1.5× 后向右平移 100 设计像素 → offsetX=100', () => {
    const c = mapBgRectToConfig({ left: -200, top: -350, width: 1800, height: 1200 }, containerH, coverW)
    expect(c.bgScale).toBe(1.5)
    expect(c.bgOffsetX).toBe(100)
  })

  it('放大到 2 倍（宽 2400）→ bgScale=2，中心仍居中则 offset=0', () => {
    const c = mapBgRectToConfig({ left: -600, top: -350, width: 2400, height: 1400 }, containerH, coverW)
    expect(c.bgScale).toBe(2)
    expect(c.bgOffsetX).toBe(0)
    expect(c.bgOffsetY).toBe(0)
  })

  it('bgScale 上限 4 / 下限 0.5', () => {
    const big = mapBgRectToConfig({ left: -5000, top: 0, width: 10000, height: 10000 }, containerH, coverW)
    expect(big.bgScale).toBe(4)
    const small = mapBgRectToConfig({ left: 500, top: 0, width: 200, height: 200 }, containerH, coverW)
    expect(small.bgScale).toBe(0.5)
  })

  it('基于 coverW（非容器宽）计算 bgScale：coverW=900 时宽 1800 → 2×', () => {
    const c = mapBgRectToConfig({ left: -450, top: 0, width: 1800, height: 1200 }, containerH, 900)
    expect(c.bgScale).toBe(2)
  })

  it('背景平移被钳制在覆盖范围内：拖出边界不会产生白边', () => {
    // 1.5 倍放大，可平移范围 ±(coverW*scale - DESIGN)/2 = ±(1800-1200)/2 = ±300
    const c = mapBgRectToConfig({ left: -900, top: 0, width: 1800, height: 1200 }, containerH, coverW)
    expect(c.bgScale).toBe(1.5)
    // 偏移被钳制到 -300（而非 -900），保证左右仍被背景覆盖
    expect(c.bgOffsetX).toBeCloseTo(-300, 6)
  })

  it('背景默认（1×）时不可平移：偏移恒为 0（避免白边）', () => {
    const c = mapBgRectToConfig({ left: 100, top: 0, width: 1200, height: 700 }, containerH, coverW)
    expect(c.bgOffsetX).toBe(0)
    expect(c.bgOffsetY).toBe(0)
  })
})

describe('背景拖拽 round-trip（修复：竖向缩放不跳动）', () => {
  const containerH = 700
  const coverW = 1200
  const aspect = 0.75 // 图像高/宽
  // 起始为 1.5× 放大状态：此时可平移，锚点不变量成立（1× 及以下平移被钳制为 0）
  // 宽高比必须 = 图像 aspect(0.75)，与真实 bgRect 一致（computeRect 会保持该比例）
  const start: Rect = { left: -300, top: -425, width: 1800, height: 1350 }

  // 真实数据流：用户拖拽 → computeRect 产生矩形 → 映射配置 → 反推选择框，应与原矩形一致（无跳变）
  function roundTrip(dragged: Rect): Rect {
    const cfg = mapBgRectToConfig(dragged, containerH, coverW)
    return bgRectFromConfig(cfg.bgScale, cfg.bgOffsetX, cfg.bgOffsetY, coverW, aspect, containerH)
  }

  it('se 角点拖拽：右下锚点固定，宽高等比，无跳变', () => {
    const dragged = computeRect('se', start, 200, 150, { lockAspect: true })
    const back = roundTrip(dragged)
    expect(back.left).toBeCloseTo(dragged.left, 0)
    expect(back.top).toBeCloseTo(dragged.top, 0)
    expect(back.width).toBeCloseTo(dragged.width, 0)
    expect(back.height).toBeCloseTo(dragged.height, 0)
  })

  it('nw 角点拖拽：锚定右下且保持比例（此前 bug 会令高度跳变）', () => {
    const dragged = computeRect('nw', start, 100, 100, { lockAspect: true })
    const back = roundTrip(dragged)
    // 右下角固定：left+width / top+height 应等于原始右下角
    expect(back.left + back.width).toBeCloseTo(start.left + start.width, 0)
    expect(back.top + back.height).toBeCloseTo(start.top + start.height, 0)
  })

  it('n 边竖向拖拽：高度变化驱动，底边固定，无跳变', () => {
    const dragged = computeRect('n', start, 0, 40, { lockAspect: true })
    const back = roundTrip(dragged)
    expect(back.top + back.height).toBeCloseTo(start.top + start.height, 0) // 底边固定
  })
})

describe('预览与导出一致性（photoX/photoY 使用设计坐标，未乘 fitScale）', () => {
  it('mapPhotoRectToConfig 输出的是设计坐标（与 exporter 期望一致）', () => {
    const c = mapPhotoRectToConfig({ left: 200, top: 150, width: 600, height: 450 }, 1040, 80)
    // 设计坐标直接用于导出，不应被缩放
    expect(c.photoX).toBe(200)
    expect(c.photoY).toBe(150)
  })
})
