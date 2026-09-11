<script setup lang="ts">
// 底部上层工具栏：撤销/重做（常驻快捷入口，不再折叠在左栏面板内）+ 缩放 + 同步设置。
// 同步设置（对标 LrC「同步设置」）：把当前照片的全部装饰设置复制到图库中
// Ctrl/Shift 多选的其他照片（每张照片历史链各记一条「同步设置」节点，可撤销）。
import { computed, ref } from 'vue'
import { useViewer } from '../../composables/useViewer'
import { useHistory, applyTemplateToPhotos } from '../../composables/useHistory'
import { useLibrary } from '../../composables/useLibrary'
import { useTemplates, applyTemplateToState } from '../../composables/useTemplates'
import { useFrameConfig } from '../../composables/useFrameConfig'
import type { FrameConfig } from '../../core/types'
import GlassModal from '../common/GlassModal.vue'

const viewer = useViewer()
const history = useHistory()
const library = useLibrary()
const templates = useTemplates()
const { state } = useFrameConfig()

// canUndo/canRedo 是普通函数：包一层 computed 以建立响应式依赖（内部读 cursor/records）
const canUndo = computed(() => history.canUndo())
const canRedo = computed(() => history.canRedo())

function zoomIn() {
  viewer.zoomBy(0.2)
}
function zoomOut() {
  viewer.zoomBy(-0.2)
}
function fitView() {
  viewer.resetView()
}

// ===== 同步设置（LR 式）：当前照片设置 → 多选照片 =====
// 目标 = 图库中已多选的其他照片；未多选时按钮禁用并提示操作方式。
const syncTargets = computed(() =>
  library.items.filter((i) => i.selected && i.id !== library.activeId.value),
)
const syncConfirmOpen = ref(false)
const syncResultOpen = ref(false)
const syncResultMsg = ref('')

function askSyncSettings() {
  if (!syncTargets.value.length) return
  syncConfirmOpen.value = true
}

async function doSyncSettings() {
  const ids = syncTargets.value.map((i) => i.id)
  syncConfirmOpen.value = false
  if (!ids.length) return
  // toTemplateConfig 剔除照片专属字段（位置/裁剪/EXIF 语义文本等），仅同步装饰设置；
  // applyTemplateToPhotos 会为每张照片保留其自身 EXIF 并自适应文字/Logo 颜色。
  const cfg = templates.toTemplateConfig(state)
  const anyMissing = await applyTemplateToPhotos(ids, cfg, '同步设置')
  syncResultMsg.value =
    `已将当前照片的设置同步到 ${ids.length} 张照片` +
    (anyMissing ? '；部分照片缺少 EXIF/镜头/日期信息，已用「自定义」占位。' : '。')
  syncResultOpen.value = true
}

// ===== 参数复制 / 粘贴 =====
// 复制：当前照片的装饰参数（toTemplateConfig，剔除照片内容与 EXIF 文本）序列化为 JSON 进剪贴板；
// 粘贴：从剪贴板解析并应用到当前照片（loadConfig 自动记入该照片历史链，可撤销）；
//       存在多选目标时先确认，一并同步过去（与「同步设置」同一链路，保留各自 EXIF）。
const flashMsg = ref('')
let flashTimer = 0
function flash(msg: string) {
  flashMsg.value = msg
  clearTimeout(flashTimer)
  flashTimer = window.setTimeout(() => (flashMsg.value = ''), 1600)
}

function parseParams(text: string): Partial<FrameConfig> | null {
  try {
    const obj = JSON.parse(text) as { kind?: string; config?: unknown } | unknown
    const c = (
      obj && typeof obj === 'object' && (obj as { kind?: string }).kind === 'framelab-params'
        ? (obj as { config: unknown }).config
        : obj
    ) as Record<string, unknown> | null
    if (c && typeof c === 'object' && !Array.isArray(c) && ('bgMode' in c || 'padding' in c || 'infoLayout' in c)) {
      return c as Partial<FrameConfig>
    }
    return null
  } catch {
    return null
  }
}

async function copyParams() {
  const text = JSON.stringify({ kind: 'framelab-params', version: 1, config: templates.toTemplateConfig(state) })
  let ok = false
  try {
    await navigator.clipboard.writeText(text)
    ok = true
  } catch {
    // 剪贴板 API 不可用（权限/上下文）：回退隐藏 textarea + execCommand
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.cssText = 'position:fixed;top:-999px;opacity:0'
      document.body.appendChild(ta)
      ta.select()
      ok = document.execCommand('copy')
      ta.remove()
    } catch {
      ok = false
    }
  }
  flash(ok ? '已复制' : '复制失败')
}

const pasteConfirmOpen = ref(false)
let pastedConfig: Partial<FrameConfig> | null = null

async function pasteParams() {
  let text = ''
  try {
    text = await navigator.clipboard.readText()
  } catch {
    text = ''
  }
  let cfg = parseParams(text)
  if (!cfg) {
    // readText 被拒 / 剪贴板非文本：弹输入框手动 Ctrl+V（双保险，保证粘贴路径永远可用）
    const manual = window.prompt('未从剪贴板读到有效参数。可将参数 JSON 粘贴到输入框后确定（先在 FrameLab 点「复制参数」生成）：')
    if (manual == null || manual.trim() === '') return
    cfg = parseParams(manual)
  }
  if (!cfg) {
    window.alert('参数格式无法识别：请先点「复制参数」生成参数 JSON，再进行粘贴。')
    return
  }
  pastedConfig = cfg
  if (syncTargets.value.length) {
    // 有多选目标：先确认「当前照片 + 选中照片」一起应用
    pasteConfirmOpen.value = true
    return
  }
  doApplyPasted()
}

function confirmPaste() {
  pasteConfirmOpen.value = false
  doApplyPasted()
}

function doApplyPasted() {
  const cfg = pastedConfig
  pastedConfig = null
  if (!cfg) return
  const missing = applyTemplateToState(cfg)
  const ids = syncTargets.value.map((i) => i.id)
  let syncedNote = ''
  if (ids.length) {
    void applyTemplateToPhotos(ids, cfg, '粘贴参数')
    syncedNote = `，并同步到 ${ids.length} 张选中照片`
  }
  syncResultMsg.value =
    '已将粘贴的参数应用到当前照片' + syncedNote +
    (missing.length ? '；部分 INFO 无数据，已用「自定义」占位。' : '。')
  syncResultOpen.value = true
}
</script>

<template>
  <div class="bottom-bar">
    <div class="group">
      <button class="tool" :disabled="!canUndo" title="撤销 (Ctrl+Z)" @click="history.undo()">↶ 撤销</button>
      <button class="tool" :disabled="!canRedo" title="重做 (Ctrl+Shift+Z)" @click="history.redo()">↷ 重做</button>
      <span class="sep" />
      <button
        class="tool"
        :disabled="!syncTargets.length"
        :title="syncTargets.length
          ? `把当前照片的相框/背景/INFO 设置同步到已选中的 ${syncTargets.length} 张照片`
          : '先在胶片条/图库按住 Ctrl 点击多选照片，再把当前照片的设置同步过去'"
        @click="askSyncSettings"
      >⇉ 同步设置</button>
      <span v-if="syncTargets.length" class="sync-count">{{ syncTargets.length }}</span>
      <span class="sep" />
      <button
        class="tool"
        title="复制当前照片的相框 / 背景 / INFO 参数到剪贴板（可粘贴到其它照片或跨窗口使用）"
        @click="copyParams"
      >⧉ 复制参数</button>
      <button
        class="tool"
        title="粘贴之前复制的参数到当前照片（存在多选照片时将询问是否一并同步）"
        @click="pasteParams"
      >📋 粘贴参数</button>
      <span v-if="flashMsg" class="flash-msg">{{ flashMsg }}</span>
    </div>

    <div class="group right">
      <span class="lbl">缩放</span>
      <button class="tool" @click="zoomOut">−</button>
      <span class="zoom-val">{{ Math.round(viewer.zoom.value * 100) }}%</span>
      <button class="tool" @click="zoomIn">＋</button>
      <button class="tool" @click="fitView">适配</button>
    </div>
  </div>

  <!-- 同步设置确认 -->
  <GlassModal
    v-model="syncConfirmOpen"
    title="同步设置"
    :message="`将把当前照片的相框 / 背景 / INFO 样式同步到已选中的 ${syncTargets.length} 张照片（各照片保留自身 EXIF 信息，可在各自历史中撤销）。确定继续？`"
    confirm-text="同步"
    cancel-text="取消"
    @confirm="doSyncSettings"
  />
  <!-- 粘贴参数确认（存在多选目标时） -->
  <GlassModal
    v-model="pasteConfirmOpen"
    title="粘贴参数"
    :message="`将把粘贴的参数应用到当前照片，并同步到已选中的 ${syncTargets.length} 张照片（各照片保留自身 EXIF 信息，可在各自历史中撤销）。确定继续？`"
    confirm-text="应用"
    cancel-text="仅当前照片"
    @confirm="confirmPaste"
    @cancel="doApplyPasted"
  />
  <GlassModal v-model="syncResultOpen" title="同步完成" :message="syncResultMsg" confirm-text="知道了" />
</template>

<style scoped>
.bottom-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  height: 26px;
  padding: 0 12px;
  background: var(--shell);
  border-bottom: 1px solid var(--border);
  flex-wrap: nowrap;
  overflow: hidden;
  font-size: 12px;
  line-height: 16px;
}
.group {
  display: flex;
  align-items: center;
  gap: 2px;
}
.group.right {
  flex: none;
}
.sep {
  width: 1px;
  height: 16px;
  background: var(--border);
  margin: 0 4px;
}
.lbl {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-dim);
  margin-right: 2px;
  line-height: 16px;
}
.tool {
  background: var(--panel-2);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 0;
  padding: 0 8px;
  height: 20px;
  font-size: 12px;
  font-weight: 400;
  line-height: 16px;
  cursor: pointer;
  white-space: nowrap;
}
.tool:hover {
  background: var(--hover);
  color: var(--text-normal);
}
.tool.on {
  background: var(--accent);
  color: var(--text-dim);
  border-color: var(--accent);
}
.tool:active { background: var(--pressed); }
.tool:disabled {
  opacity: 0.35;
  cursor: not-allowed;
}
.sync-count {
  min-width: 18px;
  text-align: center;
  font-size: 11px;
  color: var(--text-num);
  background: var(--panel-3);
  border: 1px solid var(--border);
  line-height: 14px;
  padding: 1px 0;
}
.flash-msg {
  font-size: 11px;
  color: var(--text-num);
  background: var(--panel-3);
  border: 1px solid var(--border);
  line-height: 14px;
  padding: 1px 6px;
  white-space: nowrap;
}
.zoom-val {
  font-size: 12px;
  color: var(--text-num);
  min-width: 42px;
  text-align: center;
  line-height: 16px;
}
</style>
