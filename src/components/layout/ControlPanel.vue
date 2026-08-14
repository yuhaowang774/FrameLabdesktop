<script setup lang="ts">
// 左栏控制面板：组合 5 个控件
import ImageSource from '../controls/ImageSource.vue'
import BackgroundMode from '../controls/BackgroundMode.vue'
import LayoutStyle from '../controls/LayoutStyle.vue'
import BrandExif from '../controls/BrandExif.vue'
import HistoryList from '../controls/HistoryList.vue'
import BatchProcess from '../controls/BatchProcess.vue'

defineProps<{ sourceImg: HTMLImageElement | null }>()
const emit = defineEmits<{ 'image-ready': [payload: { url: string; img: HTMLImageElement }]; 'custom-bg': [img: HTMLImageElement] }>()
</script>

<template>
  <aside class="control-panel">
    <ImageSource :source-img="sourceImg" @image-ready="emit('image-ready', $event)" />
    <div class="divider"></div>
    <BackgroundMode @custom-bg="emit('custom-bg', $event)" />
    <div class="divider"></div>
    <LayoutStyle />
    <div class="divider"></div>
    <BrandExif />
    <div class="divider"></div>
    <HistoryList />
    <div class="divider"></div>
    <BatchProcess />
  </aside>
</template>

<style scoped>
.control-panel {
  width: 320px;
  flex-shrink: 0;
  height: 100%;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 14px;
  background: var(--panel-bg);
  backdrop-filter: blur(14px);
  border-right: 1px solid var(--panel-border);
}
:deep(.control-block) {
  background: var(--panel-bg);
  border: 1px solid var(--panel-border);
  border-radius: 14px;
  padding: 14px;
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.18);
}
:deep(.control-block h4) {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-muted);
  margin-bottom: 8px;
}
:deep(.control-block .field label),
:deep(.control-block .label) {
  color: var(--text-muted);
}
:deep(.control-block button:not(.exif-btn):not(.export-btn)) {
  color: var(--text-normal);
  border-color: var(--panel-border);
  background: var(--panel-hover);
}
:deep(.control-block button:not(.exif-btn):not(.export-btn):hover) {
  background: var(--accent-bg);
  border-color: var(--accent-border);
}
:deep(.control-block .select),
:deep(.control-block .text-input),
:deep(.control-block .modal-input) {
  color: var(--text-normal);
  border-color: var(--panel-border);
  background: rgba(0, 0, 0, 0.2);
}
body.theme-light :deep(.control-block .select),
body.theme-light :deep(.control-block .text-input) {
  background: rgba(255, 255, 255, 0.6);
}
:deep(.control-block option) {
  background: #1a1a1a;
  color: #fff;
}
.divider {
  display: none;
}
</style>
