// magazine 标题自适应缩字号：超长标题按可用宽度等比缩小（下限 22px），常规标题保持基准字号。
// 用可测量的 canvas stub（measureText 按字符数 × 50px 估宽）驱动 measureTextWidth 真实链路。
import { describe, it, expect, beforeAll, vi } from 'vitest'
import { defaultFrameConfig, type FrameConfig } from './types'
import { computeMagazineLayout, magazineTitleFontSize, MAG_TITLE_SIZE, MAG_TITLE_TOP, MAG_SUB_GAP, MAG_SUB_SIZE } from './infoLayout'

beforeAll(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
    this: HTMLCanvasElement,
  ) {
    return {
      measureText: (t: string) => ({ width: t.length * 50 }),
    } as unknown as CanvasRenderingContext2D
  })
})

function cfg(patch: Partial<FrameConfig> = {}): FrameConfig {
  return { ...defaultFrameConfig, ...patch }
}

describe('magazine 标题自适应缩字号', () => {
  it('常规长度标题保持基准字号，副标题紧随基准行高', () => {
    const c = cfg({ infoLayout: 'magazine', padding: 120, infoTitle: "Nature's poetry" })
    // 15 字符 × 50px = 750 ≤ 可用宽度 1140 → 不缩
    expect(magazineTitleFontSize(c)).toBe(MAG_TITLE_SIZE)
    const L = computeMagazineLayout(c, 1200)
    expect(L.titleSize).toBe(MAG_TITLE_SIZE)
    expect(L.subtitle.y).toBeCloseTo(L.title.y + MAG_TITLE_SIZE + MAG_SUB_GAP, 6)
  })

  it('超长标题等比缩小且不低于下限，副标题随实际字号上移', () => {
    const c = cfg({ infoLayout: 'magazine', padding: 120, infoTitle: 'X'.repeat(40) })
    // 40 × 50 = 2000 > 1140 → 44 × 1140/2000 ≈ 25
    const size = magazineTitleFontSize(c)
    expect(size).toBeLessThan(MAG_TITLE_SIZE)
    expect(size).toBeGreaterThanOrEqual(22)
    const L = computeMagazineLayout(c, 1200)
    expect(L.titleSize).toBe(size)
    expect(L.subtitle.y).toBeCloseTo(L.title.y + size + MAG_SUB_GAP, 6)
  })

  it('极限长标题不小于下限 22px；空标题返回基准字号', () => {
    const huge = cfg({ infoLayout: 'magazine', padding: 120, infoTitle: 'X'.repeat(200) })
    expect(magazineTitleFontSize(huge)).toBe(22)
    const empty = cfg({ infoLayout: 'magazine', padding: 120, infoTitle: '' })
    expect(magazineTitleFontSize(empty)).toBe(MAG_TITLE_SIZE)
  })

  it('缩小后副标题底部仍在照片顶（内容区 y=0）之上', () => {
    const c = cfg({ infoLayout: 'magazine', padding: 120, infoTitle: 'X'.repeat(40) })
    const L = computeMagazineLayout(c, 1200)
    expect(L.title.y).toBeCloseTo(-120 + MAG_TITLE_TOP, 6)
    expect(L.subtitle.y + MAG_SUB_SIZE).toBeLessThanOrEqual(0)
  })
})
