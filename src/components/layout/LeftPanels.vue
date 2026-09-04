<script setup lang="ts">
// 左侧可折叠面板组：我的素材 / 相框模板库 / 修改历史记录。
// 各面板相互独立展开/收起，互不影响；支持拖拽调宽。
import { ref } from 'vue'
import { useAppState } from '../../composables/useAppState'
import { useLibrary } from '../../composables/useLibrary'
import { useHistory } from '../../composables/useHistory'
import { useTemplates } from '../../composables/useTemplates'
import CollapsiblePanel from '../common/CollapsiblePanel.vue'
import Icon from '../common/Icon.vue'
import LeftLibraryPanel from './LeftLibraryPanel.vue'
import MediaInfoPanel from './MediaInfoPanel.vue'
import TemplatePickerModal from '../controls/TemplatePickerModal.vue'
import HistoryPanel from './HistoryPanel.vue'

const app = useAppState()
const library = useLibrary()
const history = useHistory()
const templates = useTemplates()

const P = app.state.leftPanels

// 模板库入口弹窗显隐
const pickerOpen = ref(false)

// ===== 右边缘拖拽调整宽度（持久化到 useAppState.setLeftWidth） =====
let startX = 0
let startW = 0
function onResizeDown(e: PointerEvent) {
  startX = e.clientX
  startW = app.state.leftWidth
  window.addEventListener('pointermove', onResizeMove)
  window.addEventListener('pointerup', onResizeUp)
  e.preventDefault()
}
function onResizeMove(e: PointerEvent) {
  app.setLeftWidth(startW + (e.clientX - startX))
}
function onResizeUp() {
  window.removeEventListener('pointermove', onResizeMove)
  window.removeEventListener('pointerup', onResizeUp)
}
</script>

<template>
  <aside class="left-panels" :style="{ width: app.leftWidthPx.value }">
    <!-- 右边缘拖拽手柄：向右拖变宽 -->
    <div class="resize-handle" title="拖拽调整左栏宽度" @pointerdown="onResizeDown" />
    <CollapsiblePanel
      title="我的素材"
      :open="P.library"
      :badge="library.items.length"
      @toggle="app.togglePanel('left', 'library')"
    >
      <LeftLibraryPanel />
    </CollapsiblePanel>

    <CollapsiblePanel
      title="基础信息"
      :open="P.mediaInfo"
      :badge="library.activeId.value ? 1 : 0"
      @toggle="app.togglePanel('left', 'mediaInfo')"
    >
      <MediaInfoPanel />
    </CollapsiblePanel>

    <!-- 相框模板库：显眼图标入口卡片，点击弹出模板选择器 -->
    <button class="tpl-entry" title="打开相框模板库" @click="pickerOpen = true">
      <span class="tpl-entry-icon"><Icon name="border" /></span>
      <span class="tpl-entry-label">相框模板库</span>
      <span class="tpl-entry-count">共 {{ templates.templates.filter((t) => t.builtin).length }} 套内置模板</span>
      <span class="tpl-entry-arrow">▸</span>
    </button>

    <CollapsiblePanel
      title="修改历史记录"
      :open="P.snapshots"
      :badge="history.records.value.length"
      @toggle="app.togglePanel('left', 'snapshots')"
    >
      <HistoryPanel />
    </CollapsiblePanel>
  </aside>
  <TemplatePickerModal v-model="pickerOpen" category="frame" />
</template>

<style scoped>
.left-panels {
  position: relative;
  height: 100%;
  overflow-y: auto;
  background: var(--panel);
  border-right: 1px solid var(--border);
  flex-shrink: 0;
  min-width: 200px;
  max-width: 420px;
}
.resize-handle {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 4px;
  cursor: ew-resize;
  z-index: 4;
  background: transparent;
}
.resize-handle:hover {
  background: var(--hover);
}
/* 相框模板库入口卡片：缩略图 + 标题 + 数量 + 箭头，整体可点击 */
.tpl-entry {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 10px 14px;
  background: var(--panel);
  border: none;
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
  cursor: pointer;
  color: var(--text);
  font-family: inherit;
  text-align: left;
}
.tpl-entry:hover {
  background: var(--hover);
}
.tpl-entry:active {
  background: var(--pressed);
}
.tpl-entry-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 32px;
  flex: none;
  background: var(--panel-3);
  border: 1px solid var(--border);
  color: var(--accent);
}
.tpl-entry-icon :deep(svg) {
  width: 20px;
  height: 20px;
}
.tpl-entry-label {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: var(--accent);
  white-space: nowrap;
}
.tpl-entry-count {
  font-size: 11px;
  color: var(--text-dim);
  white-space: nowrap;
}
.tpl-entry-arrow {
  color: var(--text-dim);
  font-size: 12px;
}
</style>
