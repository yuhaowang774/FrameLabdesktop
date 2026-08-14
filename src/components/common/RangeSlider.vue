<script setup lang="ts">
// 通用滑块：滑块 + 进度填充 + 数值显示
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: number
    min?: number
    max?: number
    step?: number
    label?: string
    suffix?: string
    disabled?: boolean
  }>(),
  { min: 0, max: 100, step: 1, suffix: '', disabled: false },
)

const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

const fillPercent = computed(() => {
  const p = ((props.modelValue - props.min) / (props.max - props.min)) * 100
  return Math.min(100, Math.max(0, p))
})

function onInput(e: Event) {
  const v = Number((e.target as HTMLInputElement).value)
  emit('update:modelValue', v)
}
</script>

<template>
  <div class="range-slider" :class="{ disabled }">
    <div class="row">
      <span class="label" v-if="label">{{ label }}</span>
      <span class="value">{{ modelValue }}{{ suffix }}</span>
    </div>
    <input
      type="range"
      :min="min"
      :max="max"
      :step="step"
      :value="modelValue"
      :disabled="disabled"
      :style="{ '--fill': fillPercent + '%' }"
      @input="onInput"
    />
  </div>
</template>

<style scoped>
.range-slider {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.range-slider.disabled {
  opacity: 0.4;
  pointer-events: none;
}
.row {
  display: flex;
  justify-content: space-between;
  font-size: 13px;
  color: #ccc;
}
.value {
  color: #fff;
  font-variant-numeric: tabular-nums;
}
input[type='range'] {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 6px;
  border-radius: 3px;
  background: linear-gradient(
    to right,
    rgba(120, 170, 255, 0.9) var(--fill),
    rgba(255, 255, 255, 0.15) var(--fill)
  );
  outline: none;
  cursor: pointer;
}
input[type='range']::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.4);
}
input[type='range']::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border: none;
  border-radius: 50%;
  background: #fff;
}
</style>
