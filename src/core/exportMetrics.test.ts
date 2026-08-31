// computeExportMetrics / estimateExportSize 与 exportFrame 公式同源性测试：
// 断言关键场景的画布尺寸（公式基准：DESIGN_CONTAINER=1200）
import { describe, it, expect } from 'vitest'
import { estimateExportSize } from './exporter'
import { defaultFrameConfig } from './types'

describe('estimateExportSize', () => {
  it('自由模式（无 frameRatio）：画布宽 = (1200 + 2*pad) * unitScale，unitScale = 源宽/照片设计宽', () => {
    // 3000×2000 源图，默认 scale=100，photoCrop 全幅 → photoDesignW=1200
    // unitScale = 3000/1200 = 2.5；canvasW = (1200 + 2*0 + 2*40)*2.5
    const cfg = { ...defaultFrameConfig, frameRatio: null, padding: 40, borderRatio: 0, bgExpand: 0, canvasH: 0 }
    const r = estimateExportSize(3000, 2000, cfg, 1)
    expect(r.w).toBe(Math.round((1200 + 80) * 2.5))
    // 高度 = photoDesignH(800) + pad(上40) + pad+borderRatio(下40)，× unitScale
    expect(r.h).toBe(Math.round((800 + 40 + 40) * 2.5))
  })

  it('frameRatio 模式：照片 contain 适配固定比例内容区', () => {
    // frameRatio=1.5 → contentH = 1200/1.5 = 800，contentAspect = 1.5
    // 源 3:2（aspect=1.5）→ photoBaseW = 1200；scale=50 → photoDesignW=600
    // unitScale = (3000*1)/600 = 5
    const cfg = { ...defaultFrameConfig, frameRatio: 1.5, scale: 50, padding: 0, borderRatio: 0, bgExpand: 0, canvasH: 0 }
    const r = estimateExportSize(3000, 2000, cfg, 1)
    expect(r.w).toBe(1200 * 5)
    expect(r.h).toBe(Math.round(800 * 5))
  })

  it('超采样等比放大（bgExpand/bgBottomRatio 同步）', () => {
    const cfg = { ...defaultFrameConfig, frameRatio: null, padding: 20, bgExpand: 30, bgBottomRatio: 10, canvasH: 0 }
    const r1 = estimateExportSize(1200, 800, cfg, 1)
    const r2 = estimateExportSize(1200, 800, cfg, 2)
    expect(r2.w).toBe(r1.w * 2)
    expect(r2.h).toBe(r1.h * 2)
  })

  it('scale=0 等非法输入按 1 处理不抛错', () => {
    const cfg = { ...defaultFrameConfig }
    expect(() => estimateExportSize(100, 100, cfg, 0)).not.toThrow()
  })
})
