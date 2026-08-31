// 颜色工具测试：文字与 Logo 的明暗自适应规则（浅底黑 / 深底白）
import { describe, it, expect } from 'vitest'
import { hexLuminance, footerTextColor, logoAutoColor } from './colorUtils'

describe('hexLuminance', () => {
  it('计算相对亮度（Rec.709），黑白两端与非法输入', () => {
    expect(hexLuminance('#ffffff')).toBeCloseTo(1, 5)
    expect(hexLuminance('#000000')).toBeCloseTo(0, 5)
    expect(hexLuminance(null)).toBe(0)
    expect(hexLuminance('not-a-color')).toBe(0)
  })

  it('支持 #rgb 简写', () => {
    expect(hexLuminance('#fff')).toBeCloseTo(1, 5)
  })
})

describe('logoAutoColor', () => {
  it('auto + 纯色浅底 → 近黑，保证 Logo 与白框有对比', () => {
    expect(logoAutoColor('auto', 'solid', '#ffffff')).toBe('#1a1a1a')
    expect(logoAutoColor('auto', 'solid', '#F5F0E6')).toBe('#1a1a1a')
  })

  it('auto + 纯色深底 → 纯白', () => {
    expect(logoAutoColor('auto', 'solid', '#1a1a1a')).toBe('#ffffff')
  })

  it('auto + 模糊/照片背景 → 纯白', () => {
    expect(logoAutoColor('auto', 'blur', '#ffffff')).toBe('#ffffff')
    expect(logoAutoColor('auto', 'photo', null)).toBe('#ffffff')
  })

  it('显式色值原样返回，不受背景影响', () => {
    expect(logoAutoColor('#FFE100', 'solid', '#ffffff')).toBe('#FFE100')
    expect(logoAutoColor('#ffffff', 'solid', '#ffffff')).toBe('#ffffff')
  })

  it('未设置 logoColor 时按 auto 处理', () => {
    expect(logoAutoColor(undefined, 'solid', '#ffffff')).toBe('#1a1a1a')
  })
})

describe('footerTextColor', () => {
  it('浅底黑字 / 深底白字，透明度可配', () => {
    expect(footerTextColor('solid', '#ffffff')).toBe('rgba(0,0,0,0.95)')
    expect(footerTextColor('solid', '#1a1a1a')).toBe('rgba(255,255,255,0.95)')
    expect(footerTextColor('blur', '#ffffff')).toBe('rgba(255,255,255,0.95)')
    expect(footerTextColor('solid', '#ffffff', 0.5)).toBe('rgba(0,0,0,0.5)')
  })
})
