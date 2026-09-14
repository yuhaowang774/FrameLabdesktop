// 双指手势数学回归测试：锚点缩放（中点下的内容保持不动）、中点平移、缩放钳制。
import { describe, it, expect } from 'vitest'
import { pinchSample, pinchStep, ZOOM_MAX } from './pinch'

const ORIGIN = { x: 100, y: 50 }

describe('pinchSample', () => {
  it('两点 → 距离与中点', () => {
    const s = pinchSample([
      { x: 100, y: 100 },
      { x: 200, y: 100 },
    ])
    expect(s?.dist).toBeCloseTo(100, 6)
    expect(s?.mid).toEqual({ x: 150, y: 100 })
  })

  it('不足两点 → null', () => {
    expect(pinchSample([])).toBeNull()
    expect(pinchSample([{ x: 1, y: 2 }])).toBeNull()
  })
})

describe('pinchStep', () => {
  it('距离翻倍 → 缩放 ×2，且中点下的内容点保持不动', () => {
    const prev = { dist: 100, mid: { x: 300, y: 200 } }
    const next = { dist: 200, mid: { x: 300, y: 200 } }
    const out = pinchStep(prev, next, { zoom: 1, panX: 0, panY: 0 }, ORIGIN)
    expect(out.zoom).toBeCloseTo(2, 6)
    // 锚点校验：origin(100,50) + pan + c×zoom，其中 c 为中点相对布局原点的内容坐标
    const c = (next.mid.x - ORIGIN.x) / 1
    const screenBefore = ORIGIN.x + 0 + c * 1
    const screenAfter = ORIGIN.x + out.panX + c * out.zoom
    expect(screenAfter).toBeCloseTo(screenBefore, 6)
    // 纵向同理
    const cy = next.mid.y - ORIGIN.y
    expect(ORIGIN.y + out.panY + cy * out.zoom).toBeCloseTo(ORIGIN.y + cy, 6)
  })

  it('距离不变、中点位移 → 仅平移（量 = 中点位移），缩放不变', () => {
    const prev = { dist: 100, mid: { x: 300, y: 200 } }
    const next = { dist: 100, mid: { x: 340, y: 170 } }
    const out = pinchStep(prev, next, { zoom: 2, panX: 10, panY: 20 }, ORIGIN)
    expect(out.zoom).toBeCloseTo(2, 6)
    expect(out.panX).toBeCloseTo(10 + 40, 6)
    expect(out.panY).toBeCloseTo(20 - 30, 6)
  })

  it('缩小距离 → 缩放变小（缩出）', () => {
    const out = pinchStep(
      { dist: 200, mid: { x: 0, y: 0 } },
      { dist: 100, mid: { x: 0, y: 0 } },
      { zoom: 2, panX: 0, panY: 0 },
      ORIGIN,
    )
    expect(out.zoom).toBeCloseTo(1, 6)
  })

  it('到达 800% 上限后继续放大：倍率与画面均保持不动（仅中点位移生效）', () => {
    const out = pinchStep(
      { dist: 100, mid: { x: 300, y: 200 } },
      { dist: 200, mid: { x: 300, y: 200 } },
      { zoom: ZOOM_MAX, panX: 5, panY: 6 },
      ORIGIN,
    )
    expect(out.zoom).toBe(ZOOM_MAX)
    expect(out.panX).toBeCloseTo(5, 6)
    expect(out.panY).toBeCloseTo(6, 6)
  })
})
