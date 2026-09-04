// 模板应用：info 缺失回填（二次应用不丢信息）+ 颜色随模板背景自适应
import { describe, expect, it } from 'vitest'
import { applyTemplateToState } from './useTemplates'
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
