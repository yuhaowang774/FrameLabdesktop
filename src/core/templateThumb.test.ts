// 模板缩略图测试：验证画布几何与 exporter 同源、背景/布局分支正确、内置模板清单。
import { describe, it, expect, beforeAll } from 'vitest'
import { templateThumbSvg, templateThumbDataUrl, buildDemoConfig } from './templateThumb'
import { useTemplates } from '../composables/useTemplates'
import { computeClassicLayout, CLASSIC_ROW_GAP, LENS_LINE_GAP } from './infoLayout'
import { defaultFrameConfig } from './types'

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
  it('相框库内置模板：两张用户样例复刻 + 水印审美样张风格', () => {
    const { templates } = useTemplates()
    const builtin = templates.filter((t) => t.builtin).map((t) => t.name)
    expect(builtin).toEqual([
      '白框参数卡',
      '圆角悬浮·模糊延展',
      '白卡装裱·衬线字标',
      '白底居中·机型参数',
      '全幅白条·铭牌',
      '银灰测绘·等宽参数',
      '胶片暗房·黑框',
      '轻量悬浮·型号水印',
      '复古CCD·日期戳',
      '杂志编辑·标题色卡',
    ])
  })
})

describe('buildDemoConfig INFO 覆盖（大预览真实照片信息）', () => {
  it('传入 info 时覆盖示意文本与品牌', () => {
    const c = buildDemoConfig(
      { bgMode: 'solid', bgColor: '#ffffff' },
      { exifText: '55mm f/4.5 1/200s ISO100', cameraModel: 'α6000', lensText: 'E 55-210mm F4.5-6.3 OSS', dateText: '2025/01/11', brand: 'canon' },
    )
    expect(c.exifText).toBe('55mm f/4.5 1/200s ISO100')
    expect(c.cameraModel).toBe('α6000')
    expect(c.lensText).toBe('E 55-210mm F4.5-6.3 OSS')
    expect(c.dateText).toBe('2025/01/11')
    expect(c.brand).toBe('canon')
    // 模板自身配置不受影响
    expect(c.bgColor).toBe('#ffffff')
  })

  it('未传 info 或字段缺失时回退示意文本与 sony', () => {
    const c = buildDemoConfig({ bgMode: 'blur' })
    expect(c.brand).toBe('sony')
    expect(c.exifText).toBe('50mm f/1.8 1/200s ISO400')

    const partial = buildDemoConfig({}, { exifText: '自定义' })
    expect(partial.exifText).toBe('自定义')
    expect(partial.cameraModel).toBe('ILCE-7RM5') // 未覆盖字段仍为示意
  })
})

describe('程序化 SVG 与真实布局引擎一致性（回归）', () => {
  it('classic 模板：信息层示意条必须绘制（历史 Bug：draw 返回值未拼接导致空白）', () => {
    const svg = templateThumbSvg({
      bgMode: 'solid',
      bgColor: '#ffffff',
      borderColor: '#ffffff',
      infoLayout: 'classic',
      showCameraModel: true,
      showExif: true,
      padding: 27,
      borderRatio: 159,
      overlayBottom: 85,
    })
    // 白底 → 深色示意条（rgba(0,0,0,…)）；修复前 classic 分支一条都不会输出
    const bars = (svg.match(/fill="rgba\(0,0,0/g) ?? []).length
    expect(bars).toBeGreaterThanOrEqual(2)
  })

  it('magazine 模板：标题条 + 5 格色卡 + 右侧信息条齐全', () => {
    const svg = templateThumbSvg({
      bgMode: 'solid',
      bgColor: '#ffffff',
      borderColor: '#ffffff',
      infoLayout: 'magazine',
      padding: 120,
      borderRatio: 71,
      infoTitle: "Nature's poetry",
      showPalette: true,
      showCameraModel: true,
      showExif: true,
      showDate: true,
    })
    // 白底深色条：标题条(0.95) + 副标题条(0.55) + 型号/参数条
    expect((svg.match(/fill="rgba\(0,0,0,0.95\)"/g) ?? []).length).toBeGreaterThanOrEqual(2)
    expect(svg).toContain('opacity="0.55"')
    // 色卡：兜底色 5 格，每格宽 88 高 30
    expect((svg.match(/#1d3a5f/g) ?? []).length).toBeGreaterThanOrEqual(1)
    expect((svg.match(/width="88"/g) ?? []).length).toBe(5)
  })

  it('magazine 关闭色卡：SVG 不含兜底色块', () => {
    const svg = templateThumbSvg({
      bgMode: 'solid',
      bgColor: '#ffffff',
      infoLayout: 'magazine',
      showPalette: false,
      showCameraModel: true,
    })
    expect(svg).not.toContain('#1d3a5f')
  })

  it('classic 缩略图行位置与 computeClassicLayout 引擎同构（顺序/行距/镜头行归属）', () => {
    const TEXTS = {
      exifText: '50mm f/1.8 1/200s ISO400',
      dateText: '2026.08.30',
      cameraModel: 'ILCE-7RM5',
      lensText: 'FE 50mm F1.8',
    }
    const config = {
      bgMode: 'solid' as const,
      bgColor: '#ffffff',
      borderColor: '#ffffff',
      infoLayout: 'classic' as const,
      padding: 27,
      borderRatio: 159,
      overlayBottom: 85,
      showCameraModel: true,
      showExif: true,
      showLens: true,
      showDate: true,
      showLogo: true,
      ...TEXTS,
    }
    const svg = templateThumbSvg(config)
    // 与缩略图相同的画布几何：照片 3:2 → 内容高 800；底部锚点 = canvasH - pad - overlayBottom
    const canvasH = 800 + 27 + (27 + 159)
    const merged = { ...defaultFrameConfig, ...config }
    const L = computeClassicLayout(merged, canvasH - 27)
    // 墨迹条垂直居中于文字行内：SVG y = 行顶画布坐标 + size/2 - ink(size)/2
    const inkOff = (size: number) => size / 2 - Math.max(1, size * 0.66) / 2
    const exifSize = merged.exifFontSize ?? merged.fontSize
    const lensSize = merged.lensFontSize ?? merged.fontSize
    // 引擎行顶 → 画布坐标（+ pad）；镜头行属于 EXIF 块内附加行；logo 为整高矩形（顶对齐）
    const expected = [
      { name: 'date', y: 27 + L.date.y + inkOff(merged.dateFontSize ?? merged.fontSize) },
      { name: 'exif', y: 27 + L.exif.y + inkOff(exifSize) },
      { name: 'lens', y: 27 + L.exif.y + exifSize + LENS_LINE_GAP + inkOff(lensSize) },
      { name: 'model', y: 27 + L.model.y + inkOff(merged.cameraModelSize) },
      { name: 'logo', y: 27 + L.logo.y },
    ]
    for (const e of expected) {
      expect(svg, `${e.name} 行应位于引擎计算的 y=${e.y}`).toContain(`y="${e.y}"`)
    }
    // 行距：classic 自底向上——EXIF 块底 = 日期行顶 - CLASSIC_ROW_GAP（块顶 = 块底 - 块高）
    const exifBlockH = exifSize + LENS_LINE_GAP + lensSize
    expect(L.exif.y + exifBlockH).toBeCloseTo(L.date.y - CLASSIC_ROW_GAP, 6)
  })
})
