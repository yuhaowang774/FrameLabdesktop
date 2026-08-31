<script setup lang="ts">
// 顶部区域：Logo + 模块切换器 + 全局设置/帮助 + 任务进度条。
// 「首选项」弹窗由原生菜单「文件 → 首选项…」（或 Ctrl+,）触发，含独显加速设置。
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useAppState, type ModuleTab } from '../../composables/useAppState'
import { isTauri } from '../../platform/env'
import PreferencesModal from './PreferencesModal.vue'

const app = useAppState()

const tabs: { id: ModuleTab; label: string }[] = [
  { id: 'library', label: '图库' },
  { id: 'develop', label: '编辑' },
  { id: 'export', label: '导出' },
]

// ===== 使用指南（#10 应用内引导）：覆盖评论区高频「怎么用」问题 =====
// 「?」按钮触发；首次启动自动弹出一次（localStorage 标记）。
const guideOpen = ref(false)
const GUIDE_SEEN_KEY = 'frame-guide-seen'
function onHelp() {
  guideOpen.value = true
}
try {
  if (!localStorage.getItem(GUIDE_SEEN_KEY)) {
    guideOpen.value = true
    localStorage.setItem(GUIDE_SEEN_KEY, '1')
  }
} catch {
  /* localStorage 不可用时仅手动触发 */
}

// ===== 首选项弹窗 =====
// 桌面端由原生菜单「文件 → 首选项…」/ Ctrl+, 触发；网页端通过顶栏 ⚙ 打开。
const prefOpen = ref(false)

let unlisten: (() => void) | null = null
async function setupPrefMenu() {
  if (!isTauri) return
  const { listen } = await import('@tauri-apps/api/event')
  unlisten = await listen<string>('framelab://menu', (e) => {
    if (e.payload === 'preferences') prefOpen.value = true
  })
}
function openPrefs() {
  prefOpen.value = true
}
onMounted(() => {
  void setupPrefMenu()
})
onBeforeUnmount(() => {
  unlisten?.()
  unlisten = null
})
</script>

<template>
  <header class="topbar">
    <div class="left">
      <div class="logo">◎ Frame<span>Lab</span></div>
    </div>

    <nav class="module-switch">
      <button
        v-for="t in tabs"
        :key="t.id"
        class="mod"
        :class="{ on: app.activeModule.value === t.id }"
        @click="app.setModule(t.id)"
      >
        {{ t.label }}
      </button>
    </nav>

    <div class="right">
      <button class="icon-btn" title="隐藏/显示胶片条" @click="app.toggleFilmstrip()">
        {{ app.state.filmstripVisible ? '▭' : '▯' }}
      </button>
      <button class="icon-btn" title="首选项" @click="openPrefs">⚙</button>
      <button class="icon-btn" title="帮助" @click="onHelp">?</button>
    </div>

    <!-- 全局任务进度条（导出/合成） -->
    <div v-if="app.task.active" class="task-bar">
      <span class="task-label">{{ app.task.label }}</span>
      <div class="task-track">
        <div
          class="task-fill"
          :class="{ indet: !app.task.progress }"
          :style="app.task.progress ? { width: Math.round(app.task.progress * 100) + '%' } : undefined"
        />
      </div>
      <span class="task-pct">{{ app.task.progress ? Math.round(app.task.progress * 100) + '%' : '…' }}</span>
    </div>

    <!-- 使用指南：高频问题速查（评论区反馈「找不到批量/logo/开关逻辑」等） -->
    <Teleport to="body">
      <div v-if="guideOpen" class="guide-mask" @click.self="guideOpen = false">
        <div class="guide-box">
          <div class="guide-head">
            <span class="guide-title">使用指南</span>
            <button class="guide-close" title="关闭" @click="guideOpen = false">×</button>
          </div>
          <div class="guide-body">
            <div class="guide-sec">
              <div class="guide-h">工作流</div>
              <p>图库（导入照片/文件夹）→ 编辑（右侧调参 + 画布拖拽）→ 导出（单张/批量）。底部胶片条点击切换照片，←/→ 快捷键翻页。</p>
            </div>
            <div class="guide-sec">
              <div class="guide-h">批量出图</div>
              <p>① 编辑页左侧「相框模板库」条目右侧 ⇉ = 一键应用到全部选中照片；② 导出页勾选照片后「批量导出」；勾选「批量回填」每张使用自身 EXIF/型号/品牌；「文本映射」可按规则批量替换文本（每行 查找 =&gt; 替换）。</p>
            </div>
            <div class="guide-sec">
              <div class="guide-h">INFO 信息层（开关逻辑）</div>
              <p>右侧「INFO信息设置」各板块需勾选板块内的「显示」开关，元素才会出现在画布上；展开面板后可直接拖拽元素定位（近中心自动吸附）。EXIF/镜头/日期支持自动识别（镜头为可选手动开关）。</p>
            </div>
            <div class="guide-sec">
              <div class="guide-h">查看细节</div>
              <p>画布上滚轮缩放、双击 2x 放大/复位、Esc 复位视图；放大后拖拽平移画布。</p>
            </div>
            <div class="guide-sec">
              <div class="guide-h">格式与隐私</div>
              <p>支持导入 JPG/PNG/WebP/GIF/BMP/AVIF（HEIC/RAW 请先转格式）；导出 PNG 无损 / JPG 高画质，按原始像素合成。所有处理均在本地完成，原图不上传。</p>
            </div>
          </div>
          <div class="guide-foot">
            <button class="guide-btn" @click="guideOpen = false">开始使用</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- 首选项弹窗（菜单「文件 → 首选项…」/ 顶栏 ⚙ 均可打开） -->
    <PreferencesModal v-if="prefOpen" @close="prefOpen = false" />
  </header>
</template>

<style scoped>
.topbar {
  position: relative;
  display: flex;
  align-items: center;
  gap: 12px;
  height: 32px;
  padding: 0 12px;
  background: var(--shell);
  color: var(--text);
  border-bottom: 1px solid var(--border);
}
.left {
  flex: none;
}
.logo {
  font-size: 13px;
  font-weight: 400;
  letter-spacing: 0;
  color: var(--text);
  line-height: 18px;
}
.logo span {
  color: var(--text-dim);
}
.module-switch {
  display: flex;
  gap: 0;
  background: var(--panel);
  border: 1px solid var(--border);
  height: 22px;
}
.mod {
  background: none;
  border: none;
  color: var(--text-dim);
  padding: 0 14px;
  border-radius: 0;
  font-size: 12px;
  font-weight: 400;
  line-height: 16px;
  cursor: pointer;
  border-right: 1px solid var(--border);
}
.mod:last-child { border-right: none; }
.mod:hover { background: var(--hover); color: var(--text); }
.mod.on {
  background: var(--accent);
  color: var(--text-dim);
}
.mod:active { background: var(--pressed); }
.right {
  margin-left: auto;
  display: flex;
  gap: 4px;
}
.icon-btn {
  width: 24px;
  height: 22px;
  border-radius: 0;
  border: 1px solid var(--border);
  background: var(--panel-2);
  color: var(--text-dim);
  cursor: pointer;
  font-size: 12px;
  line-height: 16px;
  padding: 0;
}
.icon-btn:hover { background: var(--hover); color: var(--text); }
.task-bar {
  position: absolute;
  left: 12px;
  right: 12px;
  bottom: -1px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 12px;
  height: 22px;
  transform: translateY(100%);
  background: var(--shell);
  border: 1px solid var(--border);
  border-top: none;
  border-radius: 0;
  z-index: 20;
}
.task-label {
  font-size: 12px;
  font-weight: 400;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 16px;
}
.task-track {
  flex: 1;
  height: 4px;
  background: var(--slider-track);
  border-radius: 0;
  overflow: hidden;
}
.task-fill {
  height: 100%;
  background: var(--slider-thumb);
  transition: width 0.2s;
}
/* 长渲染阶段（进度暂为 0，如单张 96MP 渲染）：流动条提示任务进行中 */
.task-fill.indet {
  width: 30%;
  transition: none;
  animation: task-indet 1.2s linear infinite;
}
@keyframes task-indet {
  from { transform: translateX(-100%); }
  to { transform: translateX(333%); }
}
.task-pct {
  font-size: 11px;
  color: var(--text-dim);
  min-width: 34px;
  text-align: right;
}

/* ===== 使用指南弹窗（复用首选项弹窗的视觉规范：无圆角/磨砂面板） ===== */
.guide-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.guide-box {
  width: min(560px, 92vw);
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  background: var(--panel);
  border: 1px solid var(--border);
}
.guide-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 32px;
  padding: 0 8px 0 12px;
  border-bottom: 1px solid var(--border);
  flex: none;
}
.guide-title {
  font-size: 13px;
  font-weight: 400;
  line-height: 18px;
  color: var(--text);
}
.guide-close {
  width: 22px;
  height: 22px;
  border: none;
  background: transparent;
  color: var(--text-dim);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}
.guide-close:hover {
  background: var(--hover);
  color: var(--text);
}
.guide-body {
  overflow: auto;
  padding: 12px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.guide-sec .guide-h {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0;
  margin-bottom: 4px;
}
.guide-sec p {
  margin: 0;
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
  color: var(--text);
}
.guide-foot {
  flex: none;
  display: flex;
  justify-content: flex-end;
  padding: 10px 12px;
  border-top: 1px solid var(--border);
}
.guide-btn {
  background: var(--accent);
  border: 1px solid var(--accent);
  color: var(--text);
  border-radius: 0;
  padding: 0 16px;
  height: 26px;
  font-size: 12px;
  font-weight: 400;
  line-height: 16px;
  cursor: pointer;
}
.guide-btn:hover {
  background: var(--hover);
}
</style>
