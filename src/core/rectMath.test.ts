import { describe, it, expect } from 'vitest'
import { computeRect, type Rect } from './rectMath'

const base: Rect = { left: 100, top: 100, width: 400, height: 300 }
const ratio = base.height / base.width // 0.75

describe('computeRect - move', () => {
  it('平移：left/top 随位移变化，宽高不变', () => {
    const r = computeRect('move', base, 50, -20)
    expect(r).toEqual({ left: 150, top: 80, width: 400, height: 300 })
  })
})

describe('computeRect - 自由缩放（lockAspect=false）', () => {
  const opts = { lockAspect: false, minSize: 20 }

  it('e：仅右边界变化', () => {
    const r = computeRect('e', base, 40, 0, opts)
    expect(r.width).toBe(440)
    expect(r.left).toBe(100)
    expect(r.height).toBe(300)
  })
  it('w：左边界变化，left 跟随', () => {
    const r = computeRect('w', base, 40, 0, opts)
    expect(r.width).toBe(360)
    expect(r.left).toBe(140)
    expect(r.top).toBe(100)
  })
  it('s：下边界变化', () => {
    const r = computeRect('s', base, 0, 40, opts)
    expect(r.height).toBe(340)
    expect(r.top).toBe(100)
  })
  it('n：上边界变化，top 跟随', () => {
    const r = computeRect('n', base, 0, 40, opts)
    expect(r.height).toBe(260)
    expect(r.top).toBe(140)
  })
  it('se：右下角同时变化', () => {
    const r = computeRect('se', base, 40, 30, opts)
    expect(r.width).toBe(440)
    expect(r.height).toBe(330)
    expect(r.left).toBe(100)
    expect(r.top).toBe(100)
  })
  it('nw：左上角同时变化', () => {
    const r = computeRect('nw', base, 40, 30, opts)
    expect(r.width).toBe(360)
    expect(r.height).toBe(270)
    expect(r.left).toBe(140)
    expect(r.top).toBe(130)
  })
  it('超过最小尺寸：clamp 且反向边位置修正', () => {
    const r = computeRect('w', base, 500, 0, opts) // 想缩到负，应被夹到 20
    expect(r.width).toBe(20)
    expect(r.left).toBe(100 + (400 - 20)) // 右边界不动
    expect(r.top).toBe(100)
  })
})

describe('computeRect - 锁定宽高比（lockAspect=true，图片）', () => {
  const opts = { lockAspect: true, minSize: 20 }

  it('e：宽度变化驱动高度按比例', () => {
    const r = computeRect('e', base, 40, 0, opts)
    expect(r.width).toBe(440)
    expect(r.height).toBeCloseTo(440 * ratio, 5)
    expect(r.left).toBe(100)
    expect(r.top).toBe(100)
  })
  it('w：左边界变化，宽度变化驱动高度，left 回算', () => {
    const r = computeRect('w', base, 40, 0, opts)
    expect(r.width).toBe(360)
    expect(r.height).toBeCloseTo(360 * ratio, 5)
    expect(r.left).toBe(140)
    expect(r.top).toBe(100)
  })
  it('n：上边界变化（此前 bug：竖向边手柄失效），高度驱动宽度', () => {
    const r = computeRect('n', base, 0, 30, opts)
    expect(r.height).toBeCloseTo(270, 5)
    expect(r.width).toBeCloseTo(270 / ratio, 5)
    expect(r.top).toBe(130)
    // 底边保持不动：top + height == 原 bottom
    expect(r.top + r.height).toBeCloseTo(base.top + base.height, 5)
  })
  it('s：下边界变化，高度驱动宽度', () => {
    const r = computeRect('s', base, 0, 30, opts)
    expect(r.height).toBeCloseTo(330, 5)
    expect(r.width).toBeCloseTo(330 / ratio, 5)
    expect(r.top).toBe(100)
  })
  it('se：角点取水平变化为主（|dx|>=|dy|）', () => {
    const r = computeRect('se', base, 40, 30, opts)
    expect(r.width).toBe(440)
    expect(r.height).toBeCloseTo(440 * ratio, 5)
  })
  it('se：角点取垂直变化为主（|dy|>|dx|）', () => {
    const r = computeRect('se', base, 10, 60, opts)
    expect(r.height).toBeCloseTo(360, 5)
    expect(r.width).toBeCloseTo(360 / ratio, 5)
  })
  it('nw：左上角，宽度变化驱动，left/top 回算', () => {
    const r = computeRect('nw', base, 40, 30, opts)
    expect(r.width).toBe(360)
    expect(r.height).toBeCloseTo(360 * ratio, 5)
    expect(r.left).toBe(140)
    // 右下角保持不动
    expect(r.left + r.width).toBeCloseTo(base.left + base.width, 5)
    expect(r.top + r.height).toBeCloseTo(base.top + base.height, 5)
  })
  it('最小尺寸 clamp', () => {
    const r = computeRect('w', base, 500, 0, opts)
    expect(r.width).toBe(20)
    expect(r.height).toBeCloseTo(20 * ratio, 5)
  })
})

describe('computeRect - 边界', () => {
  it('start 宽高为 0 时 lockAspect 不崩溃', () => {
    const zero: Rect = { left: 0, top: 0, width: 0, height: 0 }
    const r = computeRect('se', zero, 10, 10, { lockAspect: true })
    expect(r.width).toBe(10)
    expect(r.height).toBe(10)
  })
})
