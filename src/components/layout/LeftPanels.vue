<script setup lang="ts">
// 左侧可折叠面板组：我的素材 / 相框模板库 / 修改历史记录。
// 各面板相互独立展开/收起，互不影响；支持拖拽调宽。
import { ref } from 'vue'
import { useAppState } from '../../composables/useAppState'
import { useLibrary } from '../../composables/useLibrary'
import { useHistory } from '../../composables/useHistory'
import CollapsiblePanel from '../common/CollapsiblePanel.vue'
import LeftLibraryPanel from './LeftLibraryPanel.vue'
import MediaInfoPanel from './MediaInfoPanel.vue'
import HistoryPanel from './HistoryPanel.vue'
import TemplatePickerModal from '../controls/TemplatePickerModal.vue'

const app = useAppState()
const library = useLibrary()
const history = useHistory()

const P = app.state.leftPanels
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

    <CollapsiblePanel
      title="相框模板库"
      :open="P.frameTemplates"
      :title-action="'popup'"
      @popup="pickerOpen = true"
      @toggle="app.togglePanel('left', 'frameTemplates')"
    >
      <p class="tpl-hint">点击上方标题打开模板选择器</p>
    </CollapsiblePanel>

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
.tpl-hint { font-size: 12px; color: var(--text-dim); }
</style>
