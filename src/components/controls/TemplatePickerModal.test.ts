// src/components/controls/TemplatePickerModal.test.ts
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive, nextTick } from 'vue'

// ---- composables mock ----
vi.mock('../../composables/useTemplates', () => ({
  frameTemplates: undefined, // 占位避免误用真实实现
  useTemplates: () => ({
    templates: reactive<Array<{ id: string; name: string; category: string; builtin?: boolean; desc?: string; config: Record<string, unknown> }>>([]),
    remove: vi.fn(),
  }),
  applyTemplateToState: vi.fn(() => []),
}))
vi.mock('../../composables/useAppState', () => ({
  useAppState: () => ({ state: { rightOpen: false }, setPanel: vi.fn() }),
}))
vi.mock('../../composables/useLibrary', () => ({
  useLibrary: () => ({ items: reactive([]), activeId: { value: null } }),
}))
vi.mock('../../composables/useFrameConfig', () => ({
  useFrameConfig: () => ({ state: reactive({ photoSrc: null }) }),
}))
vi.mock('../../composables/useHistory', () => ({
  applyTemplateToPhotos: vi.fn(async () => false),
}))
vi.mock('../../core/templateThumb', () => ({
  templateThumbDataUrl: () => 'data:image/svg+xml;utf8,%3Csvg%3E%3C/svg%3E',
  renderTemplateThumbDataUrl: vi.fn(async () => 'data:image/jpeg;base64,REAL'),
}))

import TemplatePickerModal from './TemplatePickerModal.vue'

// 旧 lib（< es2022）不支持 Array.prototype.at，取 emitted 末位用索引替代，语义一致
const lastEmit = (arr: unknown[][] | undefined) => arr?.[(arr?.length ?? 0) - 1]

// STU 在非 attach 情况下 wrapper.find 无法定位 Teleport 到 body 的内容；
// 这里 stub Teleport 让浮层内容内联渲染进组件子树，find 才能命中（断言不变）。
const mountModal = (modelValue = true) =>
  mount(TemplatePickerModal, { props: { modelValue }, global: { stubs: { teleport: true } } })

describe('TemplatePickerModal 骨架', () => {
  it('modelValue=false 时不渲染，true 时渲染标题与关闭按钮', async () => {
    const closed = mountModal(false)
    expect(closed.find('.tp-modal').exists()).toBe(false)

    const w = mountModal(true)
    expect(w.find('.tp-modal').exists()).toBe(true)
    expect(w.find('.tp-head .tp-title').text()).toContain('相框模板库')
    expect(w.find('.tp-close').exists()).toBe(true)
  })

  it('空模板库显示提示文案', async () => {
    const w = mountModal(true)
    await nextTick()
    expect(w.find('.tp-empty').exists()).toBe(true)
    expect(w.find('.tp-empty').text()).toContain('暂无模板')
  })

  it('启动为空模板库时不选中任何模板，右栏显示占位', async () => {
    const w = mountModal(true)
    await nextTick()
    expect(w.find('.tp-preview-empty').exists()).toBe(true)
  })

  it('点击 × 与底部「完成」均触发 update:modelValue=false', async () => {
    const w = mountModal(true)
    await w.find('.tp-close').trigger('click')
    expect(lastEmit(w.emitted('update:modelValue'))).toEqual([false])
    w.setProps({ modelValue: true })
    await w.find('.tp-done').trigger('click')
    expect(lastEmit(w.emitted('update:modelValue'))).toEqual([false])
  })

  it('按 Esc 触发关闭（清空监听避免影响后续用例）', async () => {
    const w = mountModal(true)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(lastEmit(w.emitted('update:modelValue'))).toEqual([false])
    w.unmount()
  })
})