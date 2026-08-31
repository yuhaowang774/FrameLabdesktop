<script setup lang="ts">
// FrameLab 滑块：轨道 5px / 手柄 12px / 数字冷灰 / 字重 400
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    modelValue: number
    min?: number
    max?: number
    step?: number
    label?: string
    suffix?: string
    unit?: string
    disabled?: boolean
  }>(),
  { min: 0, max: 100, step: 1, suffix: '', unit: '', disabled: false },
)

const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

const fillPercent = computed(() => {
  const p = ((props.modelValue - props.min) / (props.max - props.min)) * 100
  return Math.min(100, Math.max(0, p))
})

function onInput(e: Event) {
  emit('update:modelValue', Number((e.target as HTMLInputElement).value))
}
</script>

<template>
  <!-- 单行布局：label 左 → 滑块中间 → 数值右 -->
  <div class="range-slider" :class="{ disabled }">
    <span class="label" v-if="label">{{ label }}</span>
    <input
      class="track"
      type="range"
      :min="min"
      :max="max"
      :step="step"
      :value="modelValue"
      :disabled="disabled"
      :style="{ '--fill': fillPercent + '%' }"
      @input="onInput"
    />
    <span class="value">{{ modelValue }}{{ unit || suffix }}</span>
  </div>
</template>

<style scoped>
.range-slider {
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 8px;
  min-height: 20px; /* 滑块垂直间距 ≈8px 通过外层 gap 控制 */
}
.range-slider.disabled {
  opacity: 0.4;
  pointer-events: none;
}
.label {
  flex: none;
  width: 76px; /* 固定标签宽，统一对齐 */
  color: var(--text-dim);
  font-size: 12px;
  font-weight: 400; /* 禁止粗体 */
  line-height: 16px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.track {
  flex: 1;
  min-width: 0; /* 防止挤压溢出 */
}
.value {
  flex: none;
  width: 52px; /* 容纳 "200px" / "0.5" 等最宽值，统一列宽 */
  color: var(--text-num);
  font-size: 11px;
  font-weight: 400;
  font-variant-numeric: tabular-nums;
  text-align: right;
  line-height: 16px;
}
/* 细长轨道：填充滑块色 / 未填充轨道色，5px 高 */
input[type='range'] {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 5px;
  border-radius: 0;
  background: linear-gradient(
    to right,
    var(--slider-thumb) var(--fill),
    var(--slider-track) var(--fill)
  );
  outline: none;
  cursor: pointer;
  margin: 0;
  padding: 0;
}
input[type='range']::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--slider-thumb);
  border: none;
  box-shadow: none;
  margin-top: -3.5px; /* (5-12)/2，让手柄居中轨道 */
  transition: background 0.1s;
}
input[type='range']:hover::-webkit-slider-thumb,
input[type='range']:active::-webkit-slider-thumb {
  background: var(--slider-thumb-hover);
}
input[type='range']:active::-webkit-slider-thumb {
  background: var(--pressed);
}
input[type='range']::-webkit-slider-runnable-track {
  background: transparent;
  border: none;
}
input[type='range']::-moz-range-thumb {
  width: 12px;
  height: 12px;
  border: none;
  border-radius: 50%;
  background: var(--slider-thumb);
  box-shadow: none;
}
input[type='range']:hover::-moz-range-thumb { background: var(--slider-thumb-hover); }
input[type='range']:active::-moz-range-thumb { background: var(--pressed); }
input[type='range']::-moz-range-track {
  background: var(--slider-track);
  height: 5px;
  border: none;
}
input[type='range']::-moz-range-progress {
  background: var(--slider-thumb);
  height: 5px;
}
</style>
