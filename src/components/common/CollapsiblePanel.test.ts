import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import CollapsiblePanel from './CollapsiblePanel.vue'

describe('CollapsiblePanel titleAction', () => {
  it('默认（toggle）：点击标题 emit toggle', async () => {
    const w = mount(CollapsiblePanel, { props: { title: '面板', open: true } })
    await w.find('.panel-head').trigger('click')
    expect(w.emitted('toggle')).toBeTruthy()
  })

  it('titleAction=popup：点击标题 emit popup 且不 emit toggle', async () => {
    const w = mount(CollapsiblePanel, { props: { title: '相框模板库', open: false, titleAction: 'popup' } })
    await w.find('.panel-head').trigger('click')
    expect(w.emitted('popup')).toHaveLength(1)
    expect(w.emitted('toggle')).toBeUndefined()
  })

  it('emphasized：根元素带 emphasized class，用于重要入口高亮', () => {
    const w = mount(CollapsiblePanel, { props: { title: '相框模板库', open: true, emphasized: true } })
    expect(w.find('.panel').classes()).toContain('emphasized')
    const plain = mount(CollapsiblePanel, { props: { title: '我的素材', open: true } })
    expect(plain.find('.panel').classes()).not.toContain('emphasized')
  })
})