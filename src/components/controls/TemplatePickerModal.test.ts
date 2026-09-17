// src/components/controls/TemplatePickerModal.test.ts
// 模板中心 2.0（侧栏 + 3 列瀑布流 + 底部操作栏，无右栏预览）：
// 骨架/关闭/空态、分区渲染、缩略图合成、点卡预览 → 确认应用（或退回继续选择）、最近使用、
// 侧栏分类过滤、搜索、自定义模板删除。
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

// jsdom 未实现元素的 scrollTo（真实浏览器均有）：补一个最小实现，让「点目录 → 跳段」可断言
if (typeof Element.prototype.scrollTo !== 'function') {
  Element.prototype.scrollTo = function (this: HTMLElement, options?: ScrollToOptions | number) {
    this.scrollTop = typeof options === 'object' && options ? (options.top ?? 0) : Number(options ?? 0)
  } as typeof Element.prototype.scrollTo
}

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
  it('列表恒为完整分段（最近使用 → 风格分组 → 我的模板），卡片走 masonry 容器', async () => {
    const w = mountModal(true)
    const titles = w.findAll('.tp-sec-title').map((g) => g.text())
    expect(titles).toEqual(['最近使用', '经典', '我的模板'])
    expect(w.findAll('.tp-card').length).toBe(3)
    expect(w.find('.tp-masonry').exists()).toBe(true)
    w.unmount()
  })

  it('侧栏目录：最近使用 / 我的模板 + 风格分组（带计数），不再有「全部」项', async () => {
    const w = mountModal(true)
    const items = w.findAll('.tp-item').map((i) => i.text())
    expect(items[0]).toContain('最近使用')
    expect(items[1]).toContain('我的模板')
    expect(items.join(' ')).toContain('经典')
    expect(items.join(' ')).toContain('创意排版')
    expect(items.join(' ')).not.toContain('全部')
    // 计数：经典 = 2 套内置
    expect(items[2]).toContain('2')
    w.unmount()
  })

  it('点击侧栏分组 = 跳到该段（不筛选）：列表分段不变，滚过去后还能继续下滚', async () => {
    const w = mountModal(true)
    const before = w.findAll('.tp-sec-title').map((g) => g.text())
    // jsdom 下重渲染会替换元素，故每次都重新查询侧栏项；跳转调用也按当前元素记录
    const item = (label: string) => w.findAll('.tp-item').find((i) => i.text().includes(label))!
    const armJumpSpy = () => {
      const spy = vi.fn()
      ;(w.find('.tp-main').element as HTMLElement).scrollTo = spy as unknown as HTMLElement['scrollTo']
      return spy
    }

    const classicJump = armJumpSpy()
    await item('经典').trigger('click')
    // 段结构与卡片数都不变——没有退化成「单分类列表」
    expect(w.findAll('.tp-sec-title').map((g) => g.text())).toEqual(before)
    expect(w.findAll('.tp-card').length).toBe(3)
    expect(classicJump).toHaveBeenCalledTimes(1)
    expect(item('经典').classes()).toContain('active')
    expect(item('最近使用').classes()).not.toContain('active')

    const customJump = armJumpSpy()
    await item('我的模板').trigger('click')
    expect(customJump).toHaveBeenCalledTimes(1)
    expect(item('我的模板').classes()).toContain('active')
    w.unmount()
  })

  it('「最近使用」段在列表首位且按最近使用顺序排列', async () => {
    mock.recentIds.push('b1', 'b2') // recentIds[0] 为最近一次使用
    const w = mountModal(true)
    await flushPromises()
    const titles = w.findAll('.tp-sec-title').map((g) => g.text())
    expect(titles[0]).toBe('最近使用')
    expect(titles[titles.length - 1]).toBe('我的模板')
    const recentAlts = w.findAll('.tp-sec')[0].findAll('.tp-card img').map((i) => i.attributes('alt'))
    expect(recentAlts).toEqual(['白框参数卡', '圆角悬浮·模糊延展'])
    w.unmount()
  })

  it('搜索框按名称过滤卡片', async () => {
    const w = mountModal(true)
    await w.find('.tp-search').setValue('圆角悬浮')
    const cards = w.findAll('.tp-card')
    expect(cards.length).toBe(1)
    expect(cards[0].find('img').attributes('alt')).toContain('圆角悬浮·模糊延展')
    w.unmount()
  })
})

describe('滚动行为（2026-09-16：目录跳段 + 滚轮转发）', () => {
  // jsdom 无布局，且列表重建时 .tp-main 会被替换（真实浏览器里是同一个元素、保留 scrollTop），
  // 故这里每次重新查询元素，只断言「可观察契约」。
  const mainTop = (w: ReturnType<typeof mountModal>) => (w.find('.tp-main').element as HTMLElement).scrollTop

  it('搜索词变化时列表回到顶部（结果集变了，位置不再有效）', async () => {
    const w = mountModal(true)
    ;(w.find('.tp-main').element as HTMLElement).scrollTop = 500
    await w.find('.tp-search').setValue('圆角')
    await nextTick()
    expect(mainTop(w)).toBe(0)
    w.unmount()
  })

  it('指针停在左侧分类栏时滚轮转发给右侧瀑布流（侧栏自身不可滚动）', async () => {
    const w = mountModal(true)
    await flushPromises() // 缩略图异步合成完成，避免元素重建把写入冲掉
    // jsdom 下侧栏 scrollHeight/clientHeight 均为 0 → 视作不可滚动，应直接转发增量
    await w.find('.tp-side').trigger('wheel', { deltaY: 120, deltaMode: 0 })
    expect(mainTop(w)).toBe(120)
    w.unmount()
  })

  it('侧栏自身在该方向还能滚时不抢滚动（增量留给侧栏）', async () => {
    const w = mountModal(true)
    await flushPromises()
    const side = w.find('.tp-side').element as HTMLElement
    Object.defineProperty(side, 'scrollHeight', { value: 900, configurable: true })
    Object.defineProperty(side, 'clientHeight', { value: 400, configurable: true })
    side.scrollTop = 100
    await w.find('.tp-side').trigger('wheel', { deltaY: 120, deltaMode: 0 })
    expect(mainTop(w)).toBe(0)
    expect(side.scrollTop).toBe(100)
    w.unmount()
  })

  it('侧栏滚到边界时只吃掉余量、其余接力给瀑布流（不留白吞一格滚轮）', async () => {
    const w = mountModal(true)
    await flushPromises()
    const side = w.find('.tp-side').element as HTMLElement
    Object.defineProperty(side, 'scrollHeight', { value: 900, configurable: true })
    Object.defineProperty(side, 'clientHeight', { value: 400, configurable: true })
    side.scrollTop = 450 // 距底部仅剩 50
    await w.find('.tp-side').trigger('wheel', { deltaY: 200, deltaMode: 0 })
    expect(side.scrollTop).toBe(500)
    expect(mainTop(w)).toBe(150)
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

describe('点卡预览 → 确认应用（2026-09-15 交互）', () => {
  it('点击卡片：打开预览层（用用户照片合成大图），不应用、不关闭弹窗', async () => {
    const w = mountModal(true)
    await w.findAll('.tp-card')[1].trigger('click')
    await flushPromises()
    expect(w.find('.tp-pv').exists()).toBe(true)
    expect(w.find('.tp-pv-title').text()).toContain('圆角悬浮·模糊延展')
    expect(w.find('.tp-pv-img').exists()).toBe(true)
    // 模板信息集中在预览弹窗里（名称 + 说明），卡片上不再有 hover 浮层
    expect(w.find('.tp-pv-name').text()).toContain('圆角悬浮·模糊延展')
    expect(w.find('.tp-pv-desc').text()).toContain('圆角悬浮照片')
    // 预览走 1600 上限（大图），区别于网格缩略图的 640
    expect(mock.renderThumb.mock.calls.some((c) => c[1] === 'blob:photo-1' && c[2] === 1600)).toBe(true)
    expect(mock.applyMock).not.toHaveBeenCalled()
    expect(w.emitted('update:modelValue')).toBeUndefined()
    w.unmount()
  })

  it('预览层「退回继续选择」：回到模板列表且未应用', async () => {
    const w = mountModal(true)
    await w.findAll('.tp-card')[0].trigger('click')
    await flushPromises()
    await w.find('.tp-pv-cancel').trigger('click')
    expect(w.find('.tp-pv').exists()).toBe(false)
    expect(w.find('.tp-card').exists()).toBe(true)
    expect(mock.applyMock).not.toHaveBeenCalled()
    expect(w.emitted('update:modelValue')).toBeUndefined()
    w.unmount()
  })

  it('预览层「确认应用」：应用模板 + 记录最近使用 + 展开右栏 + 关闭弹窗返回编辑', async () => {
    const w = mountModal(true)
    await w.findAll('.tp-card')[1].trigger('click')
    await flushPromises()
    await w.find('.tp-pv-ok').trigger('click')
    expect(mock.applyMock).toHaveBeenCalledWith({ bgMode: 'blur' })
    expect(mock.setPanelMock).toHaveBeenCalledWith('right', 'background', true)
    expect(mock.setPanelMock).toHaveBeenCalledWith('right', 'border', true)
    expect(mock.recordMock).toHaveBeenCalledWith('b2')
    expect(lastEmit(w.emitted('update:modelValue'))).toEqual([false])
    w.unmount()
  })

  it('预览态 Esc 退回列表（不关弹窗）、Enter 直接确认应用；列表态 Esc 关弹窗', async () => {
    const w = mountModal(true)
    await w.findAll('.tp-card')[0].trigger('click')
    await flushPromises()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    await nextTick()
    expect(w.find('.tp-pv').exists()).toBe(false)
    expect(w.emitted('update:modelValue')).toBeUndefined()

    await w.findAll('.tp-card')[0].trigger('click')
    await flushPromises()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    await nextTick()
    expect(mock.applyMock).toHaveBeenCalledWith({ bgMode: 'solid', bgColor: '#ffffff' })
    expect(lastEmit(w.emitted('update:modelValue'))).toEqual([false])
    w.unmount()
  })

  it('底栏为固定提示；卡片无 hover 信息浮层（模板信息只在预览弹窗里呈现）', async () => {
    const w = mountModal(true)
    expect(w.find('.tp-hint').text()).toContain('点击卡片预览效果')
    expect(w.find('.tp-card-ov').exists()).toBe(false)
    await w.findAll('.tp-card')[0].trigger('mouseenter')
    expect(w.find('.tp-hint').text()).toContain('点击卡片预览效果')
    w.unmount()
  })

  it('确认应用后重新打开弹窗：该卡片带「当前」标签与选中描边', async () => {
    const w = mountModal(true)
    await w.findAll('.tp-card')[0].trigger('click')
    await flushPromises()
    await w.find('.tp-pv-ok').trigger('click')
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

  it('「我的模板」段恒有导入/导出按钮；无自定义模板时给引导文案且「导出全部」禁用', async () => {
    const w = mountModal(true)
    const btns = w.findAll('.tp-sec-btn')
    expect(btns.map((b) => b.text())).toEqual(['导入', '导出全部'])
    expect(btns[1].attributes('disabled')).toBeUndefined() // 有 1 套自定义 → 可导出
    w.unmount()

    // mock 数组非响应式（真实 app 中 templates 为 reactive），重新挂载验证空自定义分支
    seed([...BUILTIN])
    const w2 = mountModal(true)
    const btns2 = w2.findAll('.tp-sec-btn')
    expect(btns2.map((b) => b.text())).toEqual(['导入', '导出全部'])
    expect(btns2[1].attributes('disabled')).toBeDefined()
    // 空段（最近使用 / 我的模板）各自的引导文案
    const hints = w2.findAll('.tp-sec-empty').map((p) => p.text())
    expect(hints.join(' ')).toContain('还没有最近使用的模板')
    expect(hints.join(' ')).toContain('还没有自定义模板')
    w2.unmount()
  })
})
