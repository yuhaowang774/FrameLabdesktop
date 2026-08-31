<script setup lang="ts">
// 底部上层工具栏：缩放、撤销/重做。
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

    <div class="group">
      <span class="lbl">缩放</span>
      <button class="tool" @click="zoomOut">−</button>
      <span class="zoom-val">{{ Math.round(viewer.zoom.value * 100) }}%</span>
      <button class="tool" @click="zoomIn">＋</button>
      <button class="tool" @click="fitView">适配</button>
    </div>
  </div>
</template>

<style scoped>
.bottom-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 26px;
  padding: 0 12px;
  background: var(--shell);
  border-bottom: 1px solid var(--border);
  flex-wrap: nowrap;
  overflow: hidden;
  font-size: 12px;
  line-height: 16px;
}
.group {
  display: flex;
  align-items: center;
  gap: 2px;
}
.sep {
  width: 1px;
  height: 16px;
  background: var(--border);
  margin: 0 2px;
}
.lbl {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-dim);
  margin-right: 2px;
  line-height: 16px;
}
.tool {
  background: var(--panel-2);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 0;
  padding: 0 8px;
  height: 20px;
  font-size: 12px;
  font-weight: 400;
  line-height: 16px;
  cursor: pointer;
}
.tool:hover {
  background: var(--hover);
  color: var(--text-normal);
}
.tool.on {
  background: var(--accent);
  color: var(--text-dim);
  border-color: var(--accent);
}
.tool:active { background: var(--pressed); }
.tool:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.zoom-val {
  font-size: 12px;
  color: var(--text-num);
  min-width: 42px;
  text-align: center;
  line-height: 16px;
}
</style>
