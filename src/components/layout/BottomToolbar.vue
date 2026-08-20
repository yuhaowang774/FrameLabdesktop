<script setup lang="ts">
// 底部上层工具栏（对标 LrC 状态栏/工具条）：视图切换、缩放、撤销/重做、对比、标尺。
import { useViewer } from '../../composables/useViewer'
import { useHistory } from '../../composables/useHistory'

const viewer = useViewer()
const { undo, redo, canUndo, canRedo } = useHistory()

function zoomIn() {
  viewer.zoomBy(0.2)
}
function zoomOut() {
  viewer.zoomBy(-0.2)
}
function fitView() {
  viewer.resetView()
}
</script>

<template>
  <div class="bottom-bar">
    <div class="group">
      <button class="tool" :disabled="!canUndo" title="撤销 (Ctrl+Z)" @click="undo">↶ 撤销</button>
      <button class="tool" :disabled="!canRedo" title="重做 (Ctrl+Shift+Z)" @click="redo">↷ 重做</button>
    </div>

    <div class="sep" />

    <div class="group">
      <span class="lbl">视图</span>
      <button
        class="tool"
        :class="{ on: viewer.compare.value === 'off' }"
        @click="viewer.setCompare('off')"
      >合成</button>
      <button
        class="tool"
        :class="{ on: viewer.compare.value === 'split' }"
        title="左右对比"
        @click="viewer.setCompare('split')"
      >对比</button>
      <button
        class="tool"
        :class="{ on: viewer.compare.value === 'slide' }"
        @click="viewer.setCompare('slide')"
      >滑动</button>
      <button
        class="tool"
        :class="{ on: viewer.showRulers.value }"
        @click="viewer.toggleRulers()"
      >标尺</button>
    </div>

    <div class="sep" />

    <div class="group">
      <span class="lbl">缩放</span>
      <button class="tool" @click="zoomOut">−</button>
      <span class="zoom-val">{{ Math.round(viewer.zoom.value * 100) }}%</span>
      <button class="tool" @click="zoomIn">＋</button>
      <button class="tool" @click="fitView">适配</button>
    </div>

    <span class="spacer" />
    <span class="hint">滚轮缩放 · Ctrl/⌘+滚轮 · 拖拽平移 · ←/→ 切换胶片</span>
  </div>
</template>

<style scoped>
.bottom-bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
  background: var(--panel-2);
  border-bottom: 1px solid var(--border);
  flex-wrap: wrap;
}
.group {
  display: flex;
  align-items: center;
  gap: 4px;
}
.sep {
  width: 1px;
  height: 18px;
  background: var(--border);
}
.lbl {
  font-size: 11px;
  color: var(--text-dim);
  margin-right: 2px;
}
.tool {
  background: var(--panel-3);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 5px 9px;
  font-size: 12px;
  cursor: pointer;
}
.tool:hover {
  border-color: var(--accent);
}
.tool.on {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}
.tool:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.zoom-val {
  font-size: 12px;
  color: var(--text);
  min-width: 42px;
  text-align: center;
}
.spacer {
  flex: 1;
}
.hint {
  font-size: 11px;
  color: var(--text-dim);
}
</style>
