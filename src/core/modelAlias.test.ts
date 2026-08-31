// 相机型号原始 EXIF 代号 → 营销名 的映射回归测试
import { describe, it, expect } from 'vitest'
import { modelAlias, MODEL_ALIASES } from './modelAlias'

describe('相机型号别名映射', () => {
  it('Sony ILCE 机身代号转换为 α 营销名', () => {
    expect(modelAlias('ILCE-6000')).toBe('α6000')
    expect(modelAlias('ILCE-7RM5')).toBe('α7R V')
    expect(modelAlias('ILCE-7M4')).toBe('α7 IV')
    expect(modelAlias('ILCE-7M3')).toBe('α7 III')
  })

  it('DJI 内部代号转换为营销名', () => {
    expect(modelAlias('FC3682')).toBe('DJI Mini 3')
    expect(modelAlias('L2D-20c')).toBe('DJI Mavic 3')
    expect(modelAlias('FC3170')).toBe('DJI Mavic Air 2')
  })

  it('大小写与首尾空格不敏感', () => {
    expect(modelAlias('ilce-6000')).toBe('α6000')
    expect(modelAlias('  FC3682  ')).toBe('DJI Mini 3')
  })

  it('未命中或本身已是营销名时原样返回', () => {
    expect(modelAlias('A7R V')).toBe('A7R V')
    expect(modelAlias('D850')).toBe('D850')
    expect(modelAlias('X-T4')).toBe('X-T4')
    expect(modelAlias('EOS 5D Mark IV')).toBe('EOS 5D Mark IV')
  })

  it('空值安全', () => {
    expect(modelAlias(undefined)).toBe('')
    expect(modelAlias('')).toBe('')
  })

  it('映射表自身规范：键无空白、值非空', () => {
    for (const [k, v] of Object.entries(MODEL_ALIASES)) {
      expect(k.trim()).toBe(k)
      expect(v.trim().length).toBeGreaterThan(0)
    }
  })
})
