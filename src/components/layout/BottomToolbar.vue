<script setup lang="ts">
// 底部上层工具栏：撤销/重做（常驻快捷入口，不再折叠在左栏面板内）+ 缩放 + 同步设置。
// 同步设置（对标 LrC「同步设置」）：把当前照片的全部装饰设置复制到图库中
// Ctrl/Shift 多选的其他照片（每张照片历史链各记一条「同步设置」节点，可撤销）。
import { computed, ref } from 'vue'
import { useViewer } from '../../composables/useViewer'
import { useHistory, applyTemplateToPhotos } from '../../composables/useHistory'
import { useLibrary } from '../../composables/useLibrary'
import { useTemplates } from '../../composables/useTemplates'
import { useFrameConfig } from '../../composables/useFrameConfig'
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
.zoom-val {
  font-size: 12px;
  color: var(--text-num);
  min-width: 42px;
  text-align: center;
  line-height: 16px;
}
</style>
