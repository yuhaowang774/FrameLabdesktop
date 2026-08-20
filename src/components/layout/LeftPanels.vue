<script setup lang="ts">
// 左侧可折叠面板组（对标 LrC 左栏）：我的素材 / 相框模板库 / 背景模板库 / 参数快照。支持独奏+折叠+拖宽。
import { useAppState } from '../../composables/useAppState'
import { useLibrary } from '../../composables/useLibrary'
import { useHistory } from '../../composables/useHistory'
import CollapsiblePanel from '../common/CollapsiblePanel.vue'
import LeftLibraryPanel from './LeftLibraryPanel.vue'
import TemplatePanel from './TemplatePanel.vue'
import SnapshotPanel from './SnapshotPanel.vue'

const app = useAppState()
const library = useLibrary()
const history = useHistory()

const P = app.state.leftPanels
</script>

<template>
  <aside class="left-panels" :style="{ width: app.leftWidthPx.value }">
    <CollapsiblePanel
      title="我的素材"
      :open="P.library"
      :badge="library.items.length"
      @toggle="app.togglePanel('left', 'library')"
    >
      <LeftLibraryPanel />
    </CollapsiblePanel>

    <CollapsiblePanel
      title="相框模板库"
      :open="P.frameTemplates"
      @toggle="app.togglePanel('left', 'frameTemplates')"
    >
      <TemplatePanel category="frame" />
    </CollapsiblePanel>

    <CollapsiblePanel
      title="背景模板库"
      :open="P.bgTemplates"
      @toggle="app.togglePanel('left', 'bgTemplates')"
    >
      <TemplatePanel category="background" />
    </CollapsiblePanel>

    <CollapsiblePanel
      title="参数快照"
      :open="P.snapshots"
      :badge="history.items.value.length"
      @toggle="app.togglePanel('left', 'snapshots')"
    >
      <SnapshotPanel />
    </CollapsiblePanel>
  </aside>
</template>

<style scoped>
.left-panels {
  height: 100%;
  overflow-y: auto;
  background: var(--panel);
  border-right: 1px solid var(--border);
  flex-shrink: 0;
  resize: horizontal;
  min-width: 180px;
  max-width: 480px;
}
</style>
