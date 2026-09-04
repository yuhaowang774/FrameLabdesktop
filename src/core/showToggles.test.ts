// 显示开关 → 生效配置：边框/背景隐藏时几何归零（纯函数测试）
import { describe, it, expect } from 'vitest'
import { applyShowToggles } from './showToggles'
import { defaultFrameConfig, type FrameConfig } from './types'

function cfg(over: Partial<FrameConfig>): FrameConfig {
  return { ...defaultFrameConfig, ...over }
}

describe('applyShowToggles', () => {
  it('全部开关开启：返回原配置（不修改传入对象）', () => {
    const c = cfg({ padding: 27, borderRatio: 69, bgExpand: 10, bgBottomRatio: 5, bgMode: 'blur' })
    const eff = applyShowToggles(c)
    expect(eff).toEqual(c)
    expect(c.padding).toBe(27) // 未原地修改
  })

  it('showBorder=false：padding/borderRatio/borderRadius/bgExpand/bgBottomRatio 全部归零', () => {
    const eff = applyShowToggles(
      cfg({ showBorder: false, padding: 27, borderRatio: 69, borderRadius: 12, bgExpand: 10, bgBottomRatio: 5 }),
    )
    expect(eff.padding).toBe(0)
    expect(eff.borderRatio).toBe(0)
    expect(eff.borderRadius).toBe(0)
    expect(eff.bgExpand).toBe(0)
    expect(eff.bgBottomRatio).toBe(0)
  })

  it('showBackground=false：背景扩展归零，bgMode 保持原值（背景层显隐由渲染分支控制）', () => {
    const eff = applyShowToggles(
      cfg({ showBackground: false, bgMode: 'blur', bgColor: '#fff', bgExpand: 10, bgBottomRatio: 5 }),
    )
    expect(eff.bgMode).toBe('blur')
    expect(eff.bgExpand).toBe(0)
    expect(eff.bgBottomRatio).toBe(0)
    // 边框参数不受背景开关影响
    expect(eff.padding).toBe(defaultFrameConfig.padding)
  })

  it('showBorder=false 且 showBackground=false：两开关叠加，均归零', () => {
    const eff = applyShowToggles(
      cfg({ showBorder: false, showBackground: false, padding: 27, borderRatio: 69, bgExpand: 10, bgBottomRatio: 5, bgMode: 'blur' }),
    )
    expect(eff.padding).toBe(0)
    expect(eff.borderRatio).toBe(0)
    expect(eff.bgMode).toBe('blur') // 背景模式保持原值，层显隐由渲染分支控制
    expect(eff.bgExpand).toBe(0)
    expect(eff.bgBottomRatio).toBe(0)
  })
})