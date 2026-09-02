// 相机型号原始 EXIF 代号 → 营销名 的映射回归测试
import { describe, it, expect } from 'vitest'
import { modelAlias, MODEL_ALIASES } from './modelAlias'

describe('相机型号别名映射', () => {
  it('Sony ILCE 机身代号转换为 α 营销名', () => {
    expect(modelAlias('ILCE-6000')).toBe('α6000')
    expect(modelAlias('ILCE-7RM5')).toBe('α7R V')
    expect(modelAlias('ILCE-7M4')).toBe('α7 IV')
    expect(modelAlias('ILCE-7M3')).toBe('α7 III')
    // 2024-2026 新机身
    expect(modelAlias('ILCE-9M3')).toBe('α9 III')
    expect(modelAlias('ILCE-1M2')).toBe('α1 II')
    expect(modelAlias('ILCE-7M5')).toBe('α7 V')
    expect(modelAlias('ILCE-7RM6')).toBe('α7R VI')
    expect(modelAlias('ILCE-6700')).toBe('α6700')
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

  it('手机工程代号 → 营销名（华为/三星/OPPO/一加/vivo）', () => {
    expect(modelAlias('ALN-AL00')).toBe('HUAWEI Mate 60 Pro')
    expect(modelAlias('BRA-AL00')).toBe('HUAWEI Mate 60')
    expect(modelAlias('PLR-AL00')).toBe('HUAWEI Mate 70 Pro')
    expect(modelAlias('SM-S9280')).toBe('Galaxy S24 Ultra')
    expect(modelAlias('SM-S9180')).toBe('Galaxy S23 Ultra')
    expect(modelAlias('SM-F9560')).toBe('Galaxy Z Fold6')
    expect(modelAlias('SM-S9480')).toBe('Galaxy S26 Ultra')
    expect(modelAlias('SM-F9710')).toBe('Galaxy Z Fold8')
    expect(modelAlias('SM-S7210')).toBe('Galaxy S24 FE')
    expect(modelAlias('PHZ110')).toBe('OPPO Find X7')
    expect(modelAlias('PKB110')).toBe('OPPO Find X8')
    expect(modelAlias('PHB110')).toBe('OnePlus 11')
    expect(modelAlias('V2309A')).toBe('vivo X100')
  })

  it('小米/Redmi/iQOO/荣耀/魅族 数字代号 → 营销名', () => {
    expect(modelAlias('23127PN0CC')).toBe('Xiaomi 14')
    expect(modelAlias('24031PN0DC')).toBe('Xiaomi 14 Ultra')
    expect(modelAlias('23113RKC6C')).toBe('Redmi K70')
    expect(modelAlias('22127RK46C')).toBe('Redmi K60 Pro')
    expect(modelAlias('V2307A')).toBe('iQOO 12')
    expect(modelAlias('V2408A')).toBe('iQOO 13')
    expect(modelAlias('BVL-AN00')).toBe('HONOR Magic6')
    expect(modelAlias('PTP-AN10')).toBe('HONOR Magic7 Pro')
    expect(modelAlias('M461Q')).toBe('魅族 21')
  })

  it('工程代号带品牌前缀时剥前缀查表；未收录代号原样返回', () => {
    expect(modelAlias('HUAWEI ALN-AL00')).toBe('HUAWEI Mate 60 Pro')
    expect(modelAlias('SM-S9280'.toLowerCase())).toBe('Galaxy S24 Ultra')
    // 未收录代号保持原文
    expect(modelAlias('99999XX00C')).toBe('99999XX00C')
    expect(modelAlias('iPhone 15 Pro')).toBe('iPhone 15 Pro')
  })

  it('映射表自身规范：键无空白、值非空', () => {
    for (const [k, v] of Object.entries(MODEL_ALIASES)) {
      expect(k.trim()).toBe(k)
      expect(v.trim().length).toBeGreaterThan(0)
    }
  })
})
