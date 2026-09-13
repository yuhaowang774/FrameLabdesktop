// 农历换算校验：锚点 = 历年春节（正月初一）与法定传统节日（中秋/端午）+ 闰月边界。
// 这些日期为公开历法事实，能逐点验证 LUNAR_INFO 位表与扣月算法的正确性。
import { describe, expect, it } from 'vitest'
import { lunarDayText, lunarLabel, lunarMonthText, solarToLunar } from './lunar'

/** 本地时区 Date（避免 UTC 偏移导致日期差一天） */
function d(iso: string): Date {
  const [y, m, day] = iso.split('-').map(Number)
  return new Date(y, m - 1, day)
}

describe('solarToLunar 春节锚点（正月初一）', () => {
  const cases: Array<[string, number]> = [
    ['2020-01-25', 2020],
    ['2021-02-12', 2021],
    ['2022-02-01', 2022],
    ['2023-01-22', 2023],
    ['2024-02-10', 2024],
    ['2025-01-29', 2025],
    ['2026-02-17', 2026],
    ['2027-02-06', 2027],
    ['2028-01-26', 2028],
    ['2029-02-13', 2029],
  ]
  for (const [iso, year] of cases) {
    it(`${iso} → ${year} 年正月初一`, () => {
      const l = solarToLunar(d(iso))
      expect(l.year).toBe(year)
      expect(l.month).toBe(1)
      expect(l.day).toBe(1)
      expect(l.leap).toBe(false)
    })
  }
})

describe('solarToLunar 传统节日锚点', () => {
  it('2026-09-25 → 八月十五（中秋）', () => {
    const l = solarToLunar(d('2026-09-25'))
    expect([l.month, l.day, l.leap]).toEqual([8, 15, false])
  })
  it('2025-10-06 → 八月十五（中秋）', () => {
    const l = solarToLunar(d('2025-10-06'))
    expect([l.month, l.day, l.leap]).toEqual([8, 15, false])
  })
  it('2025-05-31 → 五月初五（端午）', () => {
    const l = solarToLunar(d('2025-05-31'))
    expect([l.month, l.day, l.leap]).toEqual([5, 5, false])
  })
  it('2026-06-19 → 五月初五（端午）', () => {
    const l = solarToLunar(d('2026-06-19'))
    expect([l.month, l.day, l.leap]).toEqual([5, 5, false])
  })
})

describe('solarToLunar 闰月', () => {
  it('2025-07-25 → 闰六月初一（2025 年闰六月）', () => {
    const l = solarToLunar(d('2025-07-25'))
    expect(l.leap).toBe(true)
    expect(l.month).toBe(6)
    expect(l.day).toBe(1)
  })
  it('2025-08-23 → 七月初一（闰月后正常月顺延）', () => {
    // 闰六月 29 天：7-25 起闰六月，8-23 应为七月初一
    const l = solarToLunar(d('2025-08-23'))
    expect([l.month, l.day, l.leap]).toEqual([7, 1, false])
  })
  it('2023-03-22 → 闰二月初一（2023 年闰二月）', () => {
    const l = solarToLunar(d('2023-03-22'))
    expect(l.leap).toBe(true)
    expect(l.month).toBe(2)
    expect(l.day).toBe(1)
  })
})

describe('农历文本', () => {
  it('lunarDayText 覆盖初十/十四/二十/廿三/三十', () => {
    expect(lunarDayText(1)).toBe('初一')
    expect(lunarDayText(10)).toBe('初十')
    expect(lunarDayText(14)).toBe('十四')
    expect(lunarDayText(20)).toBe('二十')
    expect(lunarDayText(23)).toBe('廿三')
    expect(lunarDayText(30)).toBe('三十')
  })
  it('lunarMonthText 含闰月前缀', () => {
    expect(lunarMonthText(1, false)).toBe('正月')
    expect(lunarMonthText(8, false)).toBe('八月')
    expect(lunarMonthText(6, true)).toBe('闰六月')
  })
  it('lunarLabel：初一显示月名、其余显示日', () => {
    expect(lunarLabel(d('2026-02-17'))).toBe('正月')
    expect(lunarLabel(d('2026-09-14'))).toBe(lunarDayText(solarToLunar(d('2026-09-14')).day))
  })
})
