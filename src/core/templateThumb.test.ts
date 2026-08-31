// 模板缩略图测试：验证画布几何与 exporter 同源、背景/布局分支正确、内置模板清单。
import { describe, it, expect, beforeAll } from 'vitest'
import { templateThumbSvg, templateThumbDataUrl } from './templateThumb'
import { useTemplates } from '../composables/useTemplates'

beforeAll(() => {
  // jsdom 未实现 canvas：主动返回 null，避免 "Not implemented" 噪音；
  // 缩略图会退化为按字符数估算字宽（见 FALLBACK_CHAR_RATIO）
  HTMLCanvasElement.prototype.getContext = (() => null) as unknown as HTMLCanvasElement['getContext']
})

describe('templateThumb 画布几何', () => {
  it('纯色模板：画布 = 照片 + 上下 padding + bgBottomRatio', () => {
    // photo 1200×800（3:2 示意）、padding 27、bgBottomRatio 69 → 1254 × 923
    const svg = templateThumbSvg({
      bgMode: 'solid',
      padding: 27,
      bgBottomRatio: 69,
      scale: 100,
      bgColor: '#ffffff',
      borderColor: '#ffffff',
    })
    expect(svg).toContain('viewBox="0 0 1254 923"')
  })

  it('模糊延展模板：画布叠加 bgExpand（上边）与 bgBottomExpand（下边）', () => {
    // padding 0、bgExpand 100、bgBottomRatio 90 → 下边扩展 190 → 1400 × (100+800+190)
    const svg = templateThumbSvg({ bgMode: 'blur', padding: 0, bgExpand: 100, bgBottomRatio: 90, scale: 100 })
    expect(svg).toContain('viewBox="0 0 1400 1090"')
  })

  it('scale 缩小照片时画布外框不变（边框向外扩展）', () => {
    const a = templateThumbSvg({ padding: 40, scale: 100 })
    const b = templateThumbSvg({ padding: 40, scale: 80 })
    // 画布宽度只由 padding/bgExpand 决定，与照片缩放无关
    expect(a).toContain('viewBox="0 0 1280 ')
    expect(b).toContain('viewBox="0 0 1280 ')
  })
})

describe('templateThumb 渲染分支', () => {
  it('纯色背景直接填 bgColor，不套模糊滤镜', () => {
    const svg = templateThumbSvg({ bgMode: 'solid', bgColor: '#123456' })
    expect(svg).toContain('fill="#123456"')
    expect(svg).not.toContain('<feGaussianBlur stdDeviation="45"')
  })

  it('模糊背景使用 feGaussianBlur，半径取 blur 值', () => {
    const svg = templateThumbSvg({ bgMode: 'blur', blur: 60 })
    expect(svg).toContain('<feGaussianBlur stdDeviation="60"')
  })

  it('duo 布局绘制分隔竖线，inline 布局不绘制', () => {
    const duo = templateThumbSvg({ infoLayout: 'duo', showExif: true, showDate: true, showLens: true })
    const inline = templateThumbSvg({ infoLayout: 'inline', showExif: true })
    expect(duo).toContain('opacity="0.28"')
    expect(inline).not.toContain('opacity="0.28"')
  })

  it('关闭全部 INFO 开关时不绘制信息元素', () => {
    const svg = templateThumbSvg({
      infoLayout: 'duo',
      showLogo: false,
      showExif: false,
      showDate: false,
      showCameraModel: false,
      showLens: false,
    })
    expect(svg).not.toContain('opacity="0.28"')
  })

  it('照片圆角与阴影按配置输出', () => {
    const svg = templateThumbSvg({ photoRadius: 35, shadow: 0.45 })
    expect(svg).toContain('rx="35"')
    expect(svg).toContain('feDropShadow')
  })
})

describe('templateThumb dataURL', () => {
  it('生成可直接用于 img src 的 dataURL', () => {
    const url = templateThumbDataUrl({ bgMode: 'solid', bgColor: '#ffffff' })
    expect(url.startsWith('data:image/svg+xml;utf8,')).toBe(true)
    expect(decodeURIComponent(url.slice('data:image/svg+xml;utf8,'.length))).toContain('<svg')
  })
})

describe('内置模板清单', () => {
  it('相框库仅保留两个样例模板（模糊背景 / 纯色边框已移除）', () => {
    const { templates } = useTemplates()
    const builtin = templates.filter((t) => t.builtin).map((t) => t.name)
    expect(builtin).toEqual(['白框参数卡', '圆角悬浮·模糊延展'])
  })
})
