<!-- src/components/controls/TemplatePickerModal.vue -->
<script setup lang="ts">
// 模板选择弹窗（2026-09-13 改版）：左侧分类侧栏（最近使用/我的模板/风格九组）+ 4 列瀑布流
// 卡片网格（按模板真实比例展示）+ 底部操作栏（当前模板信息 + 批量应用 + 完成）。
// 无右栏大预览（设计决策见 AGENTS.md）：点击卡片即实时应用并保持弹窗打开，hover 浮层
// 显示名称/说明，底部操作栏跟随 hover/选中动态提示。卡片缩略图用**该模板自己的样张照片**
// 真实合成（core/templateSamples.ts，55 套各一张；自定义模板无样张时回退当前照片/内置示例图），
// 卡片高度随样张比例自然错落。
// 界面不使用彩色 Emoji（AGENTS.md UI 设计要求），图标用纯文本符号。
import { ref, computed, reactive, watch, onMounted, onBeforeUnmount } from 'vue'
import { useTemplates, applyTemplateToState, recordRecentUsage } from '../../composables/useTemplates'
import { useAppState } from '../../composables/useAppState'
import { useFrameConfig } from '../../composables/useFrameConfig'
import { templateThumbDataUrl, renderTemplateThumbDataUrl, type ThumbInfoOverride } from '../../core/templateThumb'
import { sampleForTemplate } from '../../core/templateSamples'
import type { ImgSource } from '../../core/bgRenderer'
import { photoImage } from '../../composables/useUi'
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
const { state } = useFrameConfig()

const list = computed(() => {
  if (props.customOnly) return templates.templates.filter((t) => !t.builtin)
  return props.category === 'frame'
    ? templates.templates.filter((t) => t.category === 'frame' || t.category === 'all')
    : templates.templates.filter((t) => t.category === props.category)
})

// ===== 视图状态：侧栏分类（recent / custom / all / 组名）+ 搜索 =====
// 界面不使用彩色 Emoji（AGENTS.md）：搜索框无图标，用途由 placeholder 表达。
const TEMPLATE_GROUPS = ['经典', '极简轻量', '杂志编辑', '胶片复古', '暗调影廊', '联名卡', '社交尺寸', '水印署名', '多彩色卡', '大师水印', '日历边框', '运动边框', '设备样机', '创意排版'] as const
type SideView = 'recent' | 'custom' | 'all' | (typeof TEMPLATE_GROUPS)[number]
const activeView = ref<SideView>('all')
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

const filtered = computed(() => {
  let out: typeof list.value
  if (props.customOnly || activeView.value === 'custom') {
    out = customAll.value
  } else if (activeView.value === 'recent') {
    const order = new Map(templates.recentIds.map((id, i) => [id, i]))
    out = builtinAll.value
      .filter((t) => order.has(t.id))
      .sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
  } else if (activeView.value !== 'all') {
    out = builtinAll.value.filter((t) => t.group === activeView.value)
  } else {
    out = list.value
  }
  const q = search.value.trim().toLowerCase()
  if (q) {
    out = out.filter((t) => t.name.toLowerCase().includes(q) || (t.desc ?? '').toLowerCase().includes(q))
  }
  return out
})

/** 主区分区：全部视图 = 内置 + 我的模板两段；其余视图单段 */
const sections = computed(() => {
  if (props.customOnly || activeView.value === 'custom') {
    return [{ key: 'custom', title: '我的模板', items: filtered.value }]
  }
  if (activeView.value === 'recent') {
    return [{ key: 'recent', title: '最近使用', items: filtered.value }]
  }
  if (activeView.value !== 'all') {
    return [{ key: activeView.value, title: activeView.value, items: filtered.value }]
  }
  const builtin = filtered.value.filter((t) => t.builtin)
  const custom = filtered.value.filter((t) => !t.builtin)
  const out: Array<{ key: string; title: string; items: typeof list.value }> = []
  if (builtin.length) out.push({ key: 'builtin', title: '全部模板', items: builtin })
  if (custom.length) out.push({ key: 'custom', title: '我的模板', items: custom })
  return out
})

const emptyText = computed(() => {
  if (search.value.trim()) return '没有匹配的模板，换个分类或关键词试试。'
  if (activeView.value === 'recent') return '还没有最近使用的模板，点击应用后会出现在这里。'
  if (props.customOnly || activeView.value === 'custom') return '还没有自定义模板。调好样式后点上方按钮保存。'
  return '暂无模板。'
})

// ===== 选中 / hover：底部操作栏动态提示（hover 优先，回退选中，回退默认文案） =====
const selectedId = ref<string | null>(null)
const hoveredId = ref<string | null>(null)
const selected = computed(() => templates.templates.find((t) => t.id === selectedId.value) ?? null)
const hovered = computed(() => templates.templates.find((t) => t.id === hoveredId.value) ?? null)
const hintTemplate = computed(() => hovered.value ?? selected.value)
const footHint = computed(() => {
  const t = hintTemplate.value
  if (!t) return '点击卡片即应用模板并返回编辑界面'
  return `当前模板：${t.name} — ${t.desc ?? '自定义模板'}`
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

function selectAndApply(t: { id: string }) {
  const found = templates.templates.find((x) => x.id === t.id)
  if (!found) return
  selectedId.value = t.id
  recordRecentUsage(t.id)
  const missing = applyTemplateToState(found.config)
  app.state.rightOpen = true
  app.setPanel('right', 'background', true)
  app.setPanel('right', 'border', true)
  if (missing.length) {
    missingMsg.value = `当前照片未识别到以下 INFO 信息：${missing.join('、')}。已用「自定义」占位，可在右侧 INFO 面板手动填写。`
    missingOpen.value = true
  }
  // 用户流程（2026-09-13）：点击模板即应用并直接返回编辑界面，不停留在弹窗；
  // INFO 缺失提示弹窗挂在组件根（弹窗外层），关闭模板库后仍会正常弹出。
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
  if (e.key === 'Escape') close()
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  clearTimeout(tipTimer)
  clearTimeout(packTipTimer)
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
          <!-- 左：分类侧栏（customOnly 模式无侧栏） -->
          <div v-if="!customOnly" class="tp-side">
            <div class="tp-cap">工作区</div>
            <button
              class="tp-item"
              :class="{ active: activeView === 'recent' }"
              @click="activeView = activeView === 'recent' ? 'all' : 'recent'"
            >
              <span class="tp-item-n">最近使用</span>
              <span v-if="templates.recentIds.length" class="tp-item-c">{{ templates.recentIds.length }}</span>
            </button>
            <button
              class="tp-item"
              :class="{ active: activeView === 'custom' }"
              @click="activeView = activeView === 'custom' ? 'all' : 'custom'"
            >
              <span class="tp-item-n">我的模板</span>
              <span v-if="customAll.length" class="tp-item-c">{{ customAll.length }}</span>
            </button>
            <div class="tp-sep" />
            <div class="tp-cap">风格分类</div>
            <button class="tp-item" :class="{ active: activeView === 'all' }" @click="activeView = 'all'">
              <span class="tp-item-n">全部</span>
              <span class="tp-item-c">{{ builtinAll.length || '' }}</span>
            </button>
            <button
              v-for="g in TEMPLATE_GROUPS"
              :key="g"
              class="tp-item"
              :class="{ active: activeView === g }"
              @click="activeView = activeView === g ? 'all' : g"
            >
              <span class="tp-item-n">{{ g }}</span>
              <span class="tp-item-c">{{ groupCounts[g] || '' }}</span>
            </button>
          </div>

          <!-- 中：瀑布流网格 -->
          <div class="tp-main">
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

            <p v-if="sections.length === 0" class="tp-empty">{{ emptyText }}</p>
            <template v-else>
              <section v-for="sec in sections" :key="sec.key" class="tp-sec">
                <div class="tp-sec-head">
                  <h3 class="tp-sec-title">{{ sec.title }}</h3>
                  <span class="tp-sec-count">{{ sec.items.length }} 套</span>
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
                  <span v-if="sec.key !== 'custom'" class="tp-sec-hint">点击卡片即应用并返回编辑</span>
                </div>
                <div class="tp-masonry">
                  <div
                    v-for="t in sec.items"
                    :key="t.id"
                    class="tp-card"
                    :class="{ sel: selectedId === t.id }"
                    :data-id="t.id"
                    @click="selectAndApply(t)"
                    @mouseenter="hoveredId = t.id"
                    @mouseleave="hoveredId = hoveredId === t.id ? null : hoveredId"
                  >
                    <img class="tp-card-thumb" :src="thumbs[t.id]" :alt="t.name" draggable="false" />
                    <span v-if="selectedId === t.id" class="tp-card-tag">当前</span>
                    <span v-if="!t.builtin" class="tp-card-ren" title="重命名" @click.stop="askRename(t)">✎</span>
                    <span v-if="!t.builtin" class="tp-card-del" title="删除该模板" @click.stop="removeCustom(t)">✕</span>
                    <div class="tp-card-ov">
                      <span class="tp-card-name">{{ t.name }}</span>
                      <span class="tp-card-desc">{{ t.desc || '自定义模板' }}</span>
                    </div>
                  </div>
                </div>
              </section>
            </template>
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
.tp-sec { margin-bottom: 8px; }
.tp-sec-head { display: flex; align-items: baseline; gap: 10px; margin: 2px 2px 12px; }
.tp-sec-title { font-size: 14px; font-weight: 600; margin: 0; letter-spacing: 0.3px; }
.tp-sec-count {
  font-size: 11px; color: var(--text-num);
  background: var(--shell); border: 1px solid var(--border);
  border-radius: 10px; padding: 1px 9px;
}
.tp-sec-hint { margin-left: auto; font-size: 11.5px; color: var(--text-num); }
.tp-sec-btn {
  height: 24px; padding: 0 12px; font-size: 11.5px; line-height: 22px;
  border: 1px solid var(--border); border-radius: 6px; background: var(--btn-bg);
  color: var(--text); cursor: pointer; font-family: inherit;
  transition: background 0.12s;
}
.tp-sec-btn:hover:not(:disabled) { background: var(--hover); }
.tp-sec-btn:disabled { opacity: 0.5; cursor: not-allowed; }
.tp-pack-input { display: none; }
/* 瀑布流：列数随窗口自适应（宽屏 4 列 / 中屏 3 列 / 窄屏 2 列 / 极窄 1 列），
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
.tp-card-thumb { display: block; width: 100%; height: auto; background: var(--panel-3); }
/* hover 浮层：底部渐变 + 名称/说明（信息唯一来源，无右栏预览） */
.tp-card-ov {
  position: absolute; inset: 0; display: flex; flex-direction: column;
  justify-content: flex-end; padding: 12px 12px 10px;
  background: linear-gradient(180deg, rgba(0, 0, 0, 0) 52%, rgba(0, 0, 0, 0.78) 100%);
  opacity: 0; transition: opacity 0.15s;
  pointer-events: none;
}
.tp-card:hover .tp-card-ov { opacity: 1; }
.tp-card-name { font-size: 13px; color: #fff; font-weight: 600; letter-spacing: 0.3px; }
.tp-card-desc {
  font-size: 11px; color: rgba(255, 255, 255, 0.75); margin-top: 3px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
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
