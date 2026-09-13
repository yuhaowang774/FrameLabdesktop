// src/components/controls/TemplatePickerModal.test.ts
// 模板中心 2.0（侧栏 + 4 列瀑布流 + 底部操作栏，无右栏预览）：
// 骨架/关闭/空态、分区渲染、缩略图合成、点卡即应用、最近使用、侧栏分类过滤、
// 搜索、批量（底部按钮 + 卡片角标）、自定义模板删除。
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { nextTick } from 'vue'

type Tmpl = {
  id: string
  name: string
  category: string
  builtin?: boolean
  desc?: string
  group?: string
  config: Record<string, unknown>
}

// 用 vi.hoisted 在 mock 工厂/被测模块运行前完成状态初始化（否则 import 提升会导致
// 工厂运行时其引用的数组/函数尚未初始化）。这里仅用普通数组与 vi.fn，所有断言都发生
// 在 mount 读取数据之后、且不依赖 mount 后对模板数组的响应式变更，故无需 reactive。
const mock = vi.hoisted(() => {
  const mockTemplates: Tmpl[] = []
  const recentIds: string[] = []
  const recordMock = vi.fn((id: string) => {
    const i = recentIds.indexOf(id)
    if (i >= 0) recentIds.splice(i, 1)
    recentIds.unshift(id)
  })
  const removeMock = vi.fn((id: string) => {
    const i = mockTemplates.findIndex((t) => t.id === id)
    if (i >= 0) mockTemplates.splice(i, 1)
  })
  const renameMock = vi.fn(() => true)
  const importJsonMock = vi.fn(() => ({ ok: true, count: 1 }))
  const exportPackMock = vi.fn(() => '{"kind":"frame-template-pack"}')
  const applyMock = vi.fn(() => [])
  const renderThumb = vi.fn(async (_config?: unknown, _photoSrc?: unknown, _maxLongEdge?: number) => 'data:image/jpeg;base64,BIG')
  const setPanelMock = vi.fn()
  return { mockTemplates, recentIds, recordMock, removeMock, renameMock, importJsonMock, exportPackMock, applyMock, renderThumb, setPanelMock }
})

// ---- composables mock（带数据，可被 beforeEach 重置，且测试间互不污染） ----
vi.mock('../../composables/useTemplates', () => ({
  useTemplates: () => ({
    templates: mock.mockTemplates,
    recentIds: mock.recentIds,
    recordRecentUsage: mock.recordMock,
    remove: mock.removeMock,
    rename: mock.renameMock,
    importJson: mock.importJsonMock,
    exportPack: mock.exportPackMock,
  }),
  applyTemplateToState: mock.applyMock,
  recordRecentUsage: mock.recordMock,
}))
vi.mock('../../composables/useAppState', () => ({
  useAppState: () => ({ state: { rightOpen: false }, setPanel: mock.setPanelMock }),
}))
vi.mock('../../composables/useFrameConfig', () => ({
  useFrameConfig: () => ({ state: { photoSrc: 'blob:photo-1' } }),
}))
vi.mock('../../core/templateThumb', () => ({
  templateThumbDataUrl: () => 'data:image/svg+xml;utf8,%3Csvg%3E%3C/svg%3E',
  renderTemplateThumbDataUrl: mock.renderThumb,
}))

import TemplatePickerModal from './TemplatePickerModal.vue'

const BUILTIN: Tmpl[] = [
  { id: 'b1', name: '白框参数卡', category: 'frame', builtin: true, group: '经典', desc: '经典白底等宽边框', config: { bgMode: 'solid', bgColor: '#ffffff' } },
  { id: 'b2', name: '圆角悬浮·模糊延展', category: 'frame', builtin: true, group: '经典', desc: '圆角悬浮照片', config: { bgMode: 'blur' } },
]
const CUSTOM: Tmpl[] = [
  { id: 'c1', name: '我的预设', category: 'all', config: { bgMode: 'photo' } },
]

const seed = (items: Tmpl[]) => {
  mock.mockTemplates.splice(0, mock.mockTemplates.length, ...items)
}

// 每个用例：重置各 mock 调用记录，并回填默认数据集（内置 b1/b2 + 自定义 c1）。
// 空库相关用例可自行 seed([]) 覆盖。
beforeEach(() => {
  mock.applyMock.mockClear()
  mock.renderThumb.mockClear()
  mock.setPanelMock.mockClear()
  mock.recordMock.mockClear()
  mock.recentIds.length = 0
  seed([...BUILTIN, ...CUSTOM])
})

// 旧 lib（< es2022）不支持 Array.prototype.at，取 emitted 末位用索引替代，语义一致
const lastEmit = (arr: unknown[][] | undefined) => arr?.[(arr?.length ?? 0) - 1]

// STU 在非 attach 情况下 wrapper.find 无法定位 Teleport 到 body 的内容；
// 这里 stub Teleport 让浮层内容内联渲染进组件子树，find 才能命中（断言不变）。
const mountModal = (modelValue = true) =>
  mount(TemplatePickerModal, { props: { modelValue }, global: { stubs: { teleport: true } } })

describe('TemplatePickerModal 骨架', () => {
  it('modelValue=false 时不渲染，true 时渲染标题/搜索/返回箭头', async () => {
    const closed = mountModal(false)
    expect(closed.find('.tp-modal').exists()).toBe(false)

    const w = mountModal(true)
    expect(w.find('.tp-modal').exists()).toBe(true)
    expect(w.find('.tp-head .tp-title').text()).toContain('相框模板库')
    expect(w.find('.tp-search').exists()).toBe(true)
    // 关闭入口 = 左上角箭头（不用叉号），Esc 亦可
    expect(w.find('.tp-back').text()).toContain('←')
    expect(w.find('.tp-close').exists()).toBe(false)
    w.unmount()
  })

  it('空模板库显示提示文案（暂无模板）', async () => {
    seed([])
    const w = mountModal(true)
    await nextTick()
    expect(w.find('.tp-empty').exists()).toBe(true)
    expect(w.find('.tp-empty').text()).toContain('暂无模板')
    w.unmount()
  })

  it('搜索无匹配时显示「没有匹配的模板」', async () => {
    const w = mountModal(true)
    await w.find('.tp-search').setValue('不存在关键词')
    expect(w.find('.tp-empty').text()).toContain('没有匹配的模板')
    w.unmount()
  })

  it('点击左上角返回箭头触发 update:modelValue=false', async () => {
    const w = mountModal(true)
    await w.find('.tp-back').trigger('click')
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

describe('分区与渲染（瀑布流）', () => {
  it('全部视图 = 「全部模板」+「我的模板」两段，卡片走 masonry 容器', async () => {
    const w = mountModal(true)
    const titles = w.findAll('.tp-sec-title').map((g) => g.text())
    expect(titles).toEqual(['全部模板', '我的模板'])
    expect(w.findAll('.tp-card').length).toBe(3)
    expect(w.find('.tp-masonry').exists()).toBe(true)
    w.unmount()
  })

  it('侧栏渲染工作区（最近使用/我的模板）+ 风格分类（全部 + 九组，带计数）', async () => {
    const w = mountModal(true)
    const items = w.findAll('.tp-item').map((i) => i.text())
    expect(items[0]).toContain('最近使用')
    expect(items[1]).toContain('我的模板')
    expect(items.join(' ')).toContain('全部')
    expect(items.join(' ')).toContain('经典')
    expect(items.join(' ')).toContain('创意排版')
    // 计数：全部 = 2 套内置
    expect(items[2]).toContain('2')
    w.unmount()
  })

  it('点击侧栏分组只显示该组内置模板', async () => {
    const w = mountModal(true)
    const classic = w.findAll('.tp-item').find((i) => i.text().includes('经典'))
    await classic!.trigger('click')
    const titles = w.findAll('.tp-sec-title').map((g) => g.text())
    expect(titles).toEqual(['经典'])
    expect(w.findAll('.tp-card').length).toBe(2)
    w.unmount()
  })

  it('点击「我的模板」只显示自定义模板；「最近使用」按记录排序', async () => {
    const w = mountModal(true)
    await w.findAll('.tp-item').find((i) => i.text().includes('我的模板'))!.trigger('click')
    expect(w.findAll('.tp-card').length).toBe(1)
    expect(w.find('.tp-card').text()).toContain('我的预设')

    mock.recordMock('b2')
    await w.findAll('.tp-item').find((i) => i.text().includes('最近使用'))!.trigger('click')
    const cards = w.findAll('.tp-card')
    expect(cards.length).toBe(1)
    expect(cards[0].text()).toContain('圆角悬浮·模糊延展')
    w.unmount()
  })

  it('搜索框按名称过滤卡片', async () => {
    const w = mountModal(true)
    await w.find('.tp-search').setValue('圆角悬浮')
    expect(w.findAll('.tp-card').length).toBe(1)
    expect(w.findAll('.tp-card')[0].text()).toContain('圆角悬浮·模糊延展')
    w.unmount()
  })
})

describe('缩略图合成', () => {
  it('网格缩略图以当前选中照片为底图合成（renderThumb 收到 blob:photo-1 与 640 上限）', async () => {
    const w = mountModal(true)
    await flushPromises()
    const thumbCalls = mock.renderThumb.mock.calls.filter((c) => c[1] === 'blob:photo-1' && c[2] === 640)
    expect(thumbCalls.length).toBe(3) // 3 张模板卡各渲染一张
    w.unmount()
  })

  it('无右栏预览：不产生 960 尺寸的渲染调用', async () => {
    const w = mountModal(true)
    await flushPromises()
    expect(mock.renderThumb.mock.calls.filter((c) => c[2] === 960).length).toBe(0)
    expect(w.find('.tp-preview-img').exists()).toBe(false)
    w.unmount()
  })
})

describe('点卡即应用与最近使用', () => {
  it('点击卡片：应用模板 + 记录最近使用 + 展开右栏 + 直接关闭弹窗返回编辑', async () => {
    const w = mountModal(true)
    const card = w.findAll('.tp-card')[1]
    await card.trigger('click')
    await flushPromises()
    expect(mock.applyMock).toHaveBeenCalledWith({ bgMode: 'blur' })
    expect(mock.setPanelMock).toHaveBeenCalledWith('right', 'background', true)
    expect(mock.setPanelMock).toHaveBeenCalledWith('right', 'border', true)
    expect(mock.recordMock).toHaveBeenCalledWith('b2')
    // 用户流程：点击即应用并返回编辑界面（弹窗自动关闭）
    expect(lastEmit(w.emitted('update:modelValue'))).toEqual([false])
    w.unmount()
  })

  it('默认底部显示默认提示；hover 卡片时提示跟随（无需点击）', async () => {
    const w = mountModal(true)
    expect(w.find('.tp-hint').text()).toContain('点击卡片即应用模板并返回编辑界面')
    await w.findAll('.tp-card')[0].trigger('mouseenter')
    expect(w.find('.tp-hint').text()).toContain('白框参数卡')
    await w.findAll('.tp-card')[0].trigger('mouseleave')
    expect(w.find('.tp-hint').text()).toContain('点击卡片即应用模板并返回编辑界面')
    w.unmount()
  })

  it('应用后重新打开弹窗：该卡片带「当前」标签与选中描边', async () => {
    const w = mountModal(true)
    await w.findAll('.tp-card')[0].trigger('click')
    expect(lastEmit(w.emitted('update:modelValue'))).toEqual([false])
    // 重新打开（组件常驻，selectedId 保留）
    await w.setProps({ modelValue: true })
    await flushPromises()
    expect(w.find('.tp-card-tag').text()).toBe('当前')
    expect(w.findAll('.tp-card')[0].classes()).toContain('sel')
    w.unmount()
  })
})

describe('批量与删除', () => {
  it('弹窗内无任何批量入口：底栏无批量按钮，卡片无批量角标', async () => {
    const w = mountModal(true)
    expect(w.find('.tp-batch').exists()).toBe(false)
    expect(w.findAll('.tp-card-batch').length).toBe(0)
    w.unmount()
  })

  it('自定义模板悬停区删除：调用 remove 并移除该模板', async () => {
    const w = mountModal(true)
    const customCard = w.findAll('.tp-card')[2]
    await customCard.find('.tp-card-del').trigger('click')
    expect(mock.removeMock).toHaveBeenCalledWith('c1')
    w.unmount()
  })

  it('我的模板分区带导入/导出按钮，无自定义模板时该分区不渲染', async () => {
    const w = mountModal(true)
    const btns = w.findAll('.tp-sec-btn').map((b) => b.text())
    expect(btns).toEqual(['导入', '导出全部'])
    w.unmount()

    // mock 数组非响应式（真实 app 中 templates 为 reactive），重新挂载验证空自定义分支
    seed([...BUILTIN])
    const w2 = mountModal(true)
    expect(w2.findAll('.tp-sec-btn').length).toBe(0)
    w2.unmount()
  })
})
