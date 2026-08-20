<script setup lang="ts">
// 顶部区域（对标 LrC 顶栏）：Logo + 模块切换器 + 全局设置/帮助 + 任务进度条。
import { useAppState, type ModuleTab } from '../../composables/useAppState'

const app = useAppState()

const tabs: { id: ModuleTab; label: string }[] = [
  { id: 'library', label: '图库' },
  { id: 'develop', label: '编辑' },
  { id: 'export', label: '导出' },
]

function onHelp() {
  window.alert(
    '照片相框 & 背景合成工具\n\n' +
      '三段式工作流：图库 → 编辑 → 导出\n' +
      '快捷键：←/→ 切换胶片照片，Ctrl/⌘+ 滚轮缩放，Ctrl+Z 撤销\n' +
      '所有处理均在浏览器本地完成，原图不会上传服务器。',
  )
}
</script>

<template>
  <header class="topbar">
    <div class="left">
      <div class="logo">◎ Frame<span>Lab</span></div>
    </div>

    <nav class="module-switch">
      <button
        v-for="t in tabs"
        :key="t.id"
        class="mod"
        :class="{ on: app.activeModule.value === t.id }"
        @click="app.setModule(t.id)"
      >
        {{ t.label }}
      </button>
    </nav>

    <div class="right">
      <button class="icon-btn" title="隐藏/显示胶片条" @click="app.toggleFilmstrip()">
        {{ app.state.filmstripVisible ? '▭' : '▯' }}
      </button>
      <button class="icon-btn" title="帮助" @click="onHelp">?</button>
    </div>

    <!-- 全局任务进度条（导出/合成），对标 LrC 身份标识监视器 -->
    <div v-if="app.task.active" class="task-bar">
      <span class="task-label">{{ app.task.label }}</span>
      <div class="task-track">
        <div class="task-fill" :style="{ width: Math.round(app.task.progress * 100) + '%' }" />
      </div>
      <span class="task-pct">{{ Math.round(app.task.progress * 100) }}%</span>
    </div>
  </header>
</template>

<style scoped>
.topbar {
  position: relative;
  display: flex;
  align-items: center;
  gap: 16px;
  height: 48px;
  padding: 0 14px;
  background: var(--panel);
  border-bottom: 1px solid var(--border);
}
.left {
  flex: none;
}
.logo {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--text);
}
.logo span {
  color: var(--accent);
}
.module-switch {
  display: flex;
  gap: 2px;
  background: var(--panel-2);
  border-radius: 9px;
  padding: 3px;
}
.mod {
  background: none;
  border: none;
  color: var(--text-dim);
  padding: 6px 16px;
  border-radius: 7px;
  font-size: 13px;
  cursor: pointer;
  font-weight: 600;
}
.mod.on {
  background: var(--accent);
  color: #fff;
}
.right {
  margin-left: auto;
  display: flex;
  gap: 6px;
}
.icon-btn {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: var(--panel-2);
  color: var(--text);
  cursor: pointer;
  font-size: 14px;
}
.task-bar {
  position: absolute;
  left: 14px;
  right: 14px;
  bottom: -1px;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 3px 0;
  transform: translateY(100%);
  background: var(--panel);
  border: 1px solid var(--border);
  border-top: none;
  border-radius: 0 0 8px 8px;
  padding-left: 12px;
  padding-right: 12px;
  z-index: 20;
}
.task-label {
  font-size: 12px;
  color: var(--text);
  white-space: nowrap;
}
.task-track {
  flex: 1;
  height: 6px;
  background: var(--panel-3);
  border-radius: 3px;
  overflow: hidden;
}
.task-fill {
  height: 100%;
  background: var(--accent);
  transition: width 0.2s;
}
.task-pct {
  font-size: 11px;
  color: var(--text-dim);
  min-width: 34px;
  text-align: right;
}
</style>
