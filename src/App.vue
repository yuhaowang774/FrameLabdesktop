<script setup lang="ts">
// 应用根：左 ControlPanel + 右 Workspace，持有图片状态在两侧间传递
import { ref, watch } from 'vue'
import ControlPanel from './components/layout/ControlPanel.vue'
import Workspace from './components/layout/Workspace.vue'
import { useFrameConfig } from './composables/useFrameConfig'

const { state } = useFrameConfig()

const photoSrc = ref<string | null>(null)
const bgImage = ref<HTMLImageElement | null>(null) // 原图或自定义背景图
const sourceImg = ref<HTMLImageElement | null>(null) // 导出用主照片

function onImageReady(payload: { url: string; img: HTMLImageElement }) {
  photoSrc.value = payload.url
  bgImage.value = payload.img
  sourceImg.value = payload.img
}

function onCustomBg(img: HTMLImageElement) {
  bgImage.value = img
}

// 主题切换 → 同步 body 类，驱动全局底色与磨砂面板 token
watch(
  () => state.theme,
  (t) => {
    document.body.classList.toggle('theme-light', t === 'light')
    document.body.classList.toggle('theme-dark', t === 'dark')
  },
  { immediate: true },
)
</script>

<template>
  <div class="app-root">
    <header class="topbar">
      <h1>Frame · 照片边框水印</h1>
      <button class="theme-toggle" @click="state.theme = state.theme === 'dark' ? 'light' : 'dark'">
        {{ state.theme === 'dark' ? '🌙 暗色' : '☀️ 亮色' }}
      </button>
    </header>
    <main class="body">
      <ControlPanel
        :source-img="sourceImg"
        @image-ready="onImageReady"
        @custom-bg="onCustomBg"
      />
      <Workspace :photo-src="photoSrc" :bg-image="bgImage" />
    </main>
  </div>
</template>

<style scoped>
.app-root {
  height: 100%;
  display: flex;
  flex-direction: column;
}
.topbar {
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-bottom: 1px solid var(--panel-border);
  background: var(--panel-bg);
  backdrop-filter: blur(8px);
  flex-shrink: 0;
}
.topbar h1 {
  font-size: 16px;
  font-weight: 600;
  color: var(--text-normal);
}
.theme-toggle {
  padding: 6px 12px;
  border-radius: 8px;
  border: 1px solid var(--panel-border);
  background: var(--panel-hover);
  color: var(--text-normal);
  cursor: pointer;
  font-size: 13px;
  transition: background 0.15s;
}
.theme-toggle:hover {
  background: var(--accent-bg);
  border-color: var(--accent-border);
}
.body {
  flex: 1;
  display: flex;
  min-height: 0;
}

/* 768px 以下：左右栏转上下布局，控制面板横向滚动 */
@media (max-width: 768px) {
  .body {
    flex-direction: column;
    overflow-y: auto;
  }
  .body :deep(.control-panel) {
    width: 100%;
    height: auto;
    flex-direction: row;
    flex-wrap: nowrap;
    overflow-x: auto;
    overflow-y: hidden;
    border-right: none;
    border-bottom: 1px solid var(--panel-border);
    gap: 10px;
    align-items: stretch;
  }
  .body :deep(.control-block) {
    flex: 0 0 260px;
    align-self: flex-start;
    max-height: 60vh;
    overflow-y: auto;
  }
  .body :deep(.divider) {
    display: none;
  }
  .body :deep(.workspace) {
    flex: 1;
    min-height: 60vh;
  }
}
</style>
