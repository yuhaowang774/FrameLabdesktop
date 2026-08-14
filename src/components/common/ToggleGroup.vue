<script setup lang="ts">
// 通用切换按钮组：用于背景模式 / 主题 / 对齐等单选场景
import type { Theme } from '../../core/types'

export interface ToggleOption<T extends string = string> {
  value: T
  label: string
}

const props = withDefaults(
  defineProps<{
    modelValue: string
    options: ToggleOption[]
    disabled?: boolean
    label?: string
  }>(),
  { disabled: false },
)

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

function select(v: string) {
  if (props.disabled) return
  emit('update:modelValue', v)
}
</script>

<template>
  <div class="toggle-group" :class="{ disabled }">
    <span class="label" v-if="label">{{ label }}</span>
    <div class="buttons">
      <button
        v-for="opt in options"
        :key="opt.value"
        :class="{ active: opt.value === modelValue }"
        @click="select(opt.value)"
      >
        {{ opt.label }}
      </button>
    </div>
  </div>
</template>

<style scoped>
.toggle-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.toggle-group.disabled {
  opacity: 0.4;
  pointer-events: none;
}
.label {
  font-size: 13px;
  color: #ccc;
}
.buttons {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
}
.buttons button {
  flex: 1;
  min-width: 48px;
  padding: 7px 10px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.05);
  color: #ddd;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
}
.buttons button:hover {
  background: rgba(255, 255, 255, 0.1);
}
.buttons button.active {
  background: rgba(120, 170, 255, 0.85);
  color: #fff;
  border-color: rgba(120, 170, 255, 0.9);
}
</style>
