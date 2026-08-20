<script setup lang="ts">
// 可折叠子面板（对标 LrC 左侧/右侧分组面板）：标题栏点击折叠，支持独奏由父级控制 open 状态。
import { ref } from 'vue'

const props = defineProps<{
  title: string
  open: boolean
  badge?: string | number
}>()
const emit = defineEmits<{ (e: 'toggle'): void }>()

const hover = ref(false)
</script>

<template>
  <section class="panel" :class="{ open: props.open }">
    <header class="panel-head" @click="emit('toggle')" @mouseenter="hover = true" @mouseleave="hover = false">
      <span class="twisty">{{ props.open ? '▾' : '▸' }}</span>
      <span class="title">{{ props.title }}</span>
      <span v-if="props.badge != null && props.badge !== ''" class="badge">{{ props.badge }}</span>
    </header>
    <div v-show="props.open" class="panel-body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.panel {
  border-bottom: 1px solid var(--border);
  background: var(--panel);
}
.panel-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 9px 12px;
  cursor: pointer;
  user-select: none;
  background: var(--panel-2);
  position: sticky;
  top: 0;
  z-index: 2;
}
.panel-head:hover {
  background: color-mix(in srgb, var(--accent) 10%, var(--panel-2));
}
.twisty {
  color: var(--text-dim);
  font-size: 11px;
  width: 12px;
}
.title {
  flex: 1;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text);
}
.badge {
  font-size: 11px;
  color: var(--text-dim);
  background: var(--panel-3);
  border-radius: 9px;
  padding: 1px 7px;
}
.panel-body {
  padding: 10px 12px 14px;
}
</style>
