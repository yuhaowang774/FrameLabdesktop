// 顶层 INFO 多元素层：交互状态与操作（增删改、选中/多选、对齐分布、吸附、层级）
// ----------------------------------------------------------------------------
// 职责：
//   - 维护选中集合（支持 Shift 多选）
//   - 元素的增 / 删 / 改（统一经由 useFrameConfig.patch 以进入撤销栈）
//   - 多选对齐 / 分布工具
//   - 智能吸附（拖动时对齐画布中心 / 照片中心 / 其它元素边缘）
//   - 层级 z-index 调整
import { ref, computed } from 'vue'
import { useFrameConfig } from './useFrameConfig'
import type { InfoElement, InfoElementType, TextInfoElement, ExifInfoElement, LogoInfoElement, DividerInfoElement } from '../core/types'

let counter = 0
function uid(): string {
  counter += 1
  return `info_${Date.now().toString(36)}_${counter}`
}

function makeElement(type: InfoElementType, defaults: Partial<InfoElement> = {}): InfoElement {
  const base = {
    id: uid(),
    type,
    enable: true,
    x: 0,
    y: 0,
    scale: 1,
    rotate: 0,
    zIndex: 0,
    exportable: true,
    opacity: 1,
  }
  switch (type) {
    case 'text':
      return { ...base, ...defaults, type: 'text', text: '自定义文字', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', fontSize: 28, fontWeight: 500, color: '#ffffff', align: 'center', letterSpacing: 0, lineHeight: 1.3 } as TextInfoElement
    case 'exif':
      return { ...base, ...defaults, type: 'exif', template: '{model}  {focal}  {aperture}  {shutter}  {iso}', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', fontSize: 22, fontWeight: 500, color: '#ffffff', align: 'center', letterSpacing: 1, lineHeight: 1.3 } as ExifInfoElement
    case 'logo':
      return { ...base, ...defaults, type: 'logo', logoId: 'none', baseWidth: 140 } as LogoInfoElement
    case 'divider':
      return { ...base, ...defaults, type: 'divider', width: 200, thickness: 2, color: '#ffffff' } as DividerInfoElement
  }
}

// 全局选中集合（元素 id）
const selectedIds = ref<Set<string>>(new Set())
// 智能吸附开关
const snapEnabled = ref(true)

export function useInfoLayer() {
  const { state, patch } = useFrameConfig()
  const layer = computed(() => state.infoLayer)

  const elements = computed(() => layer.value.elements)
  const selected = computed(() => elements.value.filter((e) => selectedIds.value.has(e.id)))
  const selectedCount = computed(() => selected.value.length)
  const lastSelected = computed<InfoElement | null>(() => {
    if (selected.value.length === 0) return null
    return selected.value[selected.value.length - 1]
  })

  function commit(next: InfoElement[]) {
    patch({ infoLayer: { ...layer.value, elements: next } })
  }

  // ===== 选中 =====
  function select(id: string, additive = false) {
    if (!additive) selectedIds.value = new Set([id])
    else {
      const s = new Set(selectedIds.value)
      if (s.has(id)) s.delete(id)
      else s.add(id)
      selectedIds.value = s
    }
  }
  function selectOnly(id: string) {
    selectedIds.value = new Set([id])
  }
  function clearSelection() {
    selectedIds.value = new Set()
  }
  function selectAll() {
    selectedIds.value = new Set(elements.value.map((e) => e.id))
  }

  // ===== 增 / 删 =====
  function addElement(type: InfoElementType, defaults: Partial<InfoElement> = {}) {
    const maxZ = elements.value.reduce((m, e) => Math.max(m, e.zIndex), 0)
    const el = makeElement(type, { zIndex: maxZ + 1, ...defaults })
    commit([...elements.value, el])
    selectOnly(el.id)
    return el
  }
  function deleteElements(ids: string[] = [...selectedIds.value]) {
    const set = new Set(ids)
    commit(elements.value.filter((e) => !set.has(e.id)))
    ids.forEach((id) => selectedIds.value.delete(id))
  }
  function deleteElement(id: string) {
    deleteElements([id])
  }

  // ===== 改（单个字段） =====
  function updateElement(id: string, patchFields: Partial<InfoElement>, _historyLabel?: string) {
    commit(
      elements.value.map((e) => (e.id === id ? ({ ...e, ...patchFields } as InfoElement) : e)),
    )
  }
  function updateSelected(patchFields: Partial<InfoElement>) {
    const set = selectedIds.value
    commit(
      elements.value.map((e) => (set.has(e.id) ? ({ ...e, ...patchFields } as InfoElement) : e)),
    )
  }

  // ===== 层级 =====
  function bringToFront(ids: string[] = [...selectedIds.value]) {
    const set = new Set(ids)
    const maxZ = elements.value.reduce((m, e) => Math.max(m, e.zIndex), 0)
    let z = maxZ
    commit(
      elements.value.map((e) => (set.has(e.id) ? ({ ...e, zIndex: (z += 1) } as InfoElement) : e)),
    )
  }
  function sendToBack(ids: string[] = [...selectedIds.value]) {
    const set = new Set(ids)
    const minZ = elements.value.reduce((m, e) => Math.min(m, e.zIndex), 0)
    let z = minZ
    commit(
      elements.value.map((e) => (set.has(e.id) ? ({ ...e, zIndex: (z -= 1) } as InfoElement) : e)),
    )
  }

  // ===== 对齐（多选工具栏） =====
  type AlignMode = 'left' | 'hcenter' | 'right' | 'top' | 'vcenter' | 'bottom'
  function align(mode: AlignMode, anchorRect?: { left: number; right: number; top: number; bottom: number }) {
    const sel = selected.value
    if (sel.length < 2 && !anchorRect) return
    // 计算选中集合的包围盒
    const box = boundsOf(sel)
    const set = new Set(sel.map((e) => e.id))
    commit(
      elements.value.map((e) => {
        if (!set.has(e.id)) return e
        let { x, y } = e
        // 以选中组包围盒为基准对齐
        const eBox = elemBounds(e)
        switch (mode) {
          case 'left':
            x += box.left - eBox.left
            break
          case 'right':
            x += box.right - eBox.right
            break
          case 'hcenter':
            x += (box.left + box.right) / 2 - (eBox.left + eBox.right) / 2
            break
          case 'top':
            y += box.top - eBox.top
            break
          case 'bottom':
            y += box.bottom - eBox.bottom
            break
          case 'vcenter':
            y += (box.top + box.bottom) / 2 - (eBox.top + eBox.bottom) / 2
            break
        }
        return { ...e, x, y } as InfoElement
      }),
    )
  }

  // ===== 分布（等间距） =====
  type DistributeMode = 'h' | 'v'
  function distribute(mode: DistributeMode) {
    const sel = [...selected.value].sort((a, b) =>
      mode === 'h' ? a.x - b.x : a.y - b.y,
    )
    if (sel.length < 3) return
    const set = new Set(sel.map((e) => e.id))
    // 按首尾元素均匀分布
    const first = elemBounds(sel[0])
    const last = elemBounds(sel[sel.length - 1])
    const f = mode === 'h' ? (first.left + first.right) / 2 : (first.top + first.bottom) / 2
    const l = mode === 'h' ? (last.left + last.right) / 2 : (last.top + last.bottom) / 2
    const step = (l - f) / (sel.length - 1)
    const next = elements.value.map((e) => {
      if (!set.has(e.id)) return e
      const idx = sel.findIndex((s) => s.id === e.id)
      const target = f + step * idx
      const eb = elemBounds(e)
      const cur = mode === 'h' ? (eb.left + eb.right) / 2 : (eb.top + eb.bottom) / 2
      const delta = target - cur
      return (mode === 'h' ? { ...e, x: e.x + delta } : { ...e, y: e.y + delta }) as InfoElement
    })
    commit(next)
  }

  // ===== 智能吸附（拖动时） =====
  // 返回吸附后的坐标偏移（设计 px）。参考线：画布中心十字、照片中心十字、其它元素边缘/中心。
  function snap(draftX: number, draftY: number, self?: InfoElement): { x: number; y: number; guides: { x?: number; y?: number } } {
    if (!snapEnabled.value) return { x: draftX, y: draftY, guides: {} }
    const SNAP = 8 // 设计 px 阈值
    const canvasCx = 600 // DESIGN_CONTAINER.w/2
    const canvasCy = 600 // 近似画布中心 y（实际由 photoRect 提供时更准）
    const targetsX = [canvasCx]
    const targetsY = [canvasCy]
    // 其它元素中心
    for (const e of elements.value) {
      if (self && e.id === self.id) continue
      const b = elemBounds(e)
      targetsX.push((b.left + b.right) / 2, b.left, b.right)
      targetsY.push((b.top + b.bottom) / 2, b.top, b.bottom)
    }
    let x = draftX
    let y = draftY
    let guideX: number | undefined
    let guideY: number | undefined
    for (const t of targetsX) {
      if (Math.abs(draftX - t) <= SNAP) {
        x = t
        guideX = t
        break
      }
    }
    for (const t of targetsY) {
      if (Math.abs(draftY - t) <= SNAP) {
        y = t
        guideY = t
        break
      }
    }
    return { x, y, guides: { x: guideX, y: guideY } }
  }

  return {
    // 状态
    state,
    layer,
    elements,
    selected,
    selectedIds,
    selectedCount,
    lastSelected,
    snapEnabled,
    // 选中
    select,
    selectOnly,
    selectAll,
    clearSelection,
    // 增删
    addElement,
    deleteElement,
    deleteElements,
    // 改
    updateElement,
    updateSelected,
    // 层级
    bringToFront,
    sendToBack,
    // 排版
    align,
    distribute,
    snap,
    // 工具
    typeLabel,
    setBindTarget: (t: 'photo' | 'canvas') =>
      patch({ infoLayer: { ...layer.value, bindTarget: t } }),
    setEnabled: (v: boolean) =>
      patch({ infoLayer: { ...layer.value, enabled: v } }),
  }
}

function typeLabel(t: InfoElementType): string {
  return { text: '文字', exif: 'EXIF', logo: 'Logo', divider: '分割线' }[t]
}

// 元素包围盒（在 bindTarget 坐标系下的局部包围盒，x/y 相对绑定原点）
// 由于预览用 DOMMatrix 计算真实像素，这里给出局部估算用于对齐/分布逻辑。
function elemBounds(e: InfoElement): { left: number; right: number; top: number; bottom: number } {
  let w = 100
  let h = 30
  if (e.type === 'text') w = Math.max(e.text.length * e.fontSize * 0.6, 20)
  else if (e.type === 'exif') w = Math.max(e.template.length * e.fontSize * 0.6, 20)
  else if (e.type === 'logo') h = e.baseWidth * 0.4
  else if (e.type === 'divider') {
    w = e.width
    h = e.thickness
  }
  const sw = w * e.scale
  const sh = h * e.scale
  return { left: e.x - sw / 2, right: e.x + sw / 2, top: e.y - sh / 2, bottom: e.y + sh / 2 }
}

function boundsOf(list: InfoElement[]) {
  let left = Infinity
  let right = -Infinity
  let top = Infinity
  let bottom = -Infinity
  for (const e of list) {
    const b = elemBounds(e)
    left = Math.min(left, b.left)
    right = Math.max(right, b.right)
    top = Math.min(top, b.top)
    bottom = Math.max(bottom, b.bottom)
  }
  return { left, right, top, bottom }
}
