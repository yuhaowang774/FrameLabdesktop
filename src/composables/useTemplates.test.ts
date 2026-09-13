// 模板应用：info 缺失回填（二次应用不丢信息）+ 颜色随模板背景自适应
import { describe, expect, it } from 'vitest'
import { applyTemplateToState, useTemplates, sanitizeTemplateConfig } from './useTemplates'
import { useFrameConfig } from './useFrameConfig'

const RAW = {
  focalLength: 50,
  fNumber: 1.8,
  exposureTime: 1 / 200,
  iso: 200,
  dateTimeOriginal: '2026:08:27 10:30:00',
  lensMake: 'SONY',
  lensModel: 'FE 55mm F1.8 ZA',
  model: 'α7R V',
  brandId: 'sony',
}

describe('applyTemplateToState 颜色自适应', () => {
  it('白底模板：Logo 自动取深色，文字色回「自动」（null → 渲染端按底色黑白）', () => {
    const { state, loadConfig } = useFrameConfig()
    // 模拟之前用过深底模板（白 Logo / 白字）的状态
    loadConfig({ logoColor: '#ffffff', exifTextColor: '#ffffff', cameraModelColor: '#ffffff' })
    applyTemplateToState({ bgMode: 'solid', bgColor: '#ffffff', showLogo: true })
    expect(state.logoColor).toBe('#1a1a1a')
    expect(state.exifTextColor).toBeNull()
    expect(state.lensTextColor).toBeNull()
    expect(state.dateTextColor).toBeNull()
    expect(state.cameraModelColor).toBeNull()
  })

  it('深底 / 模糊背景模板：Logo 自动取白色', () => {
    const { state } = useFrameConfig()
    applyTemplateToState({ bgMode: 'solid', bgColor: '#000000', showLogo: true })
    expect(state.logoColor).toBe('#ffffff')
    applyTemplateToState({ bgMode: 'blur', showLogo: true })
    expect(state.logoColor).toBe('#ffffff')
  })

  it('模板显式定义的颜色优先', () => {
    const { state } = useFrameConfig()
    applyTemplateToState({ bgMode: 'solid', bgColor: '#ffffff', showLogo: true, logoColor: '#8b0000' })
    expect(state.logoColor).toBe('#8b0000')
  })
})

describe('applyTemplateToState 二次应用不丢 info', () => {
  it('空字段与「自定义」占位从 exifRaw 回填（型号/品牌占位恢复）', () => {
    const { state, loadConfig } = useFrameConfig()
    // 模拟「复位 INFO 后再应用模板」的第二次使用场景
    loadConfig({ exifText: '', dateText: '', lensText: '', cameraModel: '自定义', brand: '自定义', exifRaw: RAW })
    applyTemplateToState({
      bgMode: 'solid', bgColor: '#ffffff',
      showLogo: true, showExif: true, showCameraModel: true, showLens: false, showDate: false,
    })
    expect(state.exifText).toBe('50mm f/1.8 1/200s ISO200')
    expect(state.cameraModel).toBe('α7R V')
    expect(state.brand).toBe('sony')
    expect(state.exifRaw).toEqual(RAW)
  })

  it('用户自填内容与字体样式保留；eqFocal/日期格式等 EXIF 语义不被模板重置', () => {
    const { state, loadConfig } = useFrameConfig()
    loadConfig({
      exifText: '我的参数', cameraModel: '我的机型', brand: 'canon',
      dateFormat: 'zh', eqFocal: true, cropFactor: 1.5, exifFontFamily: 'serif',
      exifRaw: RAW,
    })
    const missing = applyTemplateToState({ bgMode: 'blur', showExif: true, showCameraModel: true })
    expect(state.exifText).toBe('我的参数')
    expect(state.cameraModel).toBe('我的机型')
    expect(state.brand).toBe('canon')
    expect(state.dateFormat).toBe('zh')
    expect(state.eqFocal).toBe(true)
    expect(state.exifFontFamily).toBe('serif')
    expect(missing).toEqual([])
  })

  it('照片无 EXIF 且模板开启显示：落「自定义」占位并汇总提示', () => {
    const { state, loadConfig } = useFrameConfig()
    loadConfig({ exifRaw: null, exifText: '', cameraModel: '' })
    const missing = applyTemplateToState({
      bgMode: 'blur', showLogo: true, showExif: true, showCameraModel: true, showLens: true, showDate: true,
    })
    expect(state.exifText).toBe('自定义')
    expect(state.cameraModel).toBe('自定义')
    expect(state.brand).toBe('自定义')
    expect(missing).toContain('EXIF 参数')
    expect(missing).toContain('相机型号')
    expect(missing).toContain('品牌信息')
  })
})

describe('applyTemplateToState 层显示开关保留', () => {
  it('应用模板不重置用户手动关闭的 showBackground/showBorder/showInfo（开关与面板联动一致）', () => {
    const { state, loadConfig } = useFrameConfig()
    loadConfig({ showBackground: false, showBorder: false, showInfo: false })
    applyTemplateToState({ bgMode: 'solid', bgColor: '#ffffff', showLogo: true })
    expect(state.showBackground).toBe(false)
    expect(state.showBorder).toBe(false)
    expect(state.showInfo).toBe(false)
  })

  it('未手动关闭时应用模板后开关保持开启', () => {
    const { state, loadConfig } = useFrameConfig()
    loadConfig({ showBackground: true, showBorder: true, showInfo: true })
    applyTemplateToState({ bgMode: 'blur', showCameraModel: true })
    expect(state.showBackground).toBe(true)
    expect(state.showBorder).toBe(true)
    expect(state.showInfo).toBe(true)
  })
})

describe('内置模板清单结构校验', () => {
  it('62 套内置模板：id 唯一、名称非空、config 经 sanitize 无损往返', () => {
    const { templates, toTemplateConfig } = useTemplates()
    const builtin = templates.filter((t) => t.builtin)
    expect(builtin.length).toBe(62)
    const ids = new Set(builtin.map((t) => t.id))
    expect(ids.size).toBe(62)
    for (const t of builtin) {
      expect(t.name.trim().length).toBeGreaterThan(0)
      expect(t.category).toBe('frame')
      // 每个键都必须是 defaultFrameConfig 已知字段且类型一致（sanitize 不会丢字段）
      const out = sanitizeTemplateConfig(t.config)
      expect(Object.keys(out).length, `${t.id} 存在非法字段被 sanitize 丢弃`).toBe(Object.keys(t.config).length)
      void toTemplateConfig
    }
  })

  it('效果字段不用时显式归零：非颗粒/水印模板不带残留效果', () => {
    const { templates } = useTemplates()
    for (const t of templates.filter((x) => x.builtin)) {
      const usesGrain = t.id === 'm_kodak_years' || t.id === 'm_polaroid' || t.id === 'm_darkroom_contact' || t.id === 'm_ccd_flash'
      const usesVignette = usesGrain || t.id === 'm_edge_vertical' || t.id === 'm_finder_cross' || t.id === 'm_credit_block' || t.id === 'm_cover_masthead' || t.id === 'm_cover_exhibit' || t.id === 'm_gps_coord' || t.id === 'm_sport_dark'
      const usesWatermark = t.id === 'm_darkroom_contact' || t.id === 'm_watermark_tile' || t.id === 'm_watermark_corner' || t.id === 'm_ticket_horizontal' || t.id === 'm_ticket_vertical'
      if (!usesGrain) expect(t.config.grain ?? 0, t.id).toBe(0)
      if (!usesVignette) expect(t.config.vignette ?? 0, t.id).toBe(0)
      if (!usesWatermark) expect(t.config.showWatermark ?? false, t.id).toBe(false)
    }
  })
})

describe('全量内置模板应用冒烟（逐套过真实应用链路）', () => {
  it('逐套 applyTemplateToState：不抛错、画布高合法、布局/锚点字段合法、EXIF 回填不破坏', () => {
    const { templates } = useTemplates()
    const builtin = templates.filter((t) => t.builtin)
    const { state, loadConfig } = useFrameConfig()
    // 模拟导入照片后的状态：EXIF 就绪 + canvasH 已初始化（800 照片高 + 60 pad + 60 底带）
    loadConfig({ exifRaw: RAW, canvasH: 920, padding: 60, borderRatio: 0 })
    const VALID_LAYOUTS = ['classic', 'duo', 'inline', 'card', 'magazine', 'vertical', 'poster', 'calendar', 'sport']
    for (const t of builtin) {
      expect(() => applyTemplateToState(t.config), `${t.id} 应用抛错`).not.toThrow()
      expect(state.canvasH, `${t.id} 画布高非法`).toBeGreaterThanOrEqual(0)
      expect(Number.isFinite(state.canvasH), `${t.id} 画布高非有限数`).toBe(true)
      expect(VALID_LAYOUTS, `${t.id} 布局值非法: ${state.infoLayout}`).toContain(state.infoLayout)
      expect(['bottom', 'top'], `${t.id} 锚点值非法: ${state.overlayAnchor}`).toContain(state.overlayAnchor)
      expect(Number.isFinite(state.padding), `${t.id} padding 非法`).toBe(true)
      // EXIF 回填链路未被模板破坏（模板只带开关不带文本）
      if (t.config.showExif) expect(state.exifText.length, `${t.id} EXIF 文本缺失`).toBeGreaterThan(0)
    }
  })

  it('连续应用全部模板（模拟用户逐套切换）：状态始终可渲染', () => {
    const { templates } = useTemplates()
    const builtin = templates.filter((t) => t.builtin)
    const { state, loadConfig } = useFrameConfig()
    loadConfig({ exifRaw: RAW, canvasH: 920 })
    for (const t of builtin) applyTemplateToState(t.config)
    // 收尾应用报头式·顶部题注：状态处于顶锚 classic 且可渲染
    const masthead = templates.find((t) => t.id === 'm_masthead_top')
    expect(masthead).toBeTruthy()
    applyTemplateToState(masthead!.config)
    expect(state.infoLayout).toBe('classic')
    expect(state.overlayAnchor).toBe('top')
    expect(state.canvasH).toBeGreaterThan(0)
  })
})

describe('sanitizeTemplateConfig 可空字段保留（回归 2026-09-12）', () => {
  it('默认值为 null 的字段显式赋具体值时不得丢弃（日期样式/独立字体/标块配色/拖拽坐标）', () => {
    const out = sanitizeTemplateConfig({
      dateFontSize: 18,
      dateTextWeight: 400,
      dateTextOpacity: 0.75,
      exifFontFamily: 'Consolas, monospace',
      dateFontFamily: 'Georgia, serif',
      cameraModelColor: '#E8E6E1',
      cardBadgeBg: '#C9A96A',
      logoX: 120,
      // 非法值仍要拦截：NaN 数字与对象类型不进入
    })
    expect(out.dateFontSize).toBe(18)
    expect(out.dateTextWeight).toBe(400)
    expect(out.dateTextOpacity).toBe(0.75)
    expect(out.exifFontFamily).toBe('Consolas, monospace')
    expect(out.dateFontFamily).toBe('Georgia, serif')
    expect(out.cameraModelColor).toBe('#E8E6E1')
    expect(out.cardBadgeBg).toBe('#C9A96A')
    expect(out.logoX).toBe(120)
    const bad = sanitizeTemplateConfig({ dateFontSize: Number.NaN, exifFontFamily: 42 as unknown as string })
    expect(bad.dateFontSize).toBeUndefined()
    expect(bad.exifFontFamily).toBeUndefined()
  })

  it('null 赋给可空字段仍保留（回到跟随整体样式语义）', () => {
    const out = sanitizeTemplateConfig({ dateFontSize: null, exifFontFamily: null, frameRatio: null })
    expect(out.dateFontSize).toBeNull()
    expect(out.exifFontFamily).toBeNull()
    expect(out.frameRatio).toBeNull()
  })
})

describe('模板包（frame-template-pack）导入导出', () => {
  it('导出全部自定义模板为包 JSON，再导入回来数量一致', () => {
    const { templates, saveCurrent, clearCustom, exportPack, importJson } = useTemplates()
    clearCustom()
    const { state, loadConfig } = useFrameConfig()
    loadConfig({ bgMode: 'solid', bgColor: '#ffffff' })
    saveCurrent('我的黑白', state)
    saveCurrent('我的悬浮', { ...state, bgMode: 'blur' })
    expect(templates.filter((t) => !t.builtin).length).toBe(2)

    const pack = exportPack()
    expect(JSON.parse(pack).kind).toBe('frame-template-pack')
    clearCustom()
    expect(templates.filter((t) => !t.builtin).length).toBe(0)

    const res = importJson(pack)
    expect(res.ok).toBe(true)
    expect(res.count).toBe(2)
    expect(templates.filter((t) => !t.builtin).map((t) => t.name).sort()).toEqual(['我的悬浮 (导入)', '我的黑白 (导入)'])
    clearCustom()
  })

  it('单模板 JSON 与模板包 JSON 共用 importJson 自动分流', () => {
    const { templates, clearCustom, exportPack, importJson, exportJson } = useTemplates()
    clearCustom()
    // 非法包：空数组 → 失败
    expect(importJson(JSON.stringify({ kind: 'frame-template-pack', version: 1, templates: [] })).ok).toBe(false)
    // 模板包内含非法条目：跳过非法，导入合法
    const pack = JSON.parse(exportPack())
    void pack
    const mixed = {
      kind: 'frame-template-pack',
      version: 1,
      templates: [
        { name: '合法模板', category: 'frame', config: { bgMode: 'solid', bgColor: '#ffffff' } },
        { name: '', config: {} },
        { config: {} },
      ],
    }
    const res = importJson(JSON.stringify(mixed))
    expect(res.ok).toBe(true)
    expect(res.count).toBe(1)
    // 单模板 JSON 照常导入
    const { saveCurrent } = useTemplates()
    void saveCurrent
    clearCustom()
    const { state } = useFrameConfig()
    saveCurrent('单个', state)
    const single = exportJson(templates.find((t) => !t.builtin)!.id)
    clearCustom()
    expect(importJson(single).ok).toBe(true)
    expect(templates.filter((t) => !t.builtin).length).toBe(1)
    clearCustom()
  })
})
