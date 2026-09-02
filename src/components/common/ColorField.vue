<script setup lang="ts">
// 统一颜色选择控件：
//   [色块] 显示当前生效颜色（点击直接打开取色器） + [下拉] 快捷项（自动/白/黑/自定义…/额外预设）。
// 「自动」的值由调用方定义：autoValue=null（文本样式组写 null）或 'auto'（Logo 颜色写字符串）；
// auto=false 时隐藏自动项（边框/背景等总是具体色的场景）。
// 所有取色入口共用本组件，保证交互与外观一致。
import { computed, ref } from 'vue'

const props = withDefaults(
  defineProps<{
    /** 当前值；等于 autoValue 时视为「自动」 */
    modelValue: string | null
    /** 「自动」对应的值；null 表示写回 null */
    autoValue?: string | null
    /** 是否提供「自动（随底色）」项 */
    auto?: boolean
    autoLabel?: string
    /** 自动状态下色块显示的参考色（自适应黑白），让色块始终可见 */
    autoSwatch?: string
    /** 额外预设项；picker 存在时选中该项直接打开取色器（初值=picker），确认后经 update:modelValue + extra-pick 返回 */
    extraOptions?: { value: string; label: string; picker?: string }[]
  }>(),
  {
    autoValue: null,
    auto: true,
    autoLabel: '自动（随底色）',
    autoSwatch: '',
    extraOptions: () => [],
  },
)

const emit = defineEmits<{
  (e: 'update:modelValue', v: string | null): void
  /** 从带 picker 的额外预设项取色确认（如「品牌主色」），供调用方记录预设定制值 */
  (e: 'extra-pick', v: string): void
}>()

const isAuto = computed(() => props.auto && props.modelValue === props.autoValue)
const KNOWN = ['#ffffff', '#000000']
const selectValue = computed(() => {
  if (isAuto.value) return 'auto'
  if (KNOWN.includes(props.modelValue ?? '')) return props.modelValue as string
  if (props.extraOptions.some((o) => o.value === props.modelValue)) return props.modelValue as string
  return 'custom'
})
// 色块显示：自动态用参考色（自适应黑白），否则当前值
const swatch = computed(() => (isAuto.value ? props.autoSwatch || '' : props.modelValue || ''))
const pickerColor = ref(props.modelValue && props.modelValue.startsWith('#') ? props.modelValue : '#888888')
const inputEl = ref<HTMLInputElement | null>(null)
// 取色来源：从带 picker 的额外预设项打开时记录该项，取色确认后额外发出 extra-pick
let pendingExtra: { value: string; label: string; picker?: string } | null = null

function openPicker() {
  pendingExtra = null
  pickerColor.value = props.modelValue && props.modelValue.startsWith('#') ? props.modelValue : '#888888'
  inputEl.value?.click()
}
function onPick(v: string) {
  pickerColor.value = v
  emit('update:modelValue', v)
  if (pendingExtra) {
    emit('extra-pick', v)
    pendingExtra = null
  }
}
function onSelect(v: string) {
  if (v === 'custom') {
    openPicker()
    return
  }
  if (v === 'auto') {
    emit('update:modelValue', props.autoValue ?? null)
    return
  }
  const opt = props.extraOptions.find((o) => o.value === v)
  if (opt?.picker !== undefined) {
    // 品牌主色类预设：直接打开取色器（初值 = 当前预设色），用户可即选即改
    pendingExtra = opt
    pickerColor.value = opt.picker
    inputEl.value?.click()
    return
  }
  emit('update:modelValue', v)
}
</script>

<template>
  <div class="color-field">
    <!-- 色块：常驻显示当前生效色，点击即取色（原生取色器经透明 input 覆盖触发） -->
    <label class="cf-swatch" :title="isAuto ? '点击自定义颜色' : '点击修改颜色'">
      <input
        ref="inputEl"
        type="color"
        :value="pickerColor"
        @input="onPick(($event.target as HTMLInputElement).value)"
      />
      <span class="cf-fill" :style="{ background: swatch }" />
    </label>
    <select
      class="cf-select"
      :value="selectValue"
      @change="onSelect(($event.target as HTMLSelectElement).value)"
    >
      <option v-if="auto" value="auto">{{ autoLabel }}</option>
      <option value="#ffffff">白色</option>
      <option value="#000000">黑色</option>
      <option v-for="o in extraOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
      <option value="custom">自定义…</option>
    </select>
  </div>
</template>

<style scoped>
.color-field {
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 1;
  min-width: 0;
}
/* 色块：26×24 方形（与项目细边框、直角风格一致），hover 高亮边框 */
.cf-swatch {
  position: relative;
  flex: none;
  width: 26px;
  height: 24px;
  border: 1px solid var(--border);
  cursor: pointer;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}
.cf-swatch:hover {
  border-color: var(--slider-thumb);
}
.cf-swatch input[type='color'] {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  cursor: pointer;
  padding: 0;
  border: none;
}
.cf-fill {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.cf-select {
  flex: 1;
  min-width: 0;
  height: 24px;
  padding: 0 8px;
  border: 1px solid var(--border);
  background: var(--panel-2);
  color: var(--text);
  font-size: 12px;
  font-weight: 400;
}
</style>
