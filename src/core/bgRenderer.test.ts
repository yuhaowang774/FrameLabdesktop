// drawWatermark 文字颜色管线测试：调用方传入的 color 必须落到 fillStyle（回归 2026-10-05——
// 此前硬编码 '#ffffff'，白底模板水印不可见）；缺省仍为白色（照片/深底惯例，向后兼容）。
import { describe, it, expect } from 'vitest'
import { drawWatermark } from './bgRenderer'

/** 最小桩 ctx：只记录属性赋值，不真正绘制 */
function stubCtx(): CanvasRenderingContext2D & { fillStyle: string } {
  return {
    save: () => {},
    restore: () => {},
    translate: () => {},
    rotate: () => {},
    fillText: () => {},
    drawImage: () => {},
    fillStyle: '',
  } as unknown as CanvasRenderingContext2D & { fillStyle: string }
}

const BASE = {
  text: '© PHOTOGRAPHER',
  image: null,
  opacity: 0.9,
  size: 7,
  angle: 0,
  tile: false,
  align: 'left' as const,
  bottom: 52,
}

describe('drawWatermark 文字颜色', () => {
  it('显式传入 color 时按传入值绘制（浅底深字）', () => {
    const ctx = stubCtx()
    drawWatermark(ctx, 1200, 900, { ...BASE, color: '#1a1a1a' })
    expect(ctx.fillStyle).toBe('#1a1a1a')
  })

  it('未传 color 时保持白色（照片/深底惯例）', () => {
    const ctx = stubCtx()
    drawWatermark(ctx, 1200, 900, { ...BASE })
    expect(ctx.fillStyle).toBe('#ffffff')
  })

  it('平铺模式同样应用传入颜色', () => {
    const ctx = stubCtx()
    drawWatermark(ctx, 1200, 900, { ...BASE, tile: true, angle: 30, color: '#1a1a1a' })
    expect(ctx.fillStyle).toBe('#1a1a1a')
  })
})
