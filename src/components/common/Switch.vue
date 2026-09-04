<script setup lang="ts">
// 紧凑胶囊滑块开关：开启=项目主色轨道+滑块右移、关闭=灰色轨道+滑块左移。
// 用项目 token 而非绿色，保持整体风格统一（参考切片：滑块式开关、非绿色）。
defineProps<{
  modelValue: boolean
  title?: string
}>()
defineEmits<{ 'update:modelValue': [value: boolean] }>()
</script>

<template>
  <button
    class="tik"
    :class="{ on: modelValue }"
    role="switch"
    :aria-checked="modelValue"
    :title="title"
    @click.stop="$emit('update:modelValue', !modelValue)"
  >
    <span class="track"><span class="thumb" /></span>
  </button>
</template>

<style scoped>
.tik {
  display: inline-flex;
  align-items: center;
  padding: 0;
  border: none;
  background: transparent;
  cursor: pointer;
}
.tik:focus-visible {
  outline: 1px solid var(--accent);
  outline-offset: 1px;
}
.track {
  display: inline-flex;
  align-items: center;
  width: 30px;
  height: 16px;
  padding: 0 2px;
  border-radius: 9px;
  background: var(--panel-3);
  border: 1px solid var(--border);
  transition: background 0.15s ease, border-color 0.15s ease;
  box-sizing: border-box;
}
.thumb {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--text-dim);
  transition: transform 0.15s ease, background 0.15s ease;
}
.tik.on .track {
  background: var(--accent);
  border-color: var(--accent);
}
.tik.on .thumb {
  transform: translateX(12px);
  background: var(--text);
}
</style>