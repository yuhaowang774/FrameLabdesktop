import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import Switch from './Switch.vue'

describe('Switch 胶囊滑块开关', () => {
  it('modelValue=false：off 态，点击 emit true', async () => {
    const w = mount(Switch, { props: { modelValue: false } })
    expect(w.find('.tik').classes()).not.toContain('on')
    await w.find('.tik').trigger('click')
    const ev = w.emitted('update:modelValue')!
    expect(ev[ev.length - 1]).toEqual([true])
  })

  it('modelValue=true：on 态，点击 emit false', async () => {
    const w = mount(Switch, { props: { modelValue: true } })
    expect(w.find('.tik').classes()).toContain('on')
    await w.find('.tik').trigger('click')
    const ev = w.emitted('update:modelValue')!
    expect(ev[ev.length - 1]).toEqual([false])
  })
})