// card 白底水印卡布局计算测试：左右列定位 / 标块矩形 / 自适应卡高
import { describe, it, expect } from 'vitest'
import { computeCardLayout, CARD_INSET, CARD_PAD_V, CARD_ROW_GAP, CARD_RADIUS } from './infoLayout'
import { defaultFrameConfig } from './types'

// 基准配置：card 布局 + 小米 + 全部开关
function cardCfg(over: Partial<typeof defaultFrameConfig> = {}) {
  return {
    ...defaultFrameConfig,
    infoLayout: 'card' as const,
    brand: 'xiaomi',
    showCameraModel: true,
    cameraModel: 'Xiaomi 14 Ultra',
    cameraModelSize: 30,
    showExif: true,
    exifText: '24mm f/1.6 1/120s ISO100',
    exifFontSize: null,
    fontSize: 30,
    showLens: true,
    lensText: 'Summilux 24mm',
    showDate: true,
    dateText: '2026/08/31',
    cardShowDate: true,
    overlayBottom: 20,
    ...over,
  }
}

describe('computeCardLayout', () => {
  it('卡片通栏（左右留 inset）、底缘对齐 canvasBottom - overlayBottom', () => {
    const L = computeCardLayout(cardCfg(), 800)
    expect(L.card.x).toBe(CARD_INSET)
    expect(L.card.w).toBe(1200 - CARD_INSET * 2)
    expect(L.card.y + L.card.h).toBe(800 - 20)
  })

  it('卡高自适应：= 上下内边距 + 较高一列高', () => {
    const full = computeCardLayout(cardCfg(), 800)
    const minimal = computeCardLayout(cardCfg({ cardShowDate: false, showLens: false }), 800)
    // 全开：左右两列均为 30+GAP+30，contentH = 70
    expect(full.card.h).toBe(CARD_PAD_V * 2 + 30 + CARD_ROW_GAP + 30)
    // 最简（仅机型+参数）：contentH = max(30, 小米标块高 34) = 34（标块撑高）
    expect(minimal.card.h).toBe(CARD_PAD_V * 2 + 34)
    expect(minimal.card.h).toBeLessThan(full.card.h)
  })

  it('左列左对齐卡片内缩；右列右对齐且为标块让位', () => {
    const L = computeCardLayout(cardCfg(), 800)
    expect(L.model.x).toBe(L.card.x + CARD_INSET)
    // 小米有 LEICA 标块：右列右缘 = 卡右 - 内缩 - 标块宽 - 间距
    expect(L.exif.x + L.exif.w).toBeLessThan(L.card.x + L.card.w - CARD_INSET)
    expect(L.badge).not.toBeNull()
    expect(L.badge!.x + L.badge!.w).toBe(L.card.x + L.card.w - CARD_INSET)
  })

  it('无联名品牌（iphone）无标块，右列贴卡右内缩', () => {
    const L = computeCardLayout(cardCfg({ brand: 'iphone' }), 800)
    expect(L.badge).toBeNull()
  })

  it('相机品牌在 card 模式下无标块（标块仅手机品牌）', () => {
    const L = computeCardLayout(cardCfg({ brand: 'sony' }), 800)
    expect(L.badge).toBeNull()
  })

  it('卡片圆角常量', () => {
    expect(CARD_RADIUS).toBeGreaterThan(0)
  })
})
