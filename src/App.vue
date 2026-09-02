<script setup lang="ts">
// 应用根：五区工作台布局外壳（图库 / 编辑 / 导出）
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
import { useViewer } from './composables/useViewer'
import { suspendCommit } from './composables/useFrameConfig'
import { useHistory, registerActiveProvider } from './composables/useHistory'
import { editingPhoto, photoImage } from './composables/useUi'
import { isTauri } from './platform/env'
import UpdateModal from './components/layout/UpdateModal.vue'
import { detectUpdate, type UpdateHit } from './composables/useUpdateLog'

const library = useLibrary()
const app = useAppState()
const history = useHistory()

// 注册当前活动照片提供者：历史记录模块据此定位"当前编辑的照片"（避免与 useLibrary 循环依赖）
registerActiveProvider(() => {
  const id = library.activeId.value
  if (!id) return null
  const it = library.items.find((i) => i.id === id)
  return it ? { id, url: it.url } : null
})

// 当前选中照片的图源
const photoSrc = ref<string | null>(null)
const bgImage = ref<HTMLImageElement | null>(null)
const sourceImg = ref<HTMLImageElement | null>(null)

// 切换照片序列号：预加载期间若用户再次切换，过期请求直接丢弃，避免旧图覆盖新图
let switchSeq = 0

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve) => {
    const im = new Image()
    im.onload = () => resolve(im)
    im.onerror = () => resolve(im) // 加载失败也继续（bgImage 自然尺寸为 0，不会崩溃）
    im.src = url
    // 预热解码：decode() 让 Chromium 在解码线程池提前完成位图解码，
    // 避免首次 drawImage 时才触发同步解码（切图长任务的主要成分）。
    void im.decode?.().catch(() => {})
  })
}

async function loadActive() {
  const seq = ++switchSeq
  const active = library.items.find((i) => i.id === library.activeId.value)
  if (!active) {
    photoSrc.value = null
    bgImage.value = null
    sourceImg.value = null
    return
  }
  // 切换全程挂起历史提交：大图解码期间（可达秒级）用户的开关/滑块操作会被随后的
  // loadCursorFor 参数恢复覆盖（实测竞态：切换后立即点击开关被重置 + 产生脏历史节点），
  // 挂起后此类"半路编辑"静默丢弃，最终状态与恢复的参数一致。计数式挂起，finally 恒复位。
  suspendCommit(true)
  try {
    // 1) 先预加载新图（期间不切换画面，避免旧背景+新主图错位 / 图片未就绪导致的空白闪烁）
    const im = await loadImage(active.url)
    if (seq !== switchSeq) return // 已切换到其他照片，丢弃本次结果
    // 2) 恢复该照片历史链当前步骤的参数
    await history.ensureChain(active.id)
    if (seq !== switchSeq) return
    // 3) 原子切换：图源、背景、历史参数在同一同步块内更新 → 单次渲染、单次 fit
    //    导入/切换属非编辑流程，历史提交在整个切换期间均被挂起
    history.loadCursorFor(active.id)
    photoSrc.value = active.url
    bgImage.value = im
    sourceImg.value = im
    photoImage.value = im
  } finally {
    suspendCommit(false)
  }
}

watch(() => library.activeId.value, loadActive, { immediate: true })

// 进入编辑模块时自动加载当前选中照片（右侧面板默认收起，用户手动展开）
watch(() => app.activeModule.value, (m) => {
  if (m === 'develop') {
    if (library.activeId.value) loadActive()
  }
}, { immediate: true })

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
    // 桌面端撤销/重做由原生菜单加速键接管（Rust 菜单 → framelab://menu），避免双触发
    if (isTauri) return
    if (e.shiftKey) void history.redo()
    else void history.undo()
    e.preventDefault()
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
    if (isTauri) return
    void history.redo()
    e.preventDefault()
  } else if (e.key === 'Escape') {
    // Esc：复位画布视图（放大预览后快速回到适配状态）
    useViewer().resetView()
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    // Delete：从图库移除（有选中移除选中，否则移除当前照片）——弹确认，不删磁盘原文件
    if (library.items.length) {
      library.requestRemoveViaKeyboard()
      e.preventDefault()
    }
  }
}
onMounted(() => window.addEventListener('keydown', onKey))
onBeforeUnmount(() => window.removeEventListener('keydown', onKey))

// ===== 更新完成检测：版本号较上次启动有升级时，自动弹出更新详情弹窗 =====
// 桌面端版本运行时读取 tauri.conf.json（updater 静默安装重启后即为新版本首次启动）；Web 端用构建时注入版本。
const showUpdateModal = ref(false)
const updateHit = ref<UpdateHit | null>(null)
onMounted(async () => {
  let ver = __APP_VERSION__ as string
  if (isTauri) {
    try {
      ver = await (await import('@tauri-apps/api/app')).getVersion()
    } catch {
      /* 版本获取失败退回构建注入值 */
    }
  }
  const hit = detectUpdate(ver)
  if (hit) {
    updateHit.value = hit
    showUpdateModal.value = true
  }
})

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
        <LeftPanels v-if="showLeft" />
        <button class="rail left-rail" :class="{ collapsed: !app.state.leftOpen }" :title="app.state.leftOpen ? '隐藏左栏' : '显示左栏'" @click="app.toggleLeft()">
          {{ app.state.leftOpen ? '‹' : '›' }}
        </button>
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

    <!-- 更新完成弹窗：升级后首次启动自动弹出；也可从首选项「关于 → 更新记录」打开 -->
    <UpdateModal v-model="showUpdateModal" :update="updateHit" />
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
  width: 4px;
  background: var(--shell);
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
  background: var(--hover);
}
</style>
