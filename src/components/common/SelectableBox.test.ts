import { describe, it, expect, beforeAll } from 'vitest'
import { mount } from '@vue/test-utils'
import SelectableBox from './SelectableBox.vue'
import type { Rect } from '../../core/rectMath'

// jsdom 不实现 PointerEvent / setPointerCapture，补齐最小实现以便驱动拖拽
beforeAll(() => {
  if (typeof (globalThis as any).PointerEvent === 'undefined') {
    class PE extends MouseEvent {
      pointerId: number
      constructor(type: string, params: any = {}) {
        super(type, params)
        this.pointerId = params.pointerId ?? 1
      }
    }
    ;(globalThis as any).PointerEvent = PE
  }
  if (!HTMLElement.prototype.setPointerCapture) {
    HTMLElement.prototype.setPointerCapture = function () {}
    HTMLElement.prototype.releasePointerCapture = function () {}
  }
})

function fireSeq(
  wrapper: any,
  selector: string,
  down: { x: number; y: number },
  moves: Array<{ x: number; y: number }>,
) {
  const el = wrapper.find(selector).element as HTMLElement
  const opt = (x: number, y: number) => ({
    clientX: x,
    clientY: y,
    pointerId: 1,
    bubbles: true,
  })
  el.dispatchEvent(new (globalThis as any).PointerEvent('pointerdown', opt(down.x, down.y)))
  for (const m of moves) {
    el.dispatchEvent(new (globalThis as any).PointerEvent('pointermove', opt(m.x, m.y)))
  }
  el.dispatchEvent(new (globalThis as any).PointerEvent('pointerup', opt(down.x, down.y)))
}

const start: Rect = { left: 100, top: 100, width: 400, height: 300 }

describe('SelectableBox - 交互集成', () => {
  it('点击主体：触发 select 且以 move 模式平移', async () => {
    const wrapper = mount(SelectableBox, {
      props: { rect: { ...start }, scale: 1, selected: false },
    })
    // 先选中（点击主体）
    fireSeq(wrapper, '.selectable', { x: 300, y: 250 }, [{ x: 350, y: 270 }])
    expect(wrapper.emitted('select')).toBeTruthy()

    // 选中后再拖拽主体：client 位移 (50,20) / scale 1 → 设计位移相同
    const before = wrapper.emitted('update:rect')!.length
    fireSeq(wrapper, '.selectable', { x: 300, y: 250 }, [{ x: 350, y: 270 }])
    const rects = wrapper.emitted('update:rect') as Rect[][]
    const last = rects[rects.length - 1][0]
    expect(last.left).toBe(150)
    expect(last.top).toBe(120)
    expect(last.width).toBe(400)
    expect(last.height).toBe(300)
    expect(wrapper.emitted('update:rect')!.length).toBeGreaterThan(before)
  })

  it('拖拽 se 角点：等比缩放（lockAspect），右下锚点不动', async () => {
    const wrapper = mount(SelectableBox, {
      props: { rect: { ...start }, scale: 1, selected: true, lockAspect: true },
    })
    // se 角点位于 left+width, top+height = (500,400)
    fireSeq(wrapper, '.h-se', { x: 500, y: 400 }, [{ x: 560, y: 445 }])
    const rects = wrapper.emitted('update:rect') as Rect[][]
    const last = rects[rects.length - 1][0]
    // 宽度 +60，高度按比例 0.75 → +45；左上锚点固定
    expect(last.width).toBeCloseTo(460, 3)
    expect(last.height).toBeCloseTo(345, 3)
    expect(last.left).toBe(100)
    expect(last.top).toBe(100)
  })

  it('拖拽 n 边（竖向边）：lockAspect 下仍然缩放（此前 bug：竖向边失效）', async () => {
    const wrapper = mount(SelectableBox, {
      props: { rect: { ...start }, scale: 1, selected: true, lockAspect: true },
    })
    // n 边中点位于 (300,100)
    fireSeq(wrapper, '.h-n', { x: 300, y: 100 }, [{ x: 300, y: 140 }])
    const rects = wrapper.emitted('update:rect') as Rect[][]
    const last = rects[rects.length - 1][0]
    // 高度 -40 → 260；宽度 = 260/0.75 ≈ 346.67；底边固定 400
    expect(last.height).toBeCloseTo(260, 3)
    expect(last.width).toBeCloseTo(260 / 0.75, 2)
    expect(last.top + last.height).toBeCloseTo(400, 3)
  })

  it('自由缩放（lockAspect=false）：e 边只改宽度', async () => {
    const wrapper = mount(SelectableBox, {
      props: { rect: { ...start }, scale: 1, selected: true, lockAspect: false },
    })
    fireSeq(wrapper, '.h-e', { x: 500, y: 250 }, [{ x: 540, y: 250 }])
    const rects = wrapper.emitted('update:rect') as Rect[][]
    const last = rects[rects.length - 1][0]
    expect(last.width).toBe(440)
    expect(last.height).toBe(300)
    expect(last.left).toBe(100)
  })
})
