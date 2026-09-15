// 模板样张回归：内置模板 ↔ 样张文件一一对应（文件名 = 模板 id，改名/删除即报警）
import { describe, it, expect } from 'vitest'
import { sampleForTemplate, hasSample, sampleCount } from './templateSamples'
import { useTemplates } from '../composables/useTemplates'

describe('模板库样张照片', () => {
  it('每个内置模板都有配套样张', () => {
    const { templates } = useTemplates()
    const builtin = templates.filter((t) => t.builtin)
    const missing = builtin.filter((t) => !hasSample(t.id)).map((t) => t.id)
    expect(missing, `以下模板缺少样张: ${missing.join(', ')}`).toEqual([])
  })

  it('样张数量与内置模板数一致（无孤儿文件）', () => {
    const { templates } = useTemplates()
    expect(sampleCount()).toBe(templates.filter((t) => t.builtin).length)
  })

  it('取用接口返回资源 URL，未知 id 返回 undefined', () => {
    expect(sampleForTemplate('m_duo_card')).toMatch(/template-samples\/m_duo_card/)
    expect(sampleForTemplate('not-exist-template')).toBeUndefined()
  })
})
