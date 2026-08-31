// 批量文本映射规则解析与应用
import { describe, it, expect } from 'vitest'
import { parseRules, makeRuleApplier } from './textRules'

describe('parseRules', () => {
  it('解析「查找 => 替换」行', () => {
    expect(parseRules('a => b\nc => d')).toEqual([['a', 'b'], ['c', 'd']])
  })
  it('空行与缺替换值行跳过', () => {
    expect(parseRules('\na => b\n仅查找\n  ')).toEqual([['a', 'b']])
  })
  it('替换值中可含 =>（仅首个作为分隔）', () => {
    expect(parseRules('x => y => z')).toEqual([['x', 'y => z']])
  })
  it('trim 查找与替换两端空白', () => {
    expect(parseRules('  a  =>   b ')).toEqual([['a', 'b']])
  })
})

describe('makeRuleApplier', () => {
  it('启用时按规则顺序链式替换全部出现', () => {
    // 链式语义：R1→R2 之后整串再经 R2→R3（与原 ExportPanel.applyRules 行为一致）
    const apply = makeRuleApplier('R1 => R2\nR2 => R3', true)
    expect(apply('R1 R1 R2')).toBe('R3 R3 R3')
    // 无链式冲突的常规替换
    expect(makeRuleApplier('腾龙28-200 E A071 => 腾龙 28-200', true)('镜头: 腾龙28-200 E A071')).toBe('镜头: 腾龙 28-200')
  })
  it('未启用时原样返回', () => {
    expect(makeRuleApplier('a => b', false)('a')).toBe('a')
  })
  it('空字符串原样返回', () => {
    expect(makeRuleApplier('a => b', true)('')).toBe('')
  })
})
