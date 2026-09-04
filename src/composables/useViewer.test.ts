// 查看器缩放/平移：锚点缩放 setZoomAt 的数学验证（含 10%~800% 钳制）。
// 回归：缩放达到上限/下限后继续滚轮，倍率不变则平移必须不动（否则画面偏移）。
import { describe, it, expect, beforeEach } from 'vitest'
import { useViewer } from './useViewer'

const viewer = useViewer()

describe('useViewer 锚点缩放 setZoomAt', () => {
  beforeEach(() => viewer.resetView())

  it('常规缩放：锚点下内容不动（平移随倍率修正）', () => {
    viewer.setZoomAt(1.5, 100, 50)
    expect(viewer.zoom.value).toBeCloseTo(1.5)
    expect(viewer.panX.value).toBeCloseTo(-(1.5 - 1) * 100)
    expect(viewer.panY.value).toBeCloseTo(-(1.5 - 1) * 50)
  })

  it('上限 800%：继续放大被钳制，倍率不变 → 平移不动（画面不偏移）', () => {
    viewer.setZoom(8)
    viewer.setPan(30, 40)
    viewer.setZoomAt(8.8, 120, 60)
    expect(viewer.zoom.value).toBe(8)
    expect(viewer.panX.value).toBe(30)
    expect(viewer.panY.value).toBe(40)
  })

  it('下限 10%：继续缩小被钳制，倍率不变 → 平移不动（画面不偏移）', () => {
    viewer.setZoom(0.1)
    viewer.setPan(-20, -10)
    viewer.setZoomAt(0.09, 80, 40)
    expect(viewer.zoom.value).toBe(0.1)
    expect(viewer.panX.value).toBe(-20)
    expect(viewer.panY.value).toBe(-10)
  })

  it('跨越上限 7.5→8.25：按实际生效倍率修正平移（非原始 factor）', () => {
    viewer.setZoom(7.5)
    viewer.setZoomAt(8.25, 100, 0)
    expect(viewer.zoom.value).toBe(8)
    const eff = 8 / 7.5
    expect(viewer.panX.value).toBeCloseTo(-(eff - 1) * 100)
    expect(viewer.panY.value).toBe(0)
  })

  it('跨越下限 0.11→0.09：按实际生效倍率修正平移', () => {
    viewer.setZoom(0.11)
    viewer.setZoomAt(0.09, 0, 100)
    expect(viewer.zoom.value).toBe(0.1)
    const eff = 0.1 / 0.11
    expect(viewer.panY.value).toBeCloseTo(-(eff - 1) * 100)
  })
})
