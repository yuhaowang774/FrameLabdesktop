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
import { editingPhoto, photoImage, runtimeError } from './composables/useUi'
import { resetBlurCaches } from './core/bgRenderer'
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

// 预览源长边上限：略超预览画布最大物理像素（~2400）。解码阶段直接降到该上限，
// 预览源内存恒定 ~25MB，与原图分辨率无关。上限越低，createImageBitmap 解码+
// 缩放的中间缓冲越小（96MP 全尺寸位图可达 366MB），2.5K 是质量/内存平衡点。
const PREVIEW_LONG_MAX = 2560

// 当前选中照片的图源
const photoSrc = ref<string | null>(null)
// 预览图源：解码阶段降采样的工作副本（桌面端为 Rust DCT 缩放解码的 canvas，
// 网页端为 createImageBitmap 降采样的 ImageBitmap，内存恒定 ~25MB，与原图分辨率无关）。
// 此前直接持有全尺寸 HTMLImageElement：96MP 图解码位图 ~366MB
// 且远超 Chromium 解码缓存的单图预算，预览链每次 drawImage 都触发完整重新解码，
// 进入编辑模块时连续数次的以原图为源的绘制造成数 GB 的瞬时分配风暴（OOM/卡死根因）。
// 原图仅在导出时经 srcBlob 临时全尺寸解码（ExportPanel 自行管理加载与 close 释放）。
const bgImage = ref<ImageBitmap | HTMLImageElement | HTMLCanvasElement | null>(null)

// 切换照片序列号：预加载期间若用户再次切换，过期请求直接丢弃，避免旧图覆盖新图
let switchSeq = 0
// 正在加载的照片 URL：96MP 一次完整加载链（读盘 IPC + 解码降采样）耗时数秒，
// 期间重复触发（进入编辑模块的 activeModule watch 等）必须直接跳过——
// 两个解码链并行叠加会造成数 GB 的瞬时分配峰值（内存尖峰/卡顿的直接来源）。
let loadingUrl: string | null = null

/** 释放预览图源：ImageBitmap 需显式 close 立即归还内存（GC 终结不可靠）；canvas 交给 GC */
function releasePreviewSource(src: ImageBitmap | HTMLImageElement | HTMLCanvasElement | null): void {
  if (src && typeof ImageBitmap !== 'undefined' && src instanceof ImageBitmap) {
    try {
      src.close()
    } catch {
      /* 已关闭 */
    }
  }
}

async function loadImage(url: string): Promise<ImageBitmap | HTMLImageElement | HTMLCanvasElement> {
  // 0) 桌面端 asset 协议：优先 Rust 侧 DCT 缩放解码（96MP 跨 IPC 仅 ~24MB RGBA）。
  //    渲染进程全程不物化全尺寸位图（createImageBitmap(blob, resize) 对 96MP 的
  //    ~3.9GB 瞬时分配是渲染进程 OOM 崩溃根因）。失败（非 JPEG/CMYK 等）走下方回退。
  const assetHit = url.match(/^(?:https?:\/\/asset\.localhost|asset:\/\/localhost)\/(.+)$/)
  if (assetHit) {
    try {
      const { readPreviewCanvas } = await import('./platform/fs')
      const canvas = await readPreviewCanvas(decodeURIComponent(assetHit[1]), PREVIEW_LONG_MAX)
      if (canvas) return canvas
    } catch {
      /* 回退到通用路径 */
    }
  }

  // 1) 取同源 blob：桌面端 asset 协议经 Rust 二进制 IPC 读盘（不依赖 asset 协议
  //    流式响应，也无 base64 中间副本），网页端 / 静态资源直接 fetch。
  let blob: Blob | null = null
  try {
    if (assetHit) {
      const { readLocalBlob } = await import('./platform/fs')
      blob = await readLocalBlob(decodeURIComponent(assetHit[1]))
    } else {
      blob = await (await fetch(url)).blob()
    }
  } catch {
    blob = null
  }

  if (blob) {
    // 2) 元数据探测宽高：用 blob 的 objectURL 加载 Image，onload 时仅元数据就绪
    //    （位图解码是懒执行的），随后 Image 无引用被回收——全尺寸位图全程不物化。
    const objUrl = URL.createObjectURL(blob)
    const meta = await new Promise<{ w: number; h: number }>((resolve) => {
      const im = new Image()
      im.onload = () => resolve({ w: im.naturalWidth, h: im.naturalHeight })
      im.onerror = () => resolve({ w: 0, h: 0 })
      im.src = objUrl
    })
    URL.revokeObjectURL(objUrl)

    // 3) createImageBitmap 解码阶段直接降采样到预览上限
    if (meta.w && meta.h) {
      const long = Math.max(meta.w, meta.h)
      try {
        if (long <= PREVIEW_LONG_MAX) {
          return await createImageBitmap(blob)
        }
        const f = PREVIEW_LONG_MAX / long
        return await createImageBitmap(blob, {
          resizeWidth: Math.max(1, Math.round(meta.w * f)),
          resizeHeight: Math.max(1, Math.round(meta.h * f)),
          // medium：预览源将被再次绘制到 ≤2x 显示尺寸，high 的多级中间缓冲
          // 在 96MP 源上成本巨大而视觉增益不可辨（缩略图管线同此实践）。
          resizeQuality: 'medium',
        })
      } catch {
        /* createImageBitmap 不可用/失败：走下方 Image 兜底 */
      }
    }
  }

  // 4) 兜底：传统 Image 路径（加载失败也继续，bgImage 尺寸为 0 不会崩溃）
  return await new Promise<HTMLImageElement>((resolve) => {
    const im = new Image()
    im.onload = () => resolve(im)
    im.onerror = () => resolve(im)
    im.src = url
    void im.decode?.().catch(() => {})
  })
}

async function loadActive() {
  const active = library.items.find((i) => i.id === library.activeId.value)
  if (!active) {
    photoSrc.value = null
    resetBlurCaches()
    releasePreviewSource(bgImage.value)
    bgImage.value = null
    return
  }
  // 同照片守卫：进入编辑模块等场景会再次触发本函数，照片源未变时跳过完整的
  // 读盘+解码链（96MP 一次全链的瞬时分配可达 GB 级，重复执行纯属浪费），仅恢复参数。
  if (bgImage.value && photoSrc.value === active.url) {
    history.loadCursorFor(active.id)
    return
  }
  // 加载中去重：首次加载尚未完成（读盘 IPC + 96MP 解码可达数秒）时，activeModule
  // watch 等重复触发直接跳过——两个解码链并行叠加会造成数 GB 瞬时分配峰值。
  // 此守卫必须在 switchSeq 自增之前：否则本次调用会作废进行中加载的 seq，照片永远不出。
  if (loadingUrl === active.url) {
    history.loadCursorFor(active.id)
    return
  }
  const seq = ++switchSeq
  loadingUrl = active.url
  // 切换全程挂起历史提交：大图解码期间（可达秒级）用户的开关/滑块操作会被随后的
  // loadCursorFor 参数恢复覆盖（实测竞态：切换后立即点击开关被重置 + 产生脏历史节点），
  // 挂起后此类"半路编辑"静默丢弃，最终状态与恢复的参数一致。计数式挂起，finally 恒复位。
  suspendCommit(true)
  try {
    // 1) 先预加载新图（期间不切换画面，避免旧背景+新主图错位 / 图片未就绪导致的空白闪烁）
    const im = await loadImage(active.url)
    if (seq !== switchSeq) return // 已切换到其他照片，丢弃本次结果
    // 2) 恢复该照片历史链当前步骤的参数
    //    先落盘待提交历史（此刻 state 仍是旧照片参数），避免切图后惰性快照误拍新照片参数
    await history.flushPending()
    await history.ensureChain(active.id)
    if (seq !== switchSeq) return
    // 3) 原子切换：图源、背景、历史参数在同一同步块内更新 → 单次渲染、单次 fit
    //    导入/切换属非编辑流程，历史提交在整个切换期间均被挂起
    history.loadCursorFor(active.id)
    // 先清渲染缓存再释放旧源：blur 缓存以「图像引用相等」为命中条件，会持着旧源
    // 阻止回收；顺序颠倒会导致旧 ImageBitmap 已 close 而缓存仍引用（绘制抛错）。
    resetBlurCaches()
    releasePreviewSource(bgImage.value)
    photoSrc.value = active.url
    bgImage.value = im
    photoImage.value = im
  } finally {
    if (loadingUrl === active.url) loadingUrl = null
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

// ===== 运行时错误弹窗：复制详情到剪贴板 =====
async function copyRuntimeError() {
  if (!runtimeError.value) return
  const text = `[${runtimeError.value.title}]\n${runtimeError.value.detail}\n版本: ${__APP_VERSION__}`
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    /* 剪贴板不可用：用户仍可手动选中详情文本 */
  }
}
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

// 窗口模式（宣传页 iframe，?window=1）：跳过图库，默认展示编辑界面
if (new URLSearchParams(location.search).get('window') === '1') app.setModule('develop')

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

    <!-- 运行时错误弹窗：报错可见、详情可复制（用户要求：报错必提醒、能定位问题） -->
    <Teleport to="body">
      <div v-if="runtimeError" class="rt-err-mask" @click.self="runtimeError = null">
        <div class="rt-err-box">
          <div class="rt-err-head">
            <span class="rt-err-title">⚠ 发生错误（{{ runtimeError.count > 1 ? `已合并 ${runtimeError.count} 次同类错误` : '运行时' }}）</span>
            <button class="rt-err-close" title="关闭" @click="runtimeError = null">×</button>
          </div>
          <div class="rt-err-body">
            <div class="rt-err-kind">{{ runtimeError.title }}</div>
            <pre class="rt-err-detail">{{ runtimeError.detail }}</pre>
            <p class="rt-err-hint">错误详情已自动记录到本地日志（AppData/FrameLab/logs）。可复制以下信息反馈给开发者。</p>
          </div>
          <div class="rt-err-foot">
            <button class="rt-err-btn" @click="copyRuntimeError">复制详情</button>
            <button class="rt-err-btn primary" @click="runtimeError = null">知道了</button>
          </div>
        </div>
      </div>
    </Teleport>
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

/* ===== 运行时错误弹窗 ===== */
.rt-err-mask {
  position: fixed;
  inset: 0;
  z-index: 1200;
  background: rgba(0, 0, 0, 0.55);
  display: flex;
  align-items: center;
  justify-content: center;
}
.rt-err-box {
  width: min(560px, 90vw);
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  background: var(--panel);
  border: 1px solid var(--border);
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.45);
}
.rt-err-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 34px;
  padding: 0 8px 0 14px;
  border-bottom: 1px solid var(--border);
}
.rt-err-title {
  font-size: 13px;
  color: var(--text);
}
.rt-err-close {
  width: 22px;
  height: 22px;
  border: none;
  background: transparent;
  color: var(--text-dim);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}
.rt-err-close:hover { background: var(--hover); color: var(--text); }
.rt-err-body {
  padding: 10px 14px;
  overflow: auto;
  min-height: 0;
}
.rt-err-kind {
  font-size: 12px;
  color: var(--text);
  margin-bottom: 6px;
}
.rt-err-detail {
  margin: 0;
  max-height: 220px;
  overflow: auto;
  background: var(--panel-2, rgba(255, 255, 255, 0.04));
  border: 1px solid var(--border);
  padding: 8px 10px;
  font-size: 11px;
  line-height: 16px;
  color: var(--text-dim);
  white-space: pre-wrap;
  word-break: break-all;
  user-select: text;
}
.rt-err-hint {
  margin: 8px 0 0;
  font-size: 11px;
  line-height: 16px;
  color: var(--text-dim);
}
.rt-err-foot {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 10px 14px;
  border-top: 1px solid var(--border);
}
.rt-err-btn {
  height: 26px;
  padding: 0 14px;
  background: var(--btn-bg);
  border: 1px solid var(--border);
  color: var(--text);
  font-size: 12px;
  cursor: pointer;
}
.rt-err-btn:hover { background: var(--hover); color: var(--text-normal); }
.rt-err-btn.primary {
  background: var(--accent);
  border-color: var(--accent);
}
</style>
