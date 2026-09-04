// src/components/controls/TemplatePickerModal.test.ts
// Task 1（骨架：显隐/关闭/空库）+ Task 3（分组渲染/默认选中/大预览/批量/删除）
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'

type Tmpl = {
  id: string
  name: string
  category: string
  builtin?: boolean
  desc?: string
  config: Record<string, unknown>
}

// 用 vi.hoisted 在 mock 工厂/被测模块运行前完成状态初始化（否则 import 提升会导致
// 工厂运行时其引用的数组/函数尚未初始化）。这里仅用普通数组与 vi.fn，所有断言都发生
// 在 mount 读取数据之后、且不依赖 mount 后对模板数组的响应式变更，故无需 reactive。
const mock = vi.hoisted(() => {
  const mockTemplates: Tmpl[] = []
  const removeMock = vi.fn((id: string) => {
    const i = mockTemplates.findIndex((t) => t.id === id)
    if (i >= 0) mockTemplates.splice(i, 1)
  })
  const applyMock = vi.fn(() => [])
  const applyBatchMock = vi.fn(async () => false)
  const renderThumb = vi.fn(async (_config?: unknown, _photoSrc?: unknown, _maxLongEdge?: number) => 'data:image/jpeg;base64,BIG')
  const setPanelMock = vi.fn()
  const mockItems: Array<{ id: string; selected: boolean }> = [
    { id: 'p1', selected: true },
    { id: 'p2', selected: false },
  ]
  return { mockTemplates, removeMock, applyMock, applyBatchMock, renderThumb, setPanelMock, mockItems }
})

// ---- composables mock（带数据，可被 beforeEach 重置，且测试间互不污染） ----
vi.mock('../../composables/useTemplates', () => ({
  useTemplates: () => ({ templates: mock.mockTemplates, remove: mock.removeMock }),
  applyTemplateToState: mock.applyMock,
}))
vi.mock('../../composables/useAppState', () => ({
  useAppState: () => ({ state: { rightOpen: false }, setPanel: mock.setPanelMock }),
}))
vi.mock('../../composables/useLibrary', () => ({
  useLibrary: () => ({ items: mock.mockItems, activeId: { value: null } }),
}))
vi.mock('../../composables/useFrameConfig', () => ({
  useFrameConfig: () => ({ state: { photoSrc: 'blob:photo-1' } }),
}))
vi.mock('../../composables/useHistory', () => ({
  applyTemplateToPhotos: mock.applyBatchMock,
}))
vi.mock('../../core/templateThumb', () => ({
  templateThumbDataUrl: () => 'data:image/svg+xml;utf8,%3Csvg%3E%3C/svg%3E',
  renderTemplateThumbDataUrl: mock.renderThumb,
}))

import TemplatePickerModal from './TemplatePickerModal.vue'

const BUILTIN: Tmpl[] = [
  { id: 'b1', name: '白框参数卡', category: 'frame', builtin: true, desc: '经典白底等宽边框', config: { bgMode: 'solid', bgColor: '#ffffff' } },
  { id: 'b2', name: '圆角悬浮·模糊延展', category: 'frame', builtin: true, desc: '圆角悬浮照片', config: { bgMode: 'blur' } },
]
const CUSTOM: Tmpl[] = [
  { id: 'c1', name: '我的预设', category: 'all', desc: undefined, config: { bgMode: 'photo' } },
]

const seed = (items: Tmpl[]) => {
  mock.mockTemplates.splice(0, mock.mockTemplates.length, ...items)
}

// 每个用例：重置各 mock 调用记录，并回填默认数据集（内置 b1/b2 + 自定义 c1）。
// 空库相关用例可自行 seed([]) 覆盖。
beforeEach(() => {
  mock.applyMock.mockClear()
  mock.applyBatchMock.mockClear()
  mock.renderThumb.mockClear()
  mock.setPanelMock.mockClear()
  seed([...BUILTIN, ...CUSTOM])
})

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
    w.unmount()
  })

  it('空模板库显示提示文案', async () => {
    seed([])
    const w = mountModal(true)
    await nextTick()
    expect(w.find('.tp-empty').exists()).toBe(true)
    expect(w.find('.tp-empty').text()).toContain('暂无模板')
    w.unmount()
  })

  it('启动为空模板库时不选中任何模板，右栏显示占位', async () => {
    seed([])
    const w = mountModal(true)
    await nextTick()
    expect(w.find('.tp-preview-empty').exists()).toBe(true)
    w.unmount()
  })

  it('点击 × 与底部「完成」均触发 update:modelValue=false', async () => {
    const w = mountModal(true)
    await w.find('.tp-close').trigger('click')
    expect(lastEmit(w.emitted('update:modelValue'))).toEqual([false])
    await w.setProps({ modelValue: true })
    await w.find('.tp-done').trigger('click')
    expect(lastEmit(w.emitted('update:modelValue'))).toEqual([false])
    w.unmount()
  })

  it('按 Esc 触发关闭（清空监听避免影响后续用例）', async () => {
    const w = mountModal(true)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(lastEmit(w.emitted('update:modelValue'))).toEqual([false])
    w.unmount()
  })
})

describe('分组与渲染', () => {
  it('内置/我的模板分组展示，自定义分组仅在有数据时出现', async () => {
    const w = mountModal(true)
    const groups = w.findAll('.tp-group').map((g) => g.text())
    expect(groups.join(' ')).toContain('内置模板')
    expect(groups.join(' ')).toContain('我的模板')
    expect(w.findAll('.tp-card').length).toBe(3)
    w.unmount()
  })
})

describe('默认选中', () => {
  it('默认选中第一个内置模板，右栏显示其名称与 desc', async () => {
    const w = mountModal(true)
    await flushPromises()
    expect(w.find('.tp-preview-name').text()).toBe('白框参数卡')
    expect(w.find('.tp-preview-desc').text()).toBe('经典白底等宽边框')
    w.unmount()
  })

  it('首个内置模板卡片被标记为 active 高亮', async () => {
    const w = mountModal(true)
    await flushPromises()
    expect(w.findAll('.tp-card')[0].classes()).toContain('active')
    expect(w.find('.tp-card.active').text()).toContain('白框参数卡')
    w.unmount()
  })
})

describe('大预览合成', () => {
  it('大预览使用当前照片合成（renderTemplateThumbDataUrl 收到 photoSrc 与 960 上限），img 为真实合成 dataURL', async () => {
    const w = mountModal(true)
    await flushPromises()
    // 初始选中首个内置模板 b1；右栏大预览 watch 非 immediate，点击第二张卡片触发合成
    await w.findAll('.tp-card')[1].trigger('click')
    await flushPromises()
    const previewCalls = mock.renderThumb.mock.calls.filter((c) => c[1] === 'blob:photo-1')
    expect(previewCalls.length).toBeGreaterThan(0)
    expect(previewCalls[0][2]).toBe(960)
    expect(w.find('.tp-preview-img').attributes('src')).toBe('data:image/jpeg;base64,BIG')
    w.unmount()
  })
})

describe('点卡即应用', () => {
  it('点击卡片：应用模板 + 选中高亮 + 展开右栏，弹窗不关闭', async () => {
    const w = mountModal(true)
    const card = w.findAll('.tp-card')[1]
    await card.trigger('click')
    await flushPromises()
    expect(mock.applyMock).toHaveBeenCalledWith({ bgMode: 'blur' })
    expect(mock.setPanelMock).toHaveBeenCalledWith('right', 'background', true)
    expect(mock.setPanelMock).toHaveBeenCalledWith('right', 'border', true)
    expect(w.find('.tp-card.active').text()).toContain('圆角悬浮·模糊延展')
    expect(w.find('.tp-modal').exists()).toBe(true)
    w.unmount()
  })
})

describe('批量与删除', () => {
  it('右栏批量按钮按选中照片数显示目标（选中1张）', async () => {
    const w = mountModal(true)
    expect(w.find('.batch-main').text()).toContain('1 张')
    w.unmount()
  })

  it('点击批量按钮：applyTemplateToPhotos 收到选中照片 ids 与模板名', async () => {
    const w = mountModal(true)
    await w.find('.batch-main').trigger('click')
    await flushPromises()
    expect(mock.applyBatchMock).toHaveBeenCalledWith(['p1'], expect.anything(), '应用模板「白框参数卡」')
    w.unmount()
  })

  it('自定义模板悬停区删除：调用 remove 并移除该模板', async () => {
    const w = mountModal(true)
    const customCard = w.findAll('.tp-card')[2]
    await customCard.find('.tp-card-del').trigger('click')
    expect(mock.removeMock).toHaveBeenCalledWith('c1')
    w.unmount()
  })
})