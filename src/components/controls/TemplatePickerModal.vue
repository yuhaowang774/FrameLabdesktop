<!-- src/components/controls/TemplatePickerModal.vue -->
<script setup lang="ts">
// 模板选择弹窗：左侧**分类目录**（最近使用/我的模板/风格分组）+ 右侧完整分段瀑布流
// （多列，窄屏递减；卡片按模板真实比例展示，高度自然错落）+ 底部操作栏。
// 交互（2026-09-16 用户要求，取代 09-13 的「点分类=筛选单类」）：右栏恒为完整列表，
// 点左栏分类只把列表滚到对应段，滚过去之后还能继续往下滑到下一个分类区域；
// 滚动时左栏对应项高亮，指示「当前所在分类」。
// 点卡片先出预览确认层（2026-09-15 用户拍板），满意「确认应用」才应用并返回编辑。
// 卡片缩略图用**该模板自己的样张照片**真实合成（core/templateSamples.ts；自定义模板无样张时
// 回退当前照片/内置示例图）。界面不使用彩色 Emoji（AGENTS.md UI 设计要求），图标用纯文本符号。
import { ref, computed, reactive, watch, onMounted, onBeforeUnmount } from 'vue'
import { useTemplates, applyTemplateToState, recordRecentUsage } from '../../composables/useTemplates'
import { useAppState } from '../../composables/useAppState'
import { useFrameConfig } from '../../composables/useFrameConfig'
import { templateThumbDataUrl, renderTemplateThumbDataUrl, type ThumbInfoOverride } from '../../core/templateThumb'
import { sampleForTemplate } from '../../core/templateSamples'
import type { ImgSource } from '../../core/bgRenderer'
import { photoImage } from '../../composables/useUi'
import GlassModal from '../common/GlassModal.vue'
import { HIDDEN_TEMPLATE_GROUPS, isTemplateVisible } from '../../core/templateVisibility'

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
const { state } = useFrameConfig()

const list = computed(() => {
  if (props.customOnly) return templates.templates.filter((t) => !t.builtin)
  const byCategory =
    props.category === 'frame'
      ? templates.templates.filter((t) => t.category === 'frame' || t.category === 'all')
      : templates.templates.filter((t) => t.category === props.category)
  // 隐藏分组（2026-09-18 用户人工审查）在入口处就滤掉：计数、分段、最近使用随之保持一致
  return byCategory.filter(isTemplateVisible)
})

// ===== 视图状态：搜索 + 左侧目录（2026-09-16 用户要求）=====
// 左栏是**目录索引**而不是筛选器：右侧恒为完整的分段列表（段顺序 = 侧栏顺序），
// 点左侧分类只把列表滚到对应段，滚到该段后还能继续往下滑到下一个分类区域。
// 界面不使用彩色 Emoji（AGENTS.md）：搜索框无图标，用途由 placeholder 表达。
const TEMPLATE_GROUPS = ['经典', '极简轻量', '杂志编辑', '胶片复古', '暗调影廊', '联名卡', '社交尺寸', '水印署名', '多彩色卡', '大师水印', '日历边框', '运动边框', '设备样机', '纸品印刷', '创意排版'] as const
/** 实际展示的分组 = 全量顺序去掉隐藏表里的那些（左栏目录与右栏分段都用它） */
const VISIBLE_GROUPS = TEMPLATE_GROUPS.filter((g) => !HIDDEN_TEMPLATE_GROUPS.includes(g))
const search = ref('')

const customAll = computed(() => list.value.filter((t) => !t.builtin))
const builtinAll = computed(() => list.value.filter((t) => t.builtin))
const groupCounts = computed<Record<string, number>>(() => {
  const counts: Record<string, number> = {}
  for (const t of builtinAll.value) {
    if (t.group) counts[t.group] = (counts[t.group] ?? 0) + 1
  }
  return counts
})

/** 搜索关键词（名称 / 说明）命中判断 */
const q = computed(() => search.value.trim().toLowerCase())
const hit = (t: { name: string; desc?: string }) =>
  !q.value || t.name.toLowerCase().includes(q.value) || (t.desc ?? '').toLowerCase().includes(q.value)

/** 我的模板（自定义模板，经搜索过滤） */
const customItems = computed(() => customAll.value.filter(hit))
/** 最近使用（按最近使用顺序排列的内置模板；用记录里属于本库的模板，徽标与段计数一致） */
const recentAll = computed(() => {
  const order = new Map(templates.recentIds.map((id, i) => [id, i]))
  return builtinAll.value.filter((t) => order.has(t.id)).sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
})
const recentItems = computed(() => recentAll.value.filter(hit))

/**
 * 主列表分段：段顺序 = 侧栏顺序（最近使用 → 风格分组 → 其他 → 我的模板）。
 * 「最近使用」「我的模板」两段恒在（无内容时给引导文案），保证侧栏每一项都有落点；
 * 搜索时只保留有命中的段。
 */
const sections = computed(() => {
  const out: Array<{ key: string; title: string; items: typeof list.value }> = []
  if (props.customOnly) {
    if (customItems.value.length) out.push({ key: 'custom', title: '我的模板', items: customItems.value })
    return out
  }
  if (recentItems.value.length || !q.value) out.push({ key: 'recent', title: '最近使用', items: recentItems.value })
  for (const g of VISIBLE_GROUPS) {
    const items = builtinAll.value.filter((t) => t.group === g && hit(t))
    if (items.length) out.push({ key: `g:${g}`, title: g, items })
  }
  const rest = builtinAll.value.filter((t) => !(TEMPLATE_GROUPS as readonly string[]).includes(t.group ?? '') && hit(t))
  if (rest.length) out.push({ key: 'g:其他', title: '其他', items: rest })
  if (customItems.value.length || !q.value) out.push({ key: 'custom', title: '我的模板', items: customItems.value })
  return out
})

/** 渲染用分段：整库为空 / 搜索无命中时不渲染任何段，改显示空态文案 */
const visibleSections = computed(() => (sections.value.some((s) => s.items.length) ? sections.value : []))

/** 顶栏计数：当前可见模板套数（「最近使用」段是重复展示，不计入） */
const filtered = computed(() =>
  props.customOnly ? customItems.value : [...builtinAll.value, ...customAll.value].filter(hit),
)

/** 段内空态引导（仅「最近使用 / 我的模板」两段可能为空） */
const sectionHints: Record<string, string> = {
  recent: '还没有最近使用的模板，点击应用后会出现在这里。',
  custom: '还没有自定义模板，可在左侧「我的模板」里把当前配置存下来。',
}

const emptyText = computed(() => {
  if (q.value) return '没有匹配的模板，换个关键词试试。'
  if (props.customOnly) return '还没有自定义模板。调好样式后点上方按钮保存。'
  return '暂无模板。'
})

// ===== 选中：应用后卡片带「当前」标签；底栏为固定提示 =====
// （2026-09-15 用户拍板：卡片不再有 hover 信息浮层，模板信息统一在预览弹窗里呈现）
const selectedId = ref<string | null>(null)
/** 右侧瀑布流滚动容器 */
const mainEl = ref<HTMLElement | null>(null)
/** 左栏目录当前所在段：点击跳转后立即更新，滚动时由 spy 跟随 */
const currentSection = ref('recent')
let spyRaf = 0

/**
 * 点击左栏目录：把右侧列表滚到对应段——**不筛选**，因此跳过去之后仍可继续往下
 * 滑到下一个分类区域（2026-09-16 用户要求）。段头对齐滚动容器顶部（留 8px 呼吸位）。
 */
function jumpTo(key: string) {
  const main = mainEl.value
  if (!main) return
  currentSection.value = key
  const sec = main.querySelector<HTMLElement>(`[data-sec="${key}"]`)
  if (!sec) return
  const top = main.scrollTop + (sec.getBoundingClientRect().top - main.getBoundingClientRect().top) - 8
  main.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
}

// 改搜索词：结果集变化后列表回到顶部，目录高亮回到首段（flush:'post' 保证在 DOM 更新之后写）
watch(
  [search, () => props.customOnly],
  () => {
    if (mainEl.value) mainEl.value.scrollTop = 0
    currentSection.value = sections.value[0]?.key ?? 'recent'
  },
  { flush: 'post' },
)

/**
 * 侧栏滚轮转发：点完左侧分类后指针通常还停在左栏，而左栏在常见窗口尺寸下装得下全部分类
 * （自身不可滚动），滚轮事件便石沉大海——用户感知即「右侧瀑布流不能滚动」。
 * 规则（同浏览器原生滚动链，只是把「祖先」换成同级的瀑布流）：
 * ① 侧栏能吃下这次增量 → 交回原生，保持侧栏自身滚动手感；
 * ② 增量会被侧栏边界截断（含侧栏本就不可滚动 / 已到头）→ 侧栏滚到边界，**余量**转给瀑布流，
 *    避免在边界处白吞一整格滚轮（左栏只剩十几像素可滚时最明显）。
 */
function onSideWheel(e: WheelEvent) {
  const main = mainEl.value
  if (!main) return
  const side = e.currentTarget as HTMLElement
  // deltaMode：0=像素 1=行 2=页（与 Filmstrip 的换算口径一致）
  const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? side.clientHeight : 1
  const dy = e.deltaY * unit
  if (!dy) return
  const max = Math.max(0, side.scrollHeight - side.clientHeight)
  const start = side.scrollTop
  const target = Math.min(Math.max(start + dy, 0), max)
  if (target === start + dy) return // ①
  side.scrollTop = target
  main.scrollTop += start + dy - target
  e.preventDefault()
}

/** 滚动联动：右侧列表滑到哪个段，左栏对应项即高亮（目录指向「当前位置」） */
function onMainScroll(e: Event) {
  const main = e.target as HTMLElement
  if (spyRaf) return
  spyRaf = requestAnimationFrame(() => {
    spyRaf = 0
    const top = main.getBoundingClientRect().top
    for (const sec of main.querySelectorAll<HTMLElement>('.tp-sec')) {
      if (sec.getBoundingClientRect().bottom - 60 > top) {
        const key = sec.dataset.sec
        if (key) currentSection.value = key
        return
      }
    }
  })
}
const footHint = '点击左侧分类可跳到该分组（继续下滚即进入下一个分类）；点击卡片预览效果'

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

// ===== 模板包：自定义模板批量导入 / 全部导出（.json，kind=frame-template-pack）=====
const packInput = ref<HTMLInputElement | null>(null)
const packTip = ref('')
let packTipTimer: ReturnType<typeof setTimeout> | undefined
function showPackTip(msg: string) {
  packTip.value = msg
  clearTimeout(packTipTimer)
  packTipTimer = setTimeout(() => (packTip.value = ''), 3000)
}
function onPickPackFile() {
  packInput.value?.click()
}
async function onPackFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = '' // 允许连续导入同一文件
  if (!file) return
  const text = await file.text()
  const res = templates.importJson(text)
  if (res.ok) {
    showPackTip(`已导入 ${res.count ?? 0} 个模板，点击卡片即可应用`)
  } else {
    showPackTip(`导入失败：${res.error ?? '未知错误'}`)
  }
}
function onExportPack() {
  const customCount = templates.templates.filter((t) => !t.builtin).length
  if (!customCount) return
  const json = templates.exportPack()
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `framelab-templates-${new Date().toISOString().slice(0, 10)}.json`
  a.click()
  URL.revokeObjectURL(url)
  showPackTip(`已导出 ${customCount} 个模板`)
}

// 网格缩略图：SVG 即时占位 → 用「当前选中照片 + 模板」真实合成（photoSrc 缺省走内置示例图）。
// 照片切换（photoSrc）或 INFO 文本变化（previewInfo，与大网格同源）时重渲。
const thumbs = reactive<Record<string, string>>({})
const prevThumbSrc = ref<null | string>(null)
const prevThumbInfo = ref<ThumbInfoOverride | null | undefined>(null)
// 渲染批次号：新触发使旧批次作废，避免异步渲染完成后用过期结果覆盖新缩略图
let thumbSeq = 0

// 桌面端照片 src 是 Tauri asset 协议 URL（http://asset.localhost/...）：该来源绘制到 canvas
// 会因 CORS 污染画布，导致 exportFrame → toBlob 抛 SecurityError，缩略图合成失败回退 SVG（看不到照片）。
// 内存关键路径：此前经 toDrawableUrl 读盘转 dataURL（96MP = 107MB base64 字符串）再由
// loadImageElement 全尺寸解码——打开模板库即产生 GB 级瞬时分配。现直接复用 App 已解码的
// 预览图源（photoImage，长边 ≤2560 的工作副本，与预览同一对象），零解码零大字符串；
// 预览源未就绪时兜底走 Rust DCT 缩放解码（readPreviewCanvas）。
// 非 asset URL（blob:/data:）先短路，避免网页端/测试环境加载桌面端 fs 模块链。
async function photoDrawableSrc(src: string | null): Promise<string | ImgSource | undefined> {
  if (!src) return undefined
  if (!/^(?:https?:\/\/asset\.localhost|asset:\/\/localhost)\//.test(src)) return src
  if (photoImage.value) return photoImage.value
  try {
    const { readPreviewCanvas } = await import('../../platform/fs')
    const canvas = await readPreviewCanvas(decodeURIComponent(src.replace(/^(?:https?:\/\/asset\.localhost|asset:\/\/localhost)\//, '')), 1280)
    if (canvas) return canvas
  } catch {
    /* 读盘失败走 undefined，由调用方回退 SVG */
  }
  return undefined
}

// 当前照片的真实 INFO（exifText/dateText/cameraModel/lensText/brand，可留空）：
// 缩略图与实际应用效果一致。声明须在下方网格缩略图 watch 之前（其 immediate 回调会立即读取本值）。
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
    for (const t of list.value) {
      const cachedReal = thumbs[t.id] && !thumbs[t.id].startsWith('data:image/svg')
      if (!ctxChanged && cachedReal) continue
      // 静默换图：已有真实缩略图时保留旧图作底，后台重渲完成后直接替换，
      // 不回退 SVG 占位图——点击卡片应用模板会改写 INFO（日期格式重排/回填）触发重渲，
      // 先重置占位图会造成整排缩略图闪烁。
      if (!cachedReal) thumbs[t.id] = templateThumbDataUrl(t.config)
      void (async () => {
        try {
          // 卡片统一展示该模板自己的样张（用户要求：模板库内始终是「55 套 × 样张」的效果，
          // 卡片高度随样张比例自然错落，而非所有卡片共用当前照片造成的等高网格）。
          // 只有没有样张的自定义模板才回退当前照片 / 内置示例图。
          const sample = sampleForTemplate(t.id)
          const ds = sample ?? (await photoDrawableSrc(src))
          const url = await renderTemplateThumbDataUrl(t.config, ds, 640, sample ? undefined : info)
          if (seq === thumbSeq) thumbs[t.id] = url
        } catch {
          /* templateThumb 已内建 SVG 兜底 */
        }
      })()
    }
  },
  { immediate: true },
)

// 审查报告 U15：剔除已删除模板的缩略图缓存（其它入口删除 / 导入覆盖后的残留，
// 组件常驻左栏、长期累积）。以完整模板清单为准（视图切换不触发重渲）。
watch(
  () => list.value.map((t) => t.id),
  (ids) => {
    const keep = new Set(ids)
    for (const k of Object.keys(thumbs)) {
      if (!keep.has(k)) delete thumbs[k]
    }
  },
)

// ===== 应用 / 删除 =====
const missingOpen = ref(false)
const missingMsg = ref('')

/** 应用模板到当前状态并展开右栏（确认预览后调用） */
function applyTemplate(id: string) {
  const found = templates.templates.find((x) => x.id === id)
  if (!found) return
  selectedId.value = id
  recordRecentUsage(id)
  const missing = applyTemplateToState(found.config)
  app.state.rightOpen = true
  app.setPanel('right', 'background', true)
  app.setPanel('right', 'border', true)
  if (missing.length) {
    missingMsg.value = `当前照片未识别到以下 INFO 信息：${missing.join('、')}。已用「自定义」占位，可在右侧 INFO 面板手动填写。`
    missingOpen.value = true
  }
  // INFO 缺失提示弹窗挂在组件根（弹窗外层），关闭模板库后仍会正常弹出。
}

// ===== 预览确认流程（2026-09-15 用户拍板）=====
// 点卡片不再直接应用：先在弹窗内用**用户自己的照片**合成一张大图预览（与成片同一渲染管线），
// 满意点「确认应用」才应用并返回编辑界面；不满意点「退回继续选择」回到模板列表。
// 未打开照片时（网页版空图库）预览回退该模板的样张，并在底部注明。
const PREVIEW_MAX_EDGE = 1600
const preview = ref<{ id: string; name: string; desc: string; group?: string } | null>(null)
const previewUrl = ref('')
const previewLoading = ref(false)
const previewNoPhoto = ref(false)
let previewSeq = 0

async function openPreview(t: { id: string }) {
  const found = templates.templates.find((x) => x.id === t.id)
  if (!found) return
  preview.value = { id: found.id, name: found.name, desc: found.desc ?? '自定义模板', group: found.group }
  previewUrl.value = ''
  previewLoading.value = true
  previewNoPhoto.value = !state.photoSrc
  const seq = ++previewSeq
  try {
    const hasPhoto = !!state.photoSrc
    // 有照片：用户照片 + 当前 INFO（与编辑界面所见一致）；无照片：该模板样张 + 示意 INFO
    const ds = (hasPhoto ? await photoDrawableSrc(state.photoSrc) : undefined) ?? sampleForTemplate(found.id)
    const url = await renderTemplateThumbDataUrl(found.config, ds, PREVIEW_MAX_EDGE, hasPhoto ? previewInfo.value : undefined)
    if (seq === previewSeq) previewUrl.value = url
  } catch {
    /* templateThumb 已内建 SVG 兜底 */
  } finally {
    if (seq === previewSeq) previewLoading.value = false
  }
}

/** 退回模板列表（清空预览并作废在途渲染） */
function closePreview() {
  previewSeq++
  preview.value = null
  previewUrl.value = ''
  previewLoading.value = false
}

/** 确认应用：应用模板 → 关闭预览与模板库 → 回到编辑界面 */
function confirmPreview() {
  const p = preview.value
  if (!p) return
  applyTemplate(p.id)
  closePreview()
  close()
}

function removeCustom(t: { id: string }) {
  templates.remove(t.id)
  // 审查报告 U15：同步删除缩略图缓存（dataURL 数百 KB~MB 级，此前永久驻留）
  delete thumbs[t.id]
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
  // 预览态：Esc 退回模板列表（不关闭模板库），Enter 直接确认应用
  if (preview.value) {
    if (e.key === 'Escape') {
      closePreview()
      return
    }
    if (e.key === 'Enter' && !previewLoading.value && (e.target as HTMLElement | null)?.tagName !== 'INPUT') {
      confirmPreview()
      return
    }
    return
  }
  if (e.key === 'Escape') close()
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  clearTimeout(tipTimer)
  clearTimeout(packTipTimer)
  cancelAnimationFrame(spyRaf)
})
</script>

<template>
  <Teleport to="body">
    <div v-if="modelValue" class="tp-mask" @click.self="close">
      <div class="tp-modal">
        <div class="tp-head">
          <button class="tp-back" title="返回编辑 (Esc)" @click="close">←</button>
          <span class="tp-title">{{ props.title || '相框模板库' }}</span>
          <input
            v-model="search"
            class="tp-search"
            type="text"
            placeholder="搜索模板名称 / 说明…"
            maxlength="30"
          />
          <span class="tp-count" v-if="filtered.length">共 {{ filtered.length }} 套</span>
        </div>

        <!-- 隐藏的模板包文件选择器（放 v-for 外，避免 ref 变数组；按钮在「我的模板」分区头） -->
        <input
          ref="packInput"
          type="file"
          accept=".json,application/json"
          class="tp-pack-input"
          @change="onPackFileChange"
        />

        <div class="tp-body">
          <!-- 左：分类目录（customOnly 模式无侧栏）。点击 = 跳到该段（不筛选，滚下去即下一个分类）；
               滚轮转发见 onSideWheel，滚动联动高亮见 onMainScroll -->
          <div v-if="!customOnly" class="tp-side" @wheel="onSideWheel">
            <div class="tp-cap">工作区</div>
            <button class="tp-item" :class="{ active: currentSection === 'recent' }" @click="jumpTo('recent')">
              <span class="tp-item-n">最近使用</span>
              <span v-if="recentAll.length" class="tp-item-c">{{ recentAll.length }}</span>
            </button>
            <button class="tp-item" :class="{ active: currentSection === 'custom' }" @click="jumpTo('custom')">
              <span class="tp-item-n">我的模板</span>
              <span v-if="customAll.length" class="tp-item-c">{{ customAll.length }}</span>
            </button>
            <div class="tp-sep" />
            <div class="tp-cap">风格分类</div>
            <button
              v-for="g in VISIBLE_GROUPS"
              :key="g"
              class="tp-item"
              :class="{ active: currentSection === `g:${g}` }"
              @click="jumpTo(`g:${g}`)"
            >
              <span class="tp-item-n">{{ g }}</span>
              <span class="tp-item-c">{{ groupCounts[g] || '' }}</span>
            </button>
          </div>

          <!-- 中：瀑布流网格 -->
          <div ref="mainEl" class="tp-main" @scroll="onMainScroll">
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
            <p v-if="customOnly && savedTip" class="tp-pack-tip">{{ savedTip }}</p>

            <p v-if="visibleSections.length === 0" class="tp-empty">{{ emptyText }}</p>
            <template v-else>
              <section v-for="sec in visibleSections" :key="sec.key" :data-sec="sec.key" class="tp-sec">
                <div class="tp-sec-head">
                  <h3 class="tp-sec-title">{{ sec.title }}</h3>
                  <span v-if="sec.items.length" class="tp-sec-count">{{ sec.items.length }} 套</span>
                  <template v-if="sec.key === 'custom'">
                    <button class="tp-sec-btn" title="从 .json 模板包批量导入（单模板或打包文件均可）" @click="onPickPackFile">
                      导入
                    </button>
                    <button
                      class="tp-sec-btn"
                      :disabled="!customAll.length"
                      title="把全部自定义模板打包导出为一个 .json 模板包"
                      @click="onExportPack"
                    >
                      导出全部
                    </button>
                  </template>
                  <span v-else class="tp-sec-hint">点击卡片预览效果</span>
                </div>
                <!-- 空段（仅「最近使用 / 我的模板」）：给引导文案，保证左栏目录项仍有落点 -->
                <p v-if="!sec.items.length" class="tp-sec-empty">{{ sectionHints[sec.key] }}</p>
                <div v-else class="tp-masonry">
                  <div
                    v-for="t in sec.items"
                    :key="t.id"
                    class="tp-card"
                    :class="{ sel: selectedId === t.id }"
                    :data-id="t.id"
                    @click="openPreview(t)"
                  >
                    <img class="tp-card-thumb" :src="thumbs[t.id]" :alt="t.name" draggable="false" />
                    <span v-if="selectedId === t.id" class="tp-card-tag">当前</span>
                    <span v-if="!t.builtin" class="tp-card-ren" title="重命名" @click.stop="askRename(t)">✎</span>
                    <span v-if="!t.builtin" class="tp-card-del" title="删除该模板" @click.stop="removeCustom(t)">✕</span>
                  </div>
                </div>
              </section>
            </template>
          </div>
        </div>

        <!-- 预览确认层（2026-09-15）：点卡片后覆盖全窗，用「你的照片 + 该模板」真实合成大图 -->
        <div v-if="preview" class="tp-pv">
          <div class="tp-pv-head">
            <button class="tp-back" title="退回模板列表 (Esc)" @click="closePreview">←</button>
            <span class="tp-pv-title">{{ preview.name }}</span>
            <span v-if="preview.group" class="tp-count">{{ preview.group }}</span>
          </div>
          <div class="tp-pv-stage">
            <p v-if="previewLoading" class="tp-pv-loading">正在用当前照片生成预览…</p>
            <img v-else-if="previewUrl" class="tp-pv-img" :src="previewUrl" :alt="preview.name" draggable="false" />
            <p v-else class="tp-pv-loading">预览生成失败，可直接确认应用</p>
          </div>
          <div class="tp-pv-foot">
            <div class="tp-pv-info">
              <span class="tp-pv-name">{{ preview.name }}</span>
              <span class="tp-pv-desc">
                {{ preview.desc }}
                <em v-if="previewNoPhoto" class="tp-pv-note">（当前未打开照片，预览为模板样张）</em>
              </span>
            </div>
            <button class="tp-pv-cancel" @click="closePreview">退回继续选择</button>
            <button class="tp-pv-ok" :disabled="previewLoading" @click="confirmPreview">确认应用</button>
          </div>
        </div>

        <!-- 底部操作栏：当前模板动态提示（关闭 = 右上角 ✕ 或 Esc，无「完成」按钮） -->
        <div class="tp-foot">
          <span class="tp-hint">{{ footHint }}</span>
          <p v-if="packTip" class="tp-foot-tip">{{ packTip }}</p>
        </div>
      </div>
    </div>
  </Teleport>

  <GlassModal v-model="missingOpen" title="INFO 信息缺失提示" :message="missingMsg" confirm-text="知道了" :z-index="1200" />

  <!-- 重命名模板 -->
  <GlassModal
    v-model="renameOpen"
    title="重命名模板"
    message="输入新的模板名称："
    input-mode
    :input-value="renameValue"
    input-placeholder="模板名称"
    confirm-text="确定"
    :z-index="1200"
    @confirm="doRename"
  />
</template>

<style scoped>
.tp-mask {
  position: fixed; inset: 0; z-index: 1100;
  background: rgba(0, 0, 0, 0.6);
  display: flex; align-items: center; justify-content: center;
}
/* 全窗化（用户要求）：弹窗与软件界面同大，铺满整个应用窗口 */
.tp-modal {
  position: relative; /* 预览确认层（.tp-pv）以本容器为定位上下文铺满内容区 */
  width: 100%; height: 100%;
  display: flex; flex-direction: column;
  background: var(--panel); border: none; box-shadow: none;
  color: var(--text); border-radius: 0;
}
/* 细滚动条（暗色），侧栏与主区共用 */
.tp-side::-webkit-scrollbar, .tp-main::-webkit-scrollbar { width: 10px; }
.tp-side::-webkit-scrollbar-track, .tp-main::-webkit-scrollbar-track { background: transparent; }
.tp-side::-webkit-scrollbar-thumb, .tp-main::-webkit-scrollbar-thumb {
  background: var(--border); border-radius: 5px; border: 2px solid transparent; background-clip: content-box;
}
.tp-side::-webkit-scrollbar-thumb:hover, .tp-main::-webkit-scrollbar-thumb:hover { background: var(--text-num); background-clip: content-box; }

/* ===== 顶栏 ===== */
.tp-head {
  display: flex; align-items: center; gap: 12px;
  height: 52px; padding: 0 18px;
  border-bottom: 1px solid var(--border); flex: none;
}
.tp-back {
  width: 32px; height: 32px; cursor: pointer;
  background: transparent; border: none; border-radius: 8px;
  color: var(--text-dim); font-size: 17px; line-height: 30px;
  transition: background 0.12s, color 0.12s;
}
.tp-back:hover { background: var(--hover); color: var(--text); }
.tp-title { font-size: 15px; font-weight: 600; letter-spacing: 0.5px; }
.tp-search {
  flex: 1; max-width: 400px; margin-left: auto; height: 30px; padding: 0 12px;
  border: 1px solid var(--border); border-radius: 8px; background: var(--shell);
  color: var(--text); font-size: 12.5px; font-family: inherit;
  transition: border-color 0.12s, box-shadow 0.12s;
}
.tp-search:focus {
  outline: none; border-color: var(--slider-thumb);
  box-shadow: 0 0 0 2px rgba(167, 171, 178, 0.18);
}
.tp-search::placeholder { color: var(--text-num); }
.tp-count {
  flex: none; font-size: 11.5px; color: var(--text-num);
  background: var(--shell); border: 1px solid var(--border);
  border-radius: 10px; padding: 2px 10px;
}

/* ===== 主体：侧栏 + 瀑布流 ===== */
.tp-body { flex: 1; display: flex; min-height: 0; }
/* —— 左：分类侧栏 —— */
.tp-side {
  flex: none; width: 184px; background: var(--shell);
  border-right: 1px solid var(--border); overflow-y: auto; padding: 12px 8px 16px;
}
.tp-cap {
  padding: 8px 12px 6px; font-size: 10.5px; color: var(--text-num);
  letter-spacing: 1.5px; user-select: none;
}
.tp-item {
  position: relative; display: flex; align-items: center; gap: 8px;
  width: 100%; height: 34px; padding: 0 12px 0 16px; margin-bottom: 2px;
  font-size: 13px; color: var(--text-dim); font-family: inherit;
  background: transparent; border: none; border-radius: 8px; cursor: pointer; text-align: left;
  transition: background 0.12s, color 0.12s;
}
.tp-item:hover { background: var(--hover); color: var(--text); }
.tp-item.active { background: var(--accent); color: #fff; }
.tp-item.active::before {
  content: ''; position: absolute; left: 5px; top: 9px; bottom: 9px; width: 3px;
  border-radius: 2px; background: var(--slider-thumb);
}

.tp-item-n { flex: 1; }
.tp-item-c {
  flex: none; min-width: 22px; text-align: center;
  font-size: 10.5px; color: var(--text-num);
  background: rgba(255, 255, 255, 0.07); border-radius: 9px; padding: 1px 7px;
}
.tp-item.active .tp-item-c { color: #fff; background: rgba(255, 255, 255, 0.16); }
.tp-sep { height: 1px; background: var(--border); margin: 10px 10px; }

/* —— 中：瀑布流 —— */
.tp-main { flex: 1; min-width: 0; overflow-y: auto; padding: 16px 18px 24px; }
/* 分区间留出明显间隙（用户 2026-09-15：参考图那种大块留白 + 细分隔线） */
.tp-sec { margin-bottom: 64px; }
.tp-sec + .tp-sec { border-top: 1px solid var(--border); padding-top: 34px; }
.tp-sec-head { display: flex; align-items: baseline; gap: 10px; margin: 2px 2px 12px; }
.tp-sec-title { font-size: 16px; font-weight: 600; margin: 0; letter-spacing: 1.2px; }
.tp-sec-count {
  font-size: 11px; color: var(--text-num);
  background: var(--shell); border: 1px solid var(--border);
  border-radius: 10px; padding: 1px 9px;
}
.tp-sec-hint { margin-left: auto; font-size: 11.5px; color: var(--text-num); }
/* 空段（最近使用 / 我的模板）的引导文案：左栏目录项跳过来时能看到为什么是空的 */
.tp-sec-empty { margin: 0 2px 6px; font-size: 12px; color: var(--text-num); }
.tp-sec-btn {
  height: 24px; padding: 0 12px; font-size: 11.5px; line-height: 22px;
  border: 1px solid var(--border); border-radius: 6px; background: var(--btn-bg);
  color: var(--text); cursor: pointer; font-family: inherit;
  transition: background 0.12s;
}
.tp-sec-btn:hover:not(:disabled) { background: var(--hover); }
.tp-sec-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.tp-pack-input { display: none; }
/* 瀑布流：宽屏 4 列，随窗口宽度递减为 3 / 2 / 1 列（响应式保留）；
   卡片按缩略图真实比例展示（与成片同构）——高度自然错落，不追求行对齐 */
.tp-masonry { columns: 4; column-gap: 12px; }
@media (max-width: 1360px) { .tp-masonry { columns: 3; } }
@media (max-width: 1000px) { .tp-masonry { columns: 2; } }
@media (max-width: 700px) { .tp-masonry { columns: 1; } }
.tp-card {
  position: relative; break-inside: avoid; margin: 0 0 12px;
  background: var(--panel-3); border: 1px solid var(--border); border-radius: 0;
  cursor: pointer; overflow: hidden;
  transition: transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease;
}
.tp-card:hover {
  transform: translateY(-2px);
  border-color: var(--slider-thumb);
  box-shadow: 0 10px 26px rgba(0, 0, 0, 0.45);
}
.tp-card.sel {
  border-color: var(--slider-thumb);
  box-shadow: 0 0 0 2px var(--slider-thumb), 0 10px 26px rgba(0, 0, 0, 0.35);
}
/* 卡片只呈现成片本身：不加 hover 信息浮层（模板信息统一在预览弹窗里呈现，2026-09-15 用户拍板） */
.tp-card-thumb { display: block; width: 100%; height: auto; background: var(--panel-3); }
/* 角标：重命名/删除（仅自定义卡片，hover 时出现） */
.tp-card-del, .tp-card-ren {
  position: absolute; top: 8px; height: 22px; padding: 0 8px;
  background: rgba(0, 0, 0, 0.55); border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 6px;
  color: #fff; font-size: 11px; line-height: 20px; cursor: pointer;
  opacity: 0; transition: opacity 0.12s;
}
.tp-card:hover .tp-card-del, .tp-card:hover .tp-card-ren { opacity: 1; }
.tp-card-del { right: 8px; }
.tp-card-ren { right: 38px; }
.tp-card-tag {
  position: absolute; left: 10px; top: 10px; height: 20px; padding: 0 9px;
  background: var(--slider-thumb); color: #10131a; font-size: 11px;
  line-height: 20px; font-weight: 600; border-radius: 10px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.35);
}
.tp-empty { color: var(--text-dim); font-size: 12.5px; text-align: center; padding: 48px 0; }

/* 我的模板模式：顶部保存当前配置表单 */
.tp-save { display: flex; gap: 8px; margin-bottom: 10px; }
.tp-save-inp {
  flex: 1; min-width: 0; height: 30px; padding: 0 12px;
  border: 1px solid var(--border); border-radius: 8px; background: var(--shell);
  color: var(--text); font-size: 12.5px; font-family: inherit;
  transition: border-color 0.12s, box-shadow 0.12s;
}
.tp-save-inp:focus {
  outline: none; border-color: var(--slider-thumb);
  box-shadow: 0 0 0 2px rgba(167, 171, 178, 0.18);
}
.tp-save-inp::placeholder { color: var(--text-num); }
.tp-save-btn {
  flex: none; height: 30px; padding: 0 14px;
  border: none; border-radius: 8px; background: var(--slider-thumb);
  color: #10131a; font-size: 12.5px; line-height: 30px;
  cursor: pointer; font-family: inherit; font-weight: 600;
  transition: filter 0.12s;
}
.tp-save-btn:hover { filter: brightness(1.08); }
.tp-save-btn:active { background: var(--pressed); }
.tp-pack-tip { flex: none; margin: 0 0 8px; font-size: 11px; color: var(--text); }

/* ===== 预览确认层（覆盖整个弹窗内容区：返回 + 大图 + 确认/退回）===== */
.tp-pv {
  position: absolute; inset: 0; z-index: 5;
  display: flex; flex-direction: column; background: var(--panel);
}
.tp-pv-head {
  flex: none; display: flex; align-items: center; gap: 12px;
  height: 52px; padding: 0 18px; border-bottom: 1px solid var(--border);
}
.tp-pv-title { font-size: 15px; font-weight: 600; letter-spacing: 0.5px; }
.tp-pv-stage {
  flex: 1; min-height: 0; display: flex; align-items: center; justify-content: center;
  padding: 18px; background: var(--shell);
}
.tp-pv-img { display: block; max-width: 100%; max-height: 100%; box-shadow: 0 18px 48px rgba(0, 0, 0, 0.5); }
.tp-pv-loading { margin: 0; font-size: 12.5px; color: var(--text-dim); }
.tp-pv-foot {
  flex: none; display: flex; align-items: center; gap: 10px;
  min-height: 56px; padding: 9px 18px; border-top: 1px solid var(--border); background: var(--shell);
}
/* 模板信息（名称 + 说明）只在预览弹窗里呈现（卡片不再有 hover 浮层） */
.tp-pv-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.tp-pv-name { font-size: 13px; font-weight: 600; color: var(--text); letter-spacing: 0.2px; }
.tp-pv-desc {
  font-size: 11.5px; color: var(--text-dim);
  display: -webkit-box; -webkit-box-orient: vertical; -webkit-line-clamp: 2;
  overflow: hidden;
}
.tp-pv-note { font-style: normal; color: var(--text-num); }
.tp-pv-cancel {
  flex: none; height: 32px; padding: 0 16px;
  border: 1px solid var(--border); border-radius: 8px; background: var(--btn-bg);
  color: var(--text); font-size: 12.5px; font-family: inherit; cursor: pointer;
  transition: background 0.12s;
}
.tp-pv-cancel:hover { background: var(--hover); }
.tp-pv-ok {
  flex: none; height: 32px; padding: 0 20px;
  border: none; border-radius: 8px; background: var(--slider-thumb);
  color: #10131a; font-size: 12.5px; font-weight: 600; font-family: inherit; cursor: pointer;
  transition: filter 0.12s;
}
.tp-pv-ok:hover:not(:disabled) { filter: brightness(1.08); }
.tp-pv-ok:disabled { opacity: 0.55; cursor: not-allowed; }

/* ===== 底部操作栏 ===== */
.tp-foot {
  flex: none; display: flex; align-items: center; gap: 10px;
  height: 44px; padding: 0 18px;
  border-top: 1px solid var(--border); background: var(--shell);
}
.tp-hint {
  flex: 1; min-width: 0; font-size: 12px; color: var(--text-dim);
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.tp-foot-tip { flex: none; margin: 0; font-size: 11px; color: var(--text); }

@media (max-width: 900px) {
  .tp-side { display: none; }
  .tp-body { display: block; }
}
</style>
