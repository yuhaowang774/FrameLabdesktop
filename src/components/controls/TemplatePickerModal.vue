<!-- src/components/controls/TemplatePickerModal.vue -->
<script setup lang="ts">
// 模板选择弹窗：左＝模板网格（内置/自定义分组），右＝当前照片+模板实时合成预览。
// 点击卡片即应用（applyTemplateToState）并保持弹窗打开，便于连续对比；底部「完成」/×/Esc/遮罩关闭。
import { ref, computed, reactive, watch, onMounted, onBeforeUnmount } from 'vue'
import { useTemplates, applyTemplateToState } from '../../composables/useTemplates'
import { applyTemplateToPhotos } from '../../composables/useHistory'
import { useAppState } from '../../composables/useAppState'
import { useLibrary } from '../../composables/useLibrary'
import { useFrameConfig } from '../../composables/useFrameConfig'
import { templateThumbDataUrl, renderTemplateThumbDataUrl, type ThumbInfoOverride } from '../../core/templateThumb'
import GlassModal from '../common/GlassModal.vue'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    category?: 'frame' | 'all'
    /** 仅显示「我的模板」（自定义模板）分组：左栏「我的模板」入口使用，附保存当前配置表单 */
    customOnly?: boolean
    /** 弹窗标题（默认「相框模板库」；我的模板入口传「我的模板」） */
    title?: string
  }>(),
  { category: 'frame', customOnly: false, title: '' },
)
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const templates = useTemplates()
const app = useAppState()
const library = useLibrary()
const { state } = useFrameConfig()

const list = computed(() => {
  if (props.customOnly) return templates.templates.filter((t) => !t.builtin)
  return props.category === 'frame'
    ? templates.templates.filter((t) => t.category === 'frame' || t.category === 'all')
    : templates.templates.filter((t) => t.category === props.category)
})

// ===== 保存当前配置为模板（customOnly 模式：保存表单内嵌弹窗顶部） =====
const saveName = ref('')
const savedTip = ref('')
let tipTimer: ReturnType<typeof setTimeout> | undefined
function onSaveCurrent() {
  const now = new Date()
  // 留空自动命名「我的模板 M.D」，多次保存也可区分
  const trimmed = saveName.value.trim() || `我的模板 ${now.getMonth() + 1}.${now.getDate()}`
  templates.saveCurrent(trimmed, state, 'all')
  saveName.value = ''
  savedTip.value = `已保存「${trimmed}」，点击卡片即可应用`
  clearTimeout(tipTimer)
  tipTimer = setTimeout(() => (savedTip.value = ''), 2500)
}
const builtinList = computed(() => list.value.filter((t) => t.builtin))
const customList = computed(() => list.value.filter((t) => !t.builtin))

const selectedId = ref<string | null>(null)
const selected = computed(
  () =>
    list.value.find((t) => t.id === selectedId.value) ??
    (props.customOnly ? null : builtinList.value[0]) ??
    null,
)
// desc 字段由后续任务加入 FrameTemplate；此处防御式读取避免类型错误
const selectedDesc = computed(() => {
  const raw = (selected.value as { desc?: string } | null)?.desc
  return raw || '自定义模板（导出/导入保存的参数预设）'
})

// 网格缩略图：SVG 即时占位 → 用「当前选中照片 + 模板」真实合成（photoSrc 缺省走内置示例图）。
// 照片切换（photoSrc）或 INFO 文本变化（previewInfo，与大预览同源）时重渲，
// 保证缩略图与右侧大预览、实际应用效果一致（此前网格固定用示意 INFO 文本，与实际不符）。
const thumbs = reactive<Record<string, string>>({})
const prevThumbSrc = ref<null | string>(null)
const prevThumbInfo = ref<ThumbInfoOverride | null | undefined>(null)
// 渲染批次号：新触发使旧批次作废，避免异步渲染完成后用过期结果覆盖新缩略图
let thumbSeq = 0

// 桌面端照片 src 是 Tauri asset 协议 URL（http://asset.localhost/...）：该来源绘制到 canvas
// 会因 CORS 污染画布，导致 exportFrame → toBlob 抛 SecurityError，缩略图合成失败回退 SVG（看不到照片）。
// 统一经 platform/fs.toDrawableUrl 读盘转 dataURL（同源可绘制）并缓存；网页端原样返回。
// 非 asset URL（blob:/data:）先短路，避免网页端/测试环境加载桌面端 fs 模块链。
let drawableCache: { src: string; dataUrl: string } | null = null
async function photoDrawableSrc(src: string | null): Promise<string | undefined> {
  if (!src) return undefined
  if (!/^(?:https?:\/\/asset\.localhost|asset:\/\/localhost)\//.test(src)) return src
  if (drawableCache?.src === src) return drawableCache.dataUrl
  const { toDrawableUrl } = await import('../../platform/fs')
  const u = await toDrawableUrl(src)
  drawableCache = { src, dataUrl: u }
  return u
}

// 当前照片的真实 INFO（exifText/dateText/cameraModel/lensText/brand，可留空）：
// 网格缩略图与右栏大预览共用，保证「缩略图 = 大预览 = 实际应用效果」三处一致。
// 声明须在下方网格缩略图 watch 之前（其 immediate 回调会立即读取本值）。
const previewInfo = computed<ThumbInfoOverride | undefined>(() => {
  const has = state.exifText || state.dateText || state.cameraModel || state.lensText
  return has
    ? {
        exifText: state.exifText || undefined,
        dateText: state.dateText || undefined,
        cameraModel: state.cameraModel || undefined,
        lensText: state.lensText || undefined,
        brand: state.brand || undefined,
      }
    : undefined
})

watch(
  () => [list.value.map((t) => t.id).join(','), state.photoSrc, previewInfo.value] as const,
  () => {
    const src = state.photoSrc || null
    const info = previewInfo.value
    const ctxChanged = src !== prevThumbSrc.value || info !== prevThumbInfo.value
    prevThumbSrc.value = src
    prevThumbInfo.value = info
    const seq = ++thumbSeq
    drawableCache = null // 照片切换后缓存失效
    for (const t of list.value) {
      const cachedReal = thumbs[t.id] && !thumbs[t.id].startsWith('data:image/svg')
      if (!ctxChanged && cachedReal) continue
      // 静默换图：已有真实缩略图时保留旧图作底，后台重渲完成后直接替换，
      // 不回退 SVG 占位图——点击卡片应用模板会改写 INFO（日期格式重排/回填）触发重渲，
      // 先重置占位图会造成整排缩略图闪烁。
      if (!cachedReal) thumbs[t.id] = templateThumbDataUrl(t.config)
      void (async () => {
        try {
          const ds = await photoDrawableSrc(src)
          const url = await renderTemplateThumbDataUrl(t.config, ds, 480, info)
          if (seq === thumbSeq) thumbs[t.id] = url
        } catch {
          /* templateThumb 已内建 SVG 兜底 */
        }
      })()
    }
  },
  { immediate: true },
)

// 右栏大预览：选中模板 + 当前编辑照片合成（photoSrc 缺省时走内置示例图）。
// INFO 复用上方 previewInfo（当前照片真实内容），
// 点击卡片应用后 state 回填真实信息 → watch 依赖 info 实时重渲，预览即「应用后效果」。
const previewId = ref<string | null>(null)
const previewUrl = ref('')
watch(
  () => [selected.value?.id, previewInfo.value, state.photoSrc] as const,
  () => {
    const t = selected.value
    if (!t) return
    previewId.value = t.id
    // 静默换图：已有预览图时保留旧图作底，重渲完成后直接替换，避免 SVG 占位闪烁
    if (!previewUrl.value || previewUrl.value.startsWith('data:image/svg')) {
      previewUrl.value = templateThumbDataUrl(t.config)
    }
    void (async () => {
      try {
        const photoSrc = await photoDrawableSrc(state.photoSrc || null)
        const url = await renderTemplateThumbDataUrl(t.config, photoSrc, 960, previewInfo.value)
        if (previewId.value === t.id) previewUrl.value = url
      } catch {
        // 渲染异常：回退 SVG 示意图，避免停留在上一个模板的旧图上
        if (previewId.value === t.id) previewUrl.value = templateThumbDataUrl(t.config)
      }
    })()
  },
  { immediate: true }, // 打开弹窗即渲染默认选中模板（内置第一项）的大预览
)

// ===== 应用 / 批量 / 删除 =====
const missingOpen = ref(false)
const missingMsg = ref('')

const batchTargets = computed(() => {
  const sel = library.items.filter((i) => i.selected)
  return sel.length > 0 ? sel : library.items
})

function selectAndApply(t: { id: string }) {
  const found = templates.templates.find((x) => x.id === t.id)
  if (!found) return
  selectedId.value = t.id
  const missing = applyTemplateToState(found.config)
  app.state.rightOpen = true
  app.setPanel('right', 'background', true)
  app.setPanel('right', 'border', true)
  if (missing.length) {
    missingMsg.value = `当前照片未识别到以下 INFO 信息：${missing.join('、')}。已用「自定义」占位，可在右侧 INFO 面板手动填写。`
    missingOpen.value = true
  }
}

async function applyBatch(t: { id: string; name: string }) {
  const found = templates.templates.find((x) => x.id === t.id)
  if (!found) return
  const ids = batchTargets.value.map((i) => i.id)
  if (!ids.length) return
  const anyMissing = await applyTemplateToPhotos(ids, found.config, `应用模板「${found.name}」`)
  app.state.rightOpen = true
  app.setPanel('right', 'background', true)
  app.setPanel('right', 'border', true)
  if (anyMissing) {
    missingMsg.value = '部分照片未识别到 EXIF / 镜头 / 日期等信息，已用「自定义」占位，可在编辑页右侧 INFO 面板逐张手动填写。'
    missingOpen.value = true
  }
}

function removeCustom(t: { id: string }) {
  templates.remove(t.id)
  if (selectedId.value === t.id) selectedId.value = null
}

// ===== 重命名自定义模板 =====
const renameOpen = ref(false)
const renameId = ref('')
const renameValue = ref('')
function askRename(t: { id: string; name: string }) {
  renameId.value = t.id
  renameValue.value = t.name
  renameOpen.value = true
}
function doRename(newName: string) {
  if (renameId.value) templates.rename(renameId.value, newName)
  renameOpen.value = false
}

// 关闭
function close() {
  emit('update:modelValue', false)
}
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  clearTimeout(tipTimer)
})
</script>

<template>
  <Teleport to="body">
    <div v-if="modelValue" class="tp-mask" @click.self="close">
      <div class="tp-modal">
        <div class="tp-head">
          <span class="tp-title">{{ props.title || '相框模板库' }}</span>
          <span class="tp-count" v-if="list.length">共 {{ list.length }} 套</span>
          <button class="tp-close" title="关闭 (Esc)" @click="close">✕</button>
        </div>

        <div class="tp-body">
          <!-- 左：模板网格 -->
          <div class="tp-col tp-grid-col">
            <!-- 我的模板模式：顶部内嵌「保存当前配置」表单 -->
            <div v-if="customOnly" class="tp-save">
              <input
                v-model="saveName"
                class="tp-save-inp"
                placeholder="模板名称（留空自动命名）"
                maxlength="30"
                @keydown.enter="onSaveCurrent"
              />
              <button class="tp-save-btn" @click="onSaveCurrent">保存当前配置</button>
            </div>
            <p v-if="customOnly && savedTip" class="tp-save-tip">{{ savedTip }}</p>
            <p v-if="list.length === 0" class="tp-empty">
              {{ customOnly ? '还没有自定义模板。调好样式后点上方按钮保存。' : '暂无模板。' }}
            </p>
            <template v-else>
              <h4 class="tp-group" v-if="!customOnly && builtinList.length">内置模板（{{ builtinList.length }}）</h4>
              <div class="tp-grid">
                <div
                  v-for="t in builtinList"
                  :key="t.id"
                  class="tp-card"
                  :class="{ active: selected?.id === t.id }"
                  @click="selectAndApply(t)"
                >
                  <img class="tp-card-thumb" :src="thumbs[t.id]" :alt="t.name" draggable="false" />
                  <div class="tp-card-meta">
                    <span class="tp-card-name">{{ t.name }}</span>
                    <span class="tp-card-desc" v-if="t.desc">{{ t.desc }}</span>
                    <span class="tp-card-batch" title="批量应用到选中照片（无选中=全部）" @click.stop="applyBatch(t)">⇉</span>
                  </div>
                </div>
              </div>
              <h4 class="tp-group" v-if="customList.length">我的模板（{{ customList.length }}）</h4>
              <div class="tp-grid">
                <div
                  v-for="t in customList"
                  :key="t.id"
                  class="tp-card"
                  :class="{ active: selected?.id === t.id }"
                  @click="selectAndApply(t)"
                >
                  <img class="tp-card-thumb" :src="thumbs[t.id]" :alt="t.name" draggable="false" />
                  <div class="tp-card-meta">
                    <span class="tp-card-name">{{ t.name }}</span>
                    <span class="tp-card-desc tp-card-desc-custom">自定义模板</span>
                    <span class="tp-card-ren" title="重命名" @click.stop="askRename(t)">✎</span>
                    <span class="tp-card-del" title="删除该模板" @click.stop="removeCustom(t)">✕</span>
                  </div>
                </div>
              </div>
            </template>
          </div>

          <!-- 右：大预览 -->
          <div class="tp-col tp-preview-col">
            <template v-if="selected">
              <div class="tp-preview-box">
                <img class="tp-preview-img" :src="previewUrl" :alt="selected.name" draggable="false" />
              </div>
              <div class="tp-preview-meta">
                <div class="tp-preview-name">{{ selected.name }}</div>
                <div class="tp-preview-desc">{{ selectedDesc }}</div>
              </div>
              <button class="btn batch-main" :disabled="batchTargets.length === 0" @click="applyBatch(selected)">
                ⇉ 批量应用到 {{ batchTargets.length ? batchTargets.length : '全部' }} 张
              </button>
            </template>
            <p v-else class="tp-preview-empty">暂无模板可选</p>
          </div>
        </div>

        <div class="tp-foot">
          <span class="tp-hint">点击卡片即实时应用到当前照片，可对比挑选</span>
          <button class="btn tp-done" @click="close">完成</button>
        </div>
      </div>
    </div>
  </Teleport>

  <GlassModal v-model="missingOpen" title="INFO 信息缺失提示" :message="missingMsg" confirm-text="知道了" />

  <!-- 重命名模板 -->
  <GlassModal
    v-model="renameOpen"
    title="重命名模板"
    message="输入新的模板名称："
    input-mode
    :input-value="renameValue"
    input-placeholder="模板名称"
    confirm-text="确定"
    @confirm="doRename"
  />
</template>

<style scoped>
.tp-mask {
  position: fixed; inset: 0; z-index: 1100;
  background: rgba(0, 0, 0, 0.6);
  display: flex; align-items: center; justify-content: center;
}
.tp-modal {
  width: min(1120px, 94vw); height: min(720px, 94vh);
  display: flex; flex-direction: column;
  background: var(--panel); border: 1px solid var(--border);
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.45);
  color: var(--text); border-radius: 0;
}
.tp-head {
  display: flex; align-items: center; gap: 10px;
  height: 40px; padding: 0 14px;
  border-bottom: 1px solid var(--border); flex: none;
}
.tp-title { flex: 1; font-size: 14px; font-weight: 500; }
.tp-count { font-size: 12px; color: var(--text-dim); }
.tp-close {
  width: 26px; height: 26px; cursor: pointer;
  background: transparent; border: 1px solid transparent;
  color: var(--text-dim); font-size: 13px; line-height: 24px;
}
.tp-close:hover { background: var(--hover); color: var(--text); }
.tp-body { flex: 1; display: grid; grid-template-columns: 2fr 5fr; min-height: 0; }
.tp-col { min-height: 0; overflow-y: auto; padding: 12px; }
.tp-grid-col { border-right: 1px solid var(--border); }
.tp-group {
  margin: 4px 0 8px; font-size: 12px; font-weight: 400;
  color: var(--text-dim); letter-spacing: 0;
}
.tp-grid { display: grid; grid-template-columns: repeat(1, minmax(0, 1fr)); gap: 10px; margin-bottom: 14px; }
.tp-card {
  position: relative;
  border: 1px solid var(--border); background: var(--panel-2);
  cursor: pointer; overflow: hidden;
}
.tp-card:hover { background: var(--hover); }
.tp-card.active { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
.tp-card-thumb { display: block; width: 100%; height: 190px; object-fit: contain; background: var(--panel-3); }
.tp-card-meta { display: flex; align-items: baseline; gap: 6px; padding: 5px 8px 6px; }
.tp-card-name { flex: none; font-size: 12px; max-width: 45%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tp-card-desc { flex: 1; min-width: 0; font-size: 11px; color: var(--text-dim); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tp-card-batch, .tp-card-del {
  position: absolute; top: 6px; right: 6px;
  width: 22px; height: 22px; line-height: 20px; text-align: center;
  cursor: pointer; color: var(--text-dim); font-size: 13px;
  background: rgba(0, 0, 0, 0.35); border: 1px solid transparent;
}
.tp-card-batch:hover, .tp-card-del:hover, .tp-card-ren:hover { color: var(--text); background: rgba(0, 0, 0, 0.6); border-color: var(--border); }
.tp-card-del { right: 30px; }
.tp-card-ren { right: 54px; }
.tp-empty { color: var(--text-dim); font-size: 12px; }
/* 我的模板模式：顶部保存当前配置表单 */
.tp-save { display: flex; gap: 6px; }
.tp-save-inp {
  flex: 1; min-width: 0; height: 26px; padding: 0 8px;
  border: 1px solid var(--border); background: var(--panel-2);
  color: var(--text); font-size: 12px; font-family: inherit;
}
.tp-save-inp:focus { outline: none; border-color: var(--accent); }
.tp-save-inp::placeholder { color: var(--text-dim); }
.tp-save-btn {
  flex: none; height: 26px; padding: 0 12px;
  border: 1px solid var(--accent); background: var(--accent);
  color: var(--text); font-size: 12px; line-height: 16px;
  cursor: pointer; font-family: inherit;
}
.tp-save-btn:hover { filter: brightness(1.08); }
.tp-save-btn:active { background: var(--pressed); }
.tp-save-tip { font-size: 11px; color: var(--text); }
.tp-preview-col { display: flex; flex-direction: column; align-items: stretch; gap: 10px; }
.tp-preview-box {
  flex: 1; display: flex; align-items: center; justify-content: center;
  background: var(--panel-3); border: 1px solid var(--border); min-height: 0;
}
.tp-preview-img { max-width: 100%; max-height: 100%; object-fit: contain; }
.tp-preview-empty { color: var(--text-dim); font-size: 12px; }
.tp-preview-name { font-size: 14px; font-weight: 500; }
.tp-preview-desc { font-size: 12px; color: var(--text-dim); }
.btn {
  height: 26px; padding: 0 14px; cursor: pointer;
  border: 1px solid var(--border); background: var(--btn-bg);
  color: var(--text); font-size: 12px; font-weight: 400; line-height: 16px;
}
.btn:hover { background: var(--hover); color: var(--text-normal); }
.btn:active { background: var(--pressed); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.batch-main { align-self: flex-start; }
.tp-foot {
  flex: none; display: flex; align-items: center; gap: 10px;
  height: 42px; padding: 0 14px;
  border-top: 1px solid var(--border);
}
.tp-hint { flex: 1; font-size: 12px; color: var(--text-dim); }
.tp-done { min-width: 72px; background: var(--accent); border-color: var(--accent); }

@media (max-width: 768px) {
  .tp-body { grid-template-columns: 1fr; grid-template-rows: 1fr 1fr; }
  .tp-grid-col { border-right: none; border-bottom: 1px solid var(--border); }
  .tp-preview-box { min-height: 120px; }
}
</style>