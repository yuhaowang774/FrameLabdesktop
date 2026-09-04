// 常量与纯函数测试：画幅比例预设与比例图标尺寸（边框面板画幅调节用）
import { describe, it, expect } from 'vitest'
import { FRAME_RATIOS, frameRatioOf, frameRatioKey, ratioIconSize } from './constants'

describe('FRAME_RATIOS 预设', () => {
  it('覆盖常用横/竖/宽幅比例，key 互异', () => {
    const keys = FRAME_RATIOS.map((o) => o.value)
    expect(new Set(keys).size).toBe(keys.length)
    expect(FRAME_RATIOS.some((o) => o.value === 'free')).toBe(true)
    expect(FRAME_RATIOS.map((o) => o.value)).toContain('16:9')
    expect(FRAME_RATIOS.map((o) => o.value)).toContain('2.35:1')
  })

  it('frameRatioOf 解析 "w:h"，free 返回 null', () => {
    expect(frameRatioOf('free')).toBeNull()
    expect(frameRatioOf('16:9')).toBeCloseTo(16 / 9, 6)
    expect(frameRatioOf('2:3')).toBeCloseTo(2 / 3, 6)
    expect(frameRatioOf('2.35:1')).toBeCloseTo(2.35, 6)
  })

  it('frameRatioKey 反查：匹配预设值与 free', () => {
    expect(frameRatioKey(null)).toBe('free')
    expect(frameRatioKey(16 / 9)).toBe('16:9')
    expect(frameRatioKey(2 / 3)).toBe('2:3')
    expect(frameRatioKey(1.2345)).toBe('free') // 无匹配回退
  })
})

describe('ratioIconSize 比例图标尺寸', () => {
  it('null（自由）返回 null，由 UI 渲染虚线占位', () => {
    expect(ratioIconSize(null)).toBeNull()
  })

  it('宽幅（16:9）高受限：30×17', () => {
    expect(ratioIconSize(16 / 9)).toEqual({ w: 30, h: 17 })
  })

  it('方形（1:1）取容器内最大正方形 20×20', () => {
    expect(ratioIconSize(1)).toEqual({ w: 20, h: 20 })
  })

  it('竖版（2:3）宽受限：高 20 宽约 13', () => {
    expect(ratioIconSize(2 / 3)).toEqual({ w: 13, h: 20 })
  })

  it('宽银幕（2.35:1）→ 30×13', () => {
    expect(ratioIconSize(2.35)).toEqual({ w: 30, h: 13 })
  })
})