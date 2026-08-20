<script setup lang="ts">
// 右侧可折叠参数面板组（对标 LrC Develop 右侧滑块面板）：
// 画布基础 / 相框 / 图片布局 / 背景 / 附加效果。支持独奏+折叠+拖宽。
import { useAppState } from '../../composables/useAppState'
import CollapsiblePanel from '../common/CollapsiblePanel.vue'
import CanvasBasic from '../controls/CanvasBasic.vue'
import LayoutStyle from '../controls/LayoutStyle.vue'
import ImageLayout from '../controls/ImageLayout.vue'
import BackgroundMode from '../controls/BackgroundMode.vue'
import BrandExif from '../controls/BrandExif.vue'
import EffectsPanel from '../controls/EffectsPanel.vue'
import InfoLayerPanel from '../controls/InfoLayerPanel.vue'

const app = useAppState()
const P = app.state.rightPanels
</script>

<template>
  <aside class="right-panels" :style="{ width: app.rightWidthPx.value }">
    <CollapsiblePanel title="画布基础设置" :open="P.canvas" @toggle="app.togglePanel('right', 'canvas')">
      <CanvasBasic />
    </CollapsiblePanel>

    <CollapsiblePanel title="相框设置" :open="P.frame" @toggle="app.togglePanel('right', 'frame')">
      <LayoutStyle />
    </CollapsiblePanel>

    <CollapsiblePanel title="图片布局" :open="P.layout" @toggle="app.togglePanel('right', 'layout')">
      <ImageLayout />
    </CollapsiblePanel>

    <CollapsiblePanel title="背景设置" :open="P.background" @toggle="app.togglePanel('right', 'background')">
      <BackgroundMode />
    </CollapsiblePanel>

    <CollapsiblePanel title="附加效果" :open="P.effects" @toggle="app.togglePanel('right', 'effects')">
      <EffectsPanel />
      <div class="sub-divider">品牌与信息</div>
      <BrandExif />
    </CollapsiblePanel>

    <CollapsiblePanel title="顶层INFO信息设置" :open="P.info" @toggle="app.togglePanel('right', 'info')">
      <InfoLayerPanel />
    </CollapsiblePanel>
  </aside>
</template>

<style scoped>
.right-panels {
  height: 100%;
  overflow-y: auto;
  background: var(--panel);
  border-left: 1px solid var(--border);
  flex-shrink: 0;
  resize: horizontal;
  min-width: 200px;
  max-width: 520px;
  direction: rtl;
}
.right-panels > :deep(*) {
  direction: ltr;
}
.sub-divider {
  margin: 16px 0 8px;
  padding-top: 12px;
  border-top: 1px dashed var(--border);
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text);
}
</style>
