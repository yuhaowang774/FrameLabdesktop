// 取色色卡：k-means 提取主色的确定性行为（stub canvas 像素）+ 兜底色与缓存。
import { describe, it, expect, beforeAll, afterEach, vi } from 'vitest'
import { extractPalette, FALLBACK_PALETTE, paletteFor } from './photoPalette'

/** 亮度（与模块内同式） */
function lum(hex: string): number {
  const n = parseInt(hex.slice(1), 16)
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return 0.299 * r + 0.587 * g + 0.114 * b
}

/** 构造 16×16 双色图像：左半深蓝 (20,40,90)、右半浅蓝 (150,185,225) */
function twoToneImageData(): Uint8ClampedArray {
  const w = 16
  const h = 16
  const data = new Uint8ClampedArray(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const c = x < w / 2 ? [20, 40, 90] : [150, 185, 225]
      data[i] = c[0]
      data[i + 1] = c[1]
      data[i + 2] = c[2]
      data[i + 3] = 255
    }
  }
  return data
}

beforeAll(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(function (
    this: HTMLCanvasElement,
  ) {
    return {
      drawImage: () => {},
      getImageData: () => ({ data: twoToneImageData() }),
    } as unknown as CanvasRenderingContext2D
  })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('extractPalette', () => {
  it('双色图像提取的主色按明度升序（深→浅），均为合法 hex', () => {
    const pal = extractPalette({ width: 16, height: 16 } as unknown as HTMLCanvasElement, 16, 16)
    expect(pal).not.toBeNull()
    expect(pal!.length).toBe(5)
    for (const c of pal!) expect(c).toMatch(/^#[0-9a-f]{6}$/)
    // 深色在前、浅色在后
    expect(lum(pal![0])).toBeLessThan(lum(pal![pal!.length - 1]))
    // 两簇中心应贴近输入色（允许聚类微偏）
    expect(lum(pal![0])).toBeLessThan(70)
    expect(lum(pal![pal!.length - 1])).toBeGreaterThan(150)
  })

  it('宽度/高度为 0 时不抛错（回退兜底由调用方处理）', () => {
    const pal = extractPalette({ width: 0, height: 0 } as unknown as HTMLCanvasElement, 0, 0)
    expect(pal).not.toBeNull()
    expect(pal!.length).toBe(5)
  })
})

describe('FALLBACK_PALETTE 与 paletteFor 缓存', () => {
  it('兜底色卡为 5 个合法 hex', () => {
    expect(FALLBACK_PALETTE.length).toBe(5)
    for (const c of FALLBACK_PALETTE) expect(c).toMatch(/^#[0-9a-f]{6}$/)
  })

  it('photoSrc 为空返回兜底色；同一 photoSrc 二次调用命中缓存（同引用）', () => {
    expect(paletteFor(null)).toBe(FALLBACK_PALETTE)
    const first = paletteFor('blob:photo-a')
    expect(first.length).toBe(5)
    const second = paletteFor('blob:photo-a')
    expect(second).toBe(first)
  })
})
