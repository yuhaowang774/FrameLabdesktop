<script setup lang="ts">
// 左侧模板库面板：按类别展示内置/自定义模板，点击应用，支持删除自定义模板。
// 模板条目上「⇉」= 批量应用到全部选中照片（无选中时应用到全部照片）。
import { computed, watch, reactive, ref } from 'vue'
import { useTemplates, applyTemplateToState, type TemplateCategory } from '../../composables/useTemplates'
import { useAppState } from '../../composables/useAppState'
import { useLibrary } from '../../composables/useLibrary'
import { applyTemplateToPhotos } from '../../composables/useHistory'
import { templateThumbDataUrl, renderTemplateThumbDataUrl } from '../../core/templateThumb'
import GlassModal from '../common/GlassModal.vue'

const props = defineProps<{ category: TemplateCategory }>()
const templates = useTemplates()
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

// INFO 信息缺失提示弹窗：模板开启显示但未识别到内容的字段已用「自定义」占位
const missingOpen = ref(false)
const missingMsg = ref('')

function apply(t: { id: string }) {
  const found = templates.templates.find((x) => x.id === t.id)
  if (!found) return
  // 统一入口：模板只覆盖装饰/布局，保留当前照片的 EXIF/型号/品牌/文本与用户独立样式
  const missing = applyTemplateToState(found.config)
  // 展开右栏「背景 / 边框」面板，方便查看模板参数并继续微调
  app.state.rightOpen = true
  app.setPanel('right', 'background', true)
  app.setPanel('right', 'border', true)
  if (missing.length) {
    missingMsg.value = `当前照片未识别到以下 INFO 信息：${missing.join('、')}。已用「自定义」占位，可在右侧 INFO 面板手动填写。`
    missingOpen.value = true
  }
}

/** 批量应用：模板装饰参数写入每张目标照片的历史链（保留各照片 EXIF/型号/品牌/日期） */
async function applyBatch(t: { id: string; name: string }) {
  const found = templates.templates.find((x) => x.id === t.id)
  if (!found) return
  const ids = batchTargets.value.map((i) => i.id)
  if (!ids.length) return
  const anyMissing = await applyTemplateToPhotos(ids, found.config, `应用模板「${found.name}」`)
  // 展开右栏方便微调
  app.state.rightOpen = true
  app.setPanel('right', 'background', true)
  app.setPanel('right', 'border', true)
  if (anyMissing) {
    missingMsg.value = '部分照片未识别到 EXIF / 镜头 / 日期等信息，已用「自定义」占位，可在编辑页右侧 INFO 面板逐张手动填写。'
    missingOpen.value = true
  }
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
  <GlassModal v-model="missingOpen" title="INFO 信息缺失提示" :message="missingMsg" confirm-text="知道了" />
</template>

<style scoped>
/* 双列网格：模板数量增多后单列大卡片滚动成本过高；统一缩略图高度便于横向对比挑选 */
.tpl-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.hint {
  grid-column: 1 / -1;
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
/* 缩略图区：底色略深，衬托白框类模板。统一高度裁切（object-fit: contain），
   无论横竖版卡片高度一致，网格整齐、点击目标稳定 */
.thumb {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 110px;
  background: var(--panel-3);
  padding: 4px;
  overflow: hidden;
}
.thumb img {
  display: block;
  max-width: 100%;
  max-height: 100%;
  pointer-events: none;
}
.meta {
  display: flex;
  align-items: center;
  gap: 4px;
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
