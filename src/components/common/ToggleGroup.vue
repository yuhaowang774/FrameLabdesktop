<script setup lang="ts">
// 通用切换按钮组（用于背景模式 / 对齐 / 格式等单选场景）：扁平、细边框、无圆角阴影。
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
  font-size: 12px;
  font-weight: 400;
  line-height: 16px;
  color: var(--text-dim);
  letter-spacing: 0;
}
.buttons {
  display: flex;
  gap: 0;
  flex-wrap: nowrap;
}
.buttons button {
  flex: 1;
  min-width: 0;
  height: 24px;
  padding: 0 6px;
  border: 1px solid var(--border);
  border-right: none;
  background: var(--panel-2);
  color: var(--text-dim);
  font-size: 12px;
  font-weight: 400;
  line-height: 16px;
  cursor: pointer;
  border-radius: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.buttons button:first-child {
  border-radius: 0;
}
.buttons button:last-child {
  border-right: 1px solid var(--border);
  border-radius: 0;
}
.buttons button:hover {
  background: var(--hover);
  color: var(--text);
}
/* Tab 激活：仅背景使用 accent，文字不变 */
.buttons button.active {
  background: var(--accent);
  color: var(--text-dim);
  border-color: var(--accent);
}
</style>
