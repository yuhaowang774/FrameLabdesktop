<script setup lang="ts">
// 折叠面板体内子分组：11px 小标题（前置强调色刻度）+ 顶部分隔线，
// 让面板内「主开关 → 通用参数 → 模式专属参数」的层级一眼可辨。
// 分组间距（12px + 分隔线）大于组内行距（8px），形成疏密节奏；
// 作为父容器第一个子元素时自动去掉顶部分隔线。
defineProps<{ title?: string }>()
</script>

<template>
  <section class="cg">
    <div v-if="title" class="cg-title">{{ title }}</div>
    <slot />
  </section>
</template>

<style scoped>
.cg {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding-top: 12px;
  border-top: 1px solid var(--border);
}
.cg:first-child {
  padding-top: 0;
  border-top: none;
}
.cg-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 400; /* 禁止粗体 */
  color: var(--text);
  letter-spacing: 1px;
  line-height: 14px;
}
.cg-title::before {
  content: '';
  flex: none;
  width: 3px;
  height: 10px;
  background: var(--accent);
}
</style>
