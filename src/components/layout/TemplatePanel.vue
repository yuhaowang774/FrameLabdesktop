<script setup lang="ts">
// 左侧模板库面板：按类别展示内置/自定义模板，点击应用，支持删除自定义模板。
// 模板条目上「⇉」= 批量应用到全部选中照片（无选中时应用到全部照片）。
import { computed, watch, reactive } from 'vue'
import { useTemplates, type TemplateCategory } from '../../composables/useTemplates'
import { useFrameConfig } from '../../composables/useFrameConfig'
import { useAppState } from '../../composables/useAppState'
import { useLibrary } from '../../composables/useLibrary'
import { applyTemplateToPhotos } from '../../composables/useHistory'
import { buildExifText, formatDate, cleanLens } from '../../composables/useExif'
import { templateThumbDataUrl, renderTemplateThumbDataUrl } from '../../core/templateThumb'

const props = defineProps<{ category: TemplateCategory }>()
const templates = useTemplates()
const { state, loadConfig } = useFrameConfig()
const app = useAppState()
const library = useLibrary()

// 背景模板库已取消；相框库展示 frame 类预设 + 用户自定义 all 类模板
const list = computed(() =>
  templates.templates.filter((t) => t.category === props.category || (props.category === 'frame' && t.category === 'all')),
)

// 缩略图：优先用真实照片 + exporter 完整合成（更美观）；失败或加载中回退到程序化 SVG
const thumbs = reactive<Record<string, string>>({})
watch(
  () => list.value.map((t) => t.id).join(','),
  () => {
    for (const t of list.value) {
      // 已渲染为真实图片的不再重复渲染；其余先放 SVG 占位，再异步合成
      if (thumbs[t.id] && !thumbs[t.id].startsWith('data:image/svg+xml')) continue
      if (!thumbs[t.id]) thumbs[t.id] = templateThumbDataUrl(t.config)
      void (async () => {
        try {
          thumbs[t.id] = await renderTemplateThumbDataUrl(t.config)
        } catch (e) {
          console.warn('缩略图真实渲染失败:', e)
        }
      })()
    }
  },
  { immediate: true },
)

// 批量应用目标：选中照片（无选中 = 全部）
const batchTargets = computed(() => {
  const sel = library.items.filter((i) => i.selected)
  return sel.length > 0 ? sel : library.items
})

function apply(t: { id: string }) {
  const found = templates.templates.find((x) => x.id === t.id)
  if (!found) return
  // INFO 文本（EXIF/日期/镜头）在「复位 INFO」时会被清空为 ''；模板不保存这些字段（保留照片 EXIF 语义），
  // 故此处兜底：若文本为空且照片仍保留 exifRaw，则从 raw 重新生成，避免应用模板后 INFO 参数行无内容。
  const raw = state.exifRaw
  const exifText = state.exifText || (raw ? buildExifText(raw, { eqFocal: state.eqFocal, cropFactor: state.cropFactor }) : '')
  const dateText = state.dateText || (raw?.dateTimeOriginal ? formatDate(raw.dateTimeOriginal, state.dateFormat) : '')
  const lensText = state.lensText || (raw ? cleanLens(raw.lensMake, raw.lensModel) ?? '' : '')
  // 模板不覆盖当前照片/变换/自身EXIF信息（与批量应用 keep 集合语义一致）；其余装饰参数整体按模板重置 → 右栏参数随之更新
  loadConfig({
    photoSrc: state.photoSrc,
    photoX: state.photoX,
    photoY: state.photoY,
    photoRotation: state.photoRotation,
    photoCrop: state.photoCrop,
    bgScale: state.bgScale,
    bgOffsetX: state.bgOffsetX,
    bgOffsetY: state.bgOffsetY,
    canvasH: state.canvasH,
    exifText,
    exifRaw: raw,
    dateText,
    cameraModel: state.cameraModel,
    brand: state.brand,
    lensText,
    // 保留用户对各 INFO 文本（EXIF/镜头/日期）的独立样式覆盖，不被模板默认覆盖
    exifFontFamily: state.exifFontFamily,
    exifFontSize: state.exifFontSize,
    exifTextWeight: state.exifTextWeight,
    exifTextOpacity: state.exifTextOpacity,
    lensFontFamily: state.lensFontFamily,
    lensFontSize: state.lensFontSize,
    lensTextWeight: state.lensTextWeight,
    lensTextOpacity: state.lensTextOpacity,
    dateFontFamily: state.dateFontFamily,
    dateFontSize: state.dateFontSize,
    dateTextWeight: state.dateTextWeight,
    dateTextOpacity: state.dateTextOpacity,
    ...found.config,
  })
  // 展开右栏「背景 / 边框」面板，方便查看模板参数并继续微调
  app.state.rightOpen = true
  app.setPanel('right', 'background', true)
  app.setPanel('right', 'border', true)
}

/** 批量应用：模板装饰参数写入每张目标照片的历史链（保留各照片 EXIF/型号/品牌/日期） */
async function applyBatch(t: { id: string; name: string }) {
  const found = templates.templates.find((x) => x.id === t.id)
  if (!found) return
  const ids = batchTargets.value.map((i) => i.id)
  if (!ids.length) return
  await applyTemplateToPhotos(ids, found.config, `应用模板「${found.name}」`)
  // 展开右栏方便微调
  app.state.rightOpen = true
  app.setPanel('right', 'background', true)
  app.setPanel('right', 'border', true)
}

function onRemove(e: Event, id: string) {
  e.stopPropagation()
  templates.remove(id)
}
</script>

<template>
  <div class="tpl-list">
    <p v-if="list.length === 0" class="hint">暂无模板。</p>
    <div v-for="t in list" :key="t.id" class="tpl-card" :title="`点击应用「${t.name}」`" @click="apply(t)">
      <div class="thumb">
        <img :src="thumbs[t.id]" :alt="t.name" draggable="false" />
      </div>
      <div class="meta">
        <span class="tname">{{ t.name }}</span>
        <span
          class="batch"
          :title="`批量应用到 ${batchTargets.length} 张照片（每张保留自身 EXIF/型号）`"
          @click.stop="applyBatch(t)"
        >⇉</span>
        <span v-if="t.builtin" class="tag">内置</span>
        <span v-else class="tag custom" title="删除该模板" @click="(e) => onRemove(e, t.id)">✕</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tpl-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.hint {
  color: var(--text-dim);
  font-size: 12px;
}
/* 模板卡片：上方为按 config 生成的样式缩略图，下方为名称与操作 */
.tpl-card {
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 0;
  cursor: pointer;
  overflow: hidden;
  color: var(--text);
  font-size: 12px;
  font-weight: 400;
}
.tpl-card:hover {
  background: var(--hover);
  color: var(--text-normal);
}
.tpl-card:active { background: var(--pressed); }
/* 缩略图区：底色略深，衬托白框类模板。
   图片宽度占满卡片、高度按模板画幅比例自适应 —— 左栏越宽缩略图越大；
   max-height 兜住竖版等超长比例模板，避免卡片被撑得过高。 */
.thumb {
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--panel-3);
  padding: 6px;
  overflow: hidden;
}
.thumb img {
  display: block;
  width: 100%;
  height: auto;
  max-height: 260px;
  object-fit: contain;
  pointer-events: none;
}
.meta {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 24px;
  padding: 0 6px;
  border-top: 1px solid var(--border);
}
.tname {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tag {
  font-size: 11px;
  font-weight: 400;
  color: var(--text-dim);
  background: var(--panel-3);
  border-radius: 0;
  padding: 0 6px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  line-height: 1;
}
/* 批量应用按钮：模板条目右侧 ⇉ */
.batch {
  font-size: 13px;
  color: var(--text-dim);
  padding: 0 4px;
  line-height: 16px;
}
.batch:hover {
  color: var(--text);
  background: var(--hover);
}
.tag.custom {
  cursor: pointer;
  color: var(--text-dim);
}
</style>
