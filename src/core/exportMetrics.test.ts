// computeExportMetrics / estimateExportSize 与 exportFrame 公式同源性测试：
// 断言关键场景的画布尺寸（公式基准：DESIGN_CONTAINER=1200）
import { describe, it, expect } from 'vitest'
import { estimateExportSize } from './exporter'
import { defaultFrameConfig } from './types'
import { useTemplates } from '../composables/useTemplates'

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

  it('frameRatio + 边框：最终整体画布比例 = frameRatio（非内容区）', () => {
    // 画布宽 = 1200 + padding40×2 = 1280；选 16:9（1.7778）→ 整体高 = 1280/1.7778 = 720
    // 比例模式反推内容高 = 720 - 上下 padding(80) - borderRatio(0) = 640
    const cfg = { ...defaultFrameConfig, frameRatio: 16 / 9, scale: 100, padding: 40, borderRatio: 0, bgExpand: 0, canvasH: 0 }
    const r = estimateExportSize(3000, 2000, cfg, 1)
    expect(r.w / r.h).toBeCloseTo(16 / 9, 3)
  })

  it('frameRatio + 1:1 + 下边留白：整体画布仍为 1:1', () => {
    // 画布宽 = 1200 + padding20×2 = 1240；borderRatio=100 → 内容高 = 1240 - 40 - (20+100) = 1040
    const cfg = { ...defaultFrameConfig, frameRatio: 1, scale: 100, padding: 20, borderRatio: 100, bgExpand: 0, canvasH: 0 }
    const r = estimateExportSize(3000, 2000, cfg, 1)
    expect(r.w / r.h).toBeCloseTo(1, 3)
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

describe('全量内置模板导出度量冒烟（40 套 × 3 类源图，几何不允许 NaN/非正数）', () => {
  // 模板配置经 defaultFrameConfig 兜底后，逐套跑导出度量纯计算。
  // 捕捉目标：frameRatio/竖排/顶部锚点/card/magazine 等任何分支产生 NaN、0 或负值画布。
  const { templates } = useTemplates()
  const builtin = templates.filter((t) => t.builtin)
  const SOURCES: Array<{ name: string; w: number; h: number }> = [
    { name: '横版 3:2', w: 3000, h: 2000 },
    { name: '竖版 2:3', w: 2000, h: 3000 },
    { name: '方版 1:1', w: 2400, h: 2400 },
  ]
  // 模拟导入时的 canvasH 初始化：照片设计高(800) + 上 pad + 下 pad+borderRatio（自由模式语义）
  const CANVAS_H = 800 + 60 + 60

  it('模板数量仍为 53（与 useTemplates 测试互为对照）', () => {
    expect(builtin.length).toBe(53)
  })

  for (const src of SOURCES) {
    it(`${src.name}：全部模板画布尺寸均为正有限数`, () => {
      for (const t of builtin) {
        const cfg = { ...defaultFrameConfig, ...t.config, canvasH: CANVAS_H }
        const r = estimateExportSize(src.w, src.h, cfg, 1)
        expect(Number.isFinite(r.w), `${t.id} 宽度非有限数: ${r.w}`).toBe(true)
        expect(Number.isFinite(r.h), `${t.id} 高度非有限数: ${r.h}`).toBe(true)
        expect(r.w, `${t.id} 画布宽非正`).toBeGreaterThan(0)
        expect(r.h, `${t.id} 画布高非正`).toBeGreaterThan(0)
        // 超采样上限约束：任一维不得超过浏览器画布上限 16384
        expect(r.w, `${t.id} 画布宽超上限`).toBeLessThanOrEqual(16384)
        expect(r.h, `${t.id} 画布高超上限`).toBeLessThanOrEqual(16384)
      }
    })
  }
})
