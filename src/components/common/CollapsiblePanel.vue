<script setup lang="ts">
// FrameLab 折叠面板：标题栏 30px / 13px / 400 / 标题前小图标 / 右侧操作 + 折叠箭头
// 复用约定：
//   - icon slot  ：标题前的 12px 线性图标（可选）
//   - actions slot：标题右侧操作按钮（可选，如「全部重置」）
//   - 整行除 actions 区域外点击切换折叠；actions 区域 click.stop 隔离
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
    <header
      class="panel-head"
      :class="{ hover }"
      @click="emit('toggle')"
      @mouseenter="hover = true"
      @mouseleave="hover = false"
    >
      <span v-if="$slots.icon" class="icon"><slot name="icon" /></span>
      <span class="title">{{ props.title }}</span>
      <span v-if="props.badge != null && props.badge !== ''" class="badge">{{ props.badge }}</span>
      <span v-if="$slots.actions" class="actions" @click.stop><slot name="actions" /></span>
      <span class="twisty">{{ props.open ? '▾' : '▸' }}</span>
    </header>
    <div v-show="props.open" class="panel-body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
.panel {
  border-top: 1px solid var(--border);
  background: var(--panel);
}
.panel-head {
  display: flex;
  align-items: center;
  gap: 9px;
  height: 30px;
  padding: 0 14px;
  cursor: pointer;
  user-select: none;
  background: var(--panel);
  border: none;
}
.panel-head.hover,
.panel-head:hover {
  background: var(--hover);
}
.icon {
  flex: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  color: var(--text-dim);
  line-height: 0;
}
.icon :deep(svg) {
  display: block;
}
.title {
  flex: 1;
  font-size: 13px;
  font-weight: 400;
  letter-spacing: 0;
  line-height: 18px;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.badge {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-dim);
}
.actions {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 18px;
  color: var(--text-dim);
}
.actions :deep(button) {
  height: 18px;
  padding: 0 6px;
  font-size: 11px;
  font-weight: 400;
  line-height: 16px;
  color: var(--text-dim);
  background: transparent;
  border: 1px solid transparent;
  border-radius: 0;
  cursor: pointer;
  font-family: inherit;
}
.actions :deep(button:hover) {
  background: var(--pressed);
  color: var(--text);
  border-color: var(--border);
}
.actions :deep(button:active) {
  background: var(--pressed);
}
.twisty {
  flex: none;
  color: var(--text-dim);
  font-size: 11px;
  width: 12px;
  text-align: center;
  line-height: 18px;
}
.panel-body {
  padding: 10px 14px 12px;
  background: var(--panel);
  border: none;
  border-top: 1px solid var(--border);
}
</style>
