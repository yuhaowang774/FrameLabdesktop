<script setup lang="ts">
// 应用根：LrC 五区布局外壳
// 顶部区域 / 左侧可折叠面板组 / 中间主画布 / 右侧可折叠参数面板组 / 底部胶片条
import { ref, watch, computed, onMounted, onBeforeUnmount } from 'vue'
import TopBar from './components/layout/TopBar.vue'
import LeftPanels from './components/layout/LeftPanels.vue'
import RightPanels from './components/layout/ControlPanel.vue'
import Workspace from './components/layout/Workspace.vue'
import Filmstrip from './components/layout/Filmstrip.vue'
import BottomToolbar from './components/layout/BottomToolbar.vue'
import LibraryView from './components/layout/LibraryView.vue'
import ExportPanel from './components/layout/ExportPanel.vue'
import PhotoEditor from './components/common/PhotoEditor.vue'
import { useLibrary } from './composables/useLibrary'
import { useAppState } from './composables/useAppState'
import { useFrameConfig } from './composables/useFrameConfig'
import { useHistory } from './composables/useHistory'
import { editingPhoto, photoImage } from './composables/useUi'
import { isTauri } from './platform/env'

const library = useLibrary()
const app = useAppState()
const { patch } = useFrameConfig()
const history = useHistory()

// 当前选中照片的图源
const photoSrc = ref<string | null>(null)
const bgImage = ref<HTMLImageElement | null>(null)
const sourceImg = ref<HTMLImageElement | null>(null)

function loadActive() {
  const active = library.items.find((i) => i.id === library.activeId.value)
  if (!active) {
    photoSrc.value = null
    bgImage.value = null
    sourceImg.value = null
    return
  }
  photoSrc.value = active.url
  const im = new Image()
  im.onload = () => {
    bgImage.value = im
    sourceImg.value = im
    photoImage.value = im
    patch({ photoSrc: active.url })
  }
  im.src = active.url
}

watch(() => library.activeId.value, loadActive, { immediate: true })

// 进入编辑模块时自动加载
watch(() => app.activeModule.value, (m) => {
  if (m === 'develop' && library.activeId.value) loadActive()
})

// ===== 快捷键 =====
function onKey(e: KeyboardEvent) {
  const tag = (e.target as HTMLElement)?.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
  if (e.key === 'ArrowRight') {
    library.next()
    e.preventDefault()
  } else if (e.key === 'ArrowLeft') {
    library.prev()
    e.preventDefault()
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
    // 桌面端撤销/重做由原生菜单加速键接管，避免双触发
    if (isTauri) return
    if (e.shiftKey) history.redo()
    else history.undo()
    e.preventDefault()
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
    if (isTauri) return
    history.redo()
    e.preventDefault()
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

const showLeft = computed(() => app.activeModule.value === 'develop' && app.state.leftOpen)
const showRight = computed(() => app.activeModule.value === 'develop' && app.state.rightOpen)

document.body.classList.add('theme-dark')
</script>

<template>
  <div class="app-root">
    <TopBar />

    <main class="body">
      <!-- 图库模块 -->
      <LibraryView v-if="app.activeModule.value === 'library'" />

      <!-- 编辑模块：五区布局 -->
      <template v-else-if="app.activeModule.value === 'develop'">
        <button class="rail left-rail" :class="{ collapsed: !app.state.leftOpen }" :title="app.state.leftOpen ? '隐藏左栏' : '显示左栏'" @click="app.toggleLeft()">
          {{ app.state.leftOpen ? '‹' : '›' }}
        </button>
        <LeftPanels v-if="showLeft" />
        <Workspace :photo-src="photoSrc" :bg-image="bgImage" />
        <button class="rail right-rail" :class="{ collapsed: !app.state.rightOpen }" :title="app.state.rightOpen ? '隐藏右栏' : '显示右栏'" @click="app.toggleRight()">
          {{ app.state.rightOpen ? '›' : '‹' }}
        </button>
        <RightPanels v-if="showRight" />
      </template>

      <!-- 导出模块 -->
      <ExportPanel v-else-if="app.activeModule.value === 'export'" />
    </main>

    <!-- 底部：编辑模块显示工具栏 + 胶片条；其他模块仅胶片条 -->
    <template v-if="app.activeModule.value === 'develop'">
      <BottomToolbar />
    </template>
    <Filmstrip v-if="app.state.filmstripVisible" />

    <PhotoEditor v-if="editingPhoto" @close="editingPhoto = false" />
  </div>
</template>

<style scoped>
.app-root {
  height: 100%;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.body {
  flex: 1;
  display: flex;
  min-height: 0;
  position: relative;
}
.rail {
  flex: none;
  width: 14px;
  background: var(--panel-2);
  border: none;
  border-right: 1px solid var(--border);
  color: var(--text-dim);
  cursor: pointer;
  font-size: 14px;
  z-index: 5;
}
.rail.right-rail {
  border-right: none;
  border-left: 1px solid var(--border);
}
.rail:hover {
  color: var(--text);
  background: var(--panel-3);
}
</style>
