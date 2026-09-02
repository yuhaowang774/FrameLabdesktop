<script setup lang="ts">
// 导出模块：格式/画质/尺寸配置、单张/批量导出、进度条、参数批量同步。
// 导出成功后弹出预览（图片 + 保存按钮），确保用户「看得到」导出结果。
// 桌面端（Tauri）：保存走系统对话框 + Rust 写盘；批量导出先选目录再逐张写入。
import { ref, computed, watch } from 'vue'
import { useLibrary, type LibraryItem } from '../../composables/useLibrary'
import { useFrameConfig } from '../../composables/useFrameConfig'
import { useAppState } from '../../composables/useAppState'
import { useTemplates } from '../../composables/useTemplates'
import type { FrameConfig } from '../../core/types'
import { buildExifText, formatDate } from '../../composables/useExif'
import { getExportFormatPref, getExportQualityPref } from '../../composables/usePrefs'
import {
  exportFrame,
  downloadBlob,
  makeExportFilename,
  estimateExportSize,
  type ExportFormat,
  type ExportOptions,
} from '../../core/exporter'
import { makeRuleApplier } from '../../core/textRules'
import type { ImgSource } from '../../core/bgRenderer'
import { isTauri } from '../../platform/env'
import Icon from '../common/Icon.vue'
import RangeSlider from '../common/RangeSlider.vue'

const library = useLibrary()
const { state } = useFrameConfig()
const app = useAppState()
const templates = useTemplates()

// 默认格式/画质可在「首选项 → 导出」中调整，打开导出页时采用该默认值
const format = ref<ExportFormat>(getExportFormatPref())
const jpgQuality = ref(getExportQualityPref())
const supersample = ref(1)
// 批量导出回填：开启后每张照片使用导入时解析的自身 EXIF（参数/型号/品牌 Logo）出图，
// 而非当前编辑器里的全局参数；关闭则全部照片沿用当前编辑参数（含手动改过的文本）。
const backfillExif = ref(true)

// ===== 批量文本映射（P1-1 补充：混批镜头/机型文本统一替换） =====
// 仅作用于批量回填路径；规则每行「查找 => 替换」，localStorage 持久化。
const RULES_KEY = 'frame-text-rules'
const rulesEnabled = ref(false)
const rulesText = ref('')
try {
  const raw = localStorage.getItem(RULES_KEY)
  if (raw) {
    const parsed = JSON.parse(raw) as { enabled?: boolean; text?: string }
    rulesEnabled.value = !!parsed.enabled
    rulesText.value = parsed.text ?? ''
  }
} catch {
  /* ignore */
}
watch([rulesEnabled, rulesText], () => {
  try {
    localStorage.setItem(RULES_KEY, JSON.stringify({ enabled: rulesEnabled.value, text: rulesText.value }))
  } catch {
    /* ignore */
  }
})

// ===== 导出预览（分辨率/体积实测 + 1:1 查看 + 保存定位） =====
const preview = ref<{
  url: string
  name: string
  blob: Blob
  w: number
  h: number
  sizeText: string
} | null>(null)
const zoom1x = ref(false)
const saved = ref(false)
const savedPath = ref<string | null>(null)

// ===== 导出文件夹（桌面端）：选定后导出直接写入，成功弹窗不再需要「保存图片」 =====
const EXPORT_FOLDER_KEY = 'framelab-export-folder'
const exportFolder = ref<string | null>(isTauri ? localStorage.getItem(EXPORT_FOLDER_KEY) : null)
async function chooseExportFolder() {
  const { pickExportFolder } = await import('../../platform/fs')
  const r = await pickExportFolder()
  if (r) {
    exportFolder.value = r
    localStorage.setItem(EXPORT_FOLDER_KEY, r)
  }
}
function clearExportFolder() {
  exportFolder.value = null
  localStorage.removeItem(EXPORT_FOLDER_KEY)
}

function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  if (n >= 1024) return `${Math.round(n / 1024)} KB`
  return `${n} B`
}

/** 展示导出结果：blob 实测分辨率（预览图即导出成品，实测最准） */
async function showPreview(blob: Blob, name: string, writtenPath?: string | null) {
  if (preview.value) URL.revokeObjectURL(preview.value.url)
  const url = URL.createObjectURL(blob)
  let w = 0
  let h = 0
  try {
    const im = await loadImage(url)
    w = im.naturalWidth
    h = im.naturalHeight
  } catch {
    /* 实测失败显示 — */
  }
  preview.value = { url, name, blob, w, h, sizeText: formatBytes(blob.size) }
  zoom1x.value = false
  if (writtenPath) {
    // 已直接写盘（选定了导出文件夹）：弹窗进入「已导出」态，不显示保存按钮
    saved.value = true
    savedPath.value = writtenPath
  } else {
    saved.value = false
    savedPath.value = null
  }
}

function closePreview() {
  if (preview.value) URL.revokeObjectURL(preview.value.url)
  preview.value = null
}

// ===== 输出预估：当前照片尺寸懒加载缓存 + 任务卡实时估算（与 exporter 同源公式） =====
const sizeCache = new Map<string, { w: number; h: number }>()
const activeItem = computed(() => library.items.find((i) => i.id === library.activeId.value) ?? null)
const activeSize = ref<{ w: number; h: number } | null>(null)

watch(activeItem, async (item) => {
  activeSize.value = null
  if (!item) return
  const hit = sizeCache.get(item.id)
  if (hit) {
    activeSize.value = hit
    return
  }
  try {
    const im = await loadImage(item.url)
    const s = { w: im.naturalWidth, h: im.naturalHeight }
    sizeCache.set(item.id, s)
    // 异步竞态保护：仅当仍是当前照片时更新
    if (library.activeId.value === item.id) activeSize.value = s
  } catch {
    /* 尺寸读取失败：预估显示 —，不阻塞导出 */
  }
}, { immediate: true })

/** JPG 体积粗估（B/px 经验系数随画质线性），PNG 不估 */
const estimate = computed(() => {
  if (!activeSize.value) return null
  const { w, h } = estimateExportSize(activeSize.value.w, activeSize.value.h, state, supersample.value)
  let sizeText = ''
  if (format.value === 'jpg') {
    const bytes = w * h * (0.08 + jpgQuality.value * 0.24)
    sizeText = bytes >= 1024 * 1024 ? `≈ ${(bytes / 1024 / 1024).toFixed(1)} MB` : `≈ ${Math.round(bytes / 1024)} KB`
  }
  return { w, h, sizeText }
})

const selectedCount = computed(() => library.items.filter((i) => i.selected).length)
const targetCount = computed(() => (selectedCount.value > 0 ? selectedCount.value : library.items.length))

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const im = new Image()
    im.onload = () => resolve(im)
    im.onerror = () => reject(new Error('图片加载失败'))
    im.src = src
  })
}

/**
 * 构建单张导出配置：批量回填开启时用该照片自身 EXIF 覆盖全局文本字段。
 * 浅拷贝覆盖（不写回全局 state，避免触发预览 CSS 变量与历史提交）；
 * 无 EXIF 的照片文本置空（导出器对空字符串自动跳过绘制），品牌保留当前选择。
 * 等效焦距开关开启时按当前开关/系数重拼该照片文本（与编辑器一致）。
 */
function configFor(item: LibraryItem, backfill: boolean): FrameConfig {
  if (!backfill) return state
  const exif = item.exif
  const apply = makeRuleApplier(rulesText.value, rulesEnabled.value)
  const text = apply(
    exif && state.eqFocal
      ? buildExifText(exif.raw, { eqFocal: state.eqFocal, cropFactor: state.cropFactor })
      : (exif?.text ?? ''),
  )
  const dateText = exif?.raw.dateTimeOriginal ? formatDate(exif.raw.dateTimeOriginal, state.dateFormat) : ''
  return {
    ...state,
    exifText: text,
    dateText,
    cameraModel: apply(exif?.model ?? ''),
    lensText: apply(exif?.lens ?? ''),
    exifRaw: exif?.raw ?? null,
    brand: exif?.brandId ?? state.brand,
  }
}

async function renderOne(item: LibraryItem, backfill: boolean): Promise<Blob> {
  const source = await loadImage(item.url)
  const opts: ExportOptions = { format: format.value, jpgQuality: jpgQuality.value, scale: supersample.value }
  if (state.bgMode === 'photo' && state.customBgImage) {
    opts.backgroundImage = await loadImage(state.customBgImage)
  }
  const res = await exportFrame(source as ImgSource, configFor(item, backfill), opts)
  return res.blob
}

/** 导出前置检查：桌面端必须先选定导出文件夹（导出直接写盘） */
function ensureExportFolder(): boolean {
  if (!isTauri || exportFolder.value) return true
  window.alert('请先在下方「导出文件夹」中选择导出位置')
  return false
}

/** 导出并弹出预览；选定了导出文件夹时直接写盘（重名自动加序号） */
async function exportSingle() {
  const active = library.items.find((i) => i.id === library.activeId.value)
  if (!active || !ensureExportFolder()) return
  app.startTask('导出单张 · ' + active.name)
  try {
    // 单张导出 = 当前编辑器所见即所得：state 已随照片切换恢复该照片参数，不回填
    // （否则会用手动改过的文本会被导入时的原始解析结果覆盖）。
    const blob = await renderOne(active, false)
    app.setTaskProgress(1)
    // 生成预览（blob 实测分辨率/体积）
    const name = makeExportFilename(format.value, active.name.replace(/\.[^.]+$/, ''))
    if (isTauri && exportFolder.value) {
      const { writeBlobTo } = await import('../../platform/fs')
      const written = await writeBlobTo(exportFolder.value, name, blob)
      await showPreview(blob, name, written)
    } else {
      // 未选导出文件夹：保持「预览 → 保存图片」流程（网页端也走此路）
      await showPreview(blob, name)
    }
  } catch (e) {
    window.alert('导出失败：' + (e as Error).message)
  } finally {
    setTimeout(() => app.endTask(), 400)
  }
}

/** 保存预览中的图片：桌面端弹系统保存对话框（Rust 写盘，返回路径），网页端触发浏览器下载 */
async function savePreview() {
  if (!preview.value) return
  const { blob, name } = preview.value
  try {
    if (isTauri) {
      const { saveBlobAs } = await import('../../platform/fs')
      savedPath.value = await saveBlobAs(blob, name)
    } else {
      downloadBlob(blob, name)
      savedPath.value = null
    }
    saved.value = true
  } catch (e) {
    window.alert('保存失败：' + (e as Error).message)
  }
}

/** 桌面端：在资源管理器中定位已保存的文件 */
async function openSavedFolder() {
  if (!savedPath.value) return
  try {
    const { revealInExplorer } = await import('../../platform/fs')
    await revealInExplorer(savedPath.value)
  } catch (e) {
    window.alert('打开文件夹失败：' + (e as Error).message)
  }
}

// ===== 页内批量进度（导出任务卡展示；顶部全局任务条保留不动） =====
const batch = ref({
  running: false,
  done: 0,
  total: 0,
  label: '',
  finished: false,
  cancelled: false,
  success: 0,
  failed: [] as { name: string; reason: string }[],
})
function cancelBatch() {
  if (batch.value.running) batch.value.cancelled = true
}
function resetBatch() {
  batch.value = { running: false, done: 0, total: 0, label: '', finished: false, cancelled: false, success: 0, failed: [] }
}

async function exportBatch() {
  const list = selectedCount.value > 0 ? library.items.filter((i) => i.selected) : library.items
  if (!list.length || batch.value.running || !ensureExportFolder()) return
  // 桌面端写入选定的导出文件夹；网页端逐张触发浏览器下载
  const folder = exportFolder.value
  batch.value = { running: true, done: 0, total: list.length, label: '', finished: false, cancelled: false, success: 0, failed: [] }
  app.startTask('批量导出')
  let last: { blob: Blob; name: string; written?: string } | null = null
  try {
    for (let i = 0; i < list.length; i++) {
      // 中途取消：当前张渲染完成后停止
      if (batch.value.cancelled) break
      const item = list[i]
      batch.value.label = item.name
      const blob = await renderOne(item, backfillExif.value)
      const name = makeExportFilename(format.value, item.name.replace(/\.[^.]+$/, ''))
      if (folder) {
        const { writeBlobTo } = await import('../../platform/fs')
        const written = await writeBlobTo(folder, name, blob)
        last = { blob, name, written }
      } else {
        downloadBlob(blob, name)
        last = { blob, name }
      }
      batch.value.done = i + 1
      batch.value.success++
      app.setTaskProgress((i + 1) / list.length)
      await new Promise((r) => setTimeout(r, 30))
    }
    batch.value.finished = true
  } catch (e) {
    batch.value.failed.push({ name: batch.value.label, reason: (e as Error).message })
    batch.value.finished = true
  } finally {
    batch.value.running = false
    // 批量导出也弹预览（最后一张成功图）；已写盘时弹窗为「已导出」态
    if (last && !batch.value.cancelled) void showPreview(last.blob, last.name, last.written ?? null)
    setTimeout(() => app.endTask(), 400)
  }
}

// ===== 参数批量同步 =====
const syncName = ref('')
function syncToSelected() {
  if (!syncName.value.trim()) syncName.value = '批量同步模板'
  templates.saveCurrent(syncName.value, state, 'all')
  window.alert('已将当前配置保存为模板「' + syncName.value + '」，可在左侧「相框模板库 / 背景模板库」点击应用到各照片。')
  syncName.value = ''
}

// ===== 照片选择（与图库/胶片条多选逻辑一致） =====
function onThumbClick(item: { id: string }, e: MouseEvent) {
  if (e.metaKey || e.ctrlKey) {
    library.toggleSelect(item.id)
  } else if (e.shiftKey) {
    library.rangeSelect(item.id)
  } else {
    library.select(item.id)
  }
}
</script>

<template>
  <div class="export-view">
    <header class="page-head">
      <h2 class="title">导出</h2>
      <p class="sub">配置成品输出参数，支持单张 / 批量导出。所有处理在本地完成。</p>
    </header>

    <!-- 导出文件夹（桌面端）：导出前必须先选定，置顶显眼展示 -->
    <section v-if="isTauri" class="card folder-card" :class="{ missing: !exportFolder }">
      <div class="group-head">
        <Icon name="folder" />
        <h3>导出文件夹</h3>
        <span class="head-hint">{{ exportFolder ? '导出将直接写入此文件夹（重名自动加序号）' : '导出前必须先选定' }}</span>
      </div>
      <div class="row folder-row">
        <span class="folder-path" :title="exportFolder || ''">{{ exportFolder || '未选择 — 请点击「选择文件夹」指定导出位置' }}</span>
        <button class="btn" :class="{ primary: !exportFolder }" @click="chooseExportFolder">选择文件夹</button>
        <button v-if="exportFolder" class="btn dim" @click="clearExportFolder">清除</button>
      </div>
    </section>

    <div class="cards">
      <!-- 输出设置 -->
      <section class="card">
        <div class="group-head">
          <Icon name="photo" />
          <h3>输出设置</h3>
          <span class="head-hint">格式 · 画质 · 尺寸</span>
        </div>
        <div class="row">
          <label>格式</label>
          <div class="seg">
            <button :class="{ on: format === 'png' }" @click="format = 'png'">PNG 无损</button>
            <button :class="{ on: format === 'jpg' }" @click="format = 'jpg'">JPG 高画质</button>
          </div>
        </div>
        <div v-if="format === 'jpg'" class="row">
          <label>画质</label>
          <RangeSlider v-model="jpgQuality" :min="0.5" :max="1" :step="0.01" />
        </div>
        <div class="row">
          <label>超采样</label>
          <div class="seg">
            <button :class="{ on: supersample === 1 }" @click="supersample = 1">1x</button>
            <button :class="{ on: supersample === 2 }" @click="supersample = 2">2x</button>
            <button :class="{ on: supersample === 3 }" @click="supersample = 3">3x</button>
          </div>
        </div>
        <div class="divider" />
        <div class="row">
          <label>批量回填</label>
          <label class="check" title="开启后批量导出的每张照片使用各自导入时解析的 EXIF、相机型号与品牌 Logo">
            <input type="checkbox" v-model="backfillExif" />
            <span>每张照片使用自身 EXIF / 型号 / 品牌</span>
          </label>
        </div>
        <div class="row">
          <label>文本映射</label>
          <label class="check" title="批量导出时按规则替换各照片的 EXIF 文本 / 相机型号 / 镜头型号（仅影响批量回填）">
            <input type="checkbox" v-model="rulesEnabled" />
            <span>启用批量文本映射</span>
          </label>
        </div>
        <div v-if="rulesEnabled" class="row">
          <textarea
            v-model="rulesText"
            class="rules-area"
            rows="3"
            spellcheck="false"
            placeholder="每行一条：查找 => 替换&#10;如 腾龙28-200 E A071 => 腾龙 28-200"
          ></textarea>
        </div>
      </section>

      <!-- 批量同步（次级） -->
      <section class="card secondary">
        <div class="group-head">
          <Icon name="border" />
          <h3>批量同步</h3>
          <span class="head-hint">保存当前配置为模板</span>
        </div>
        <p class="hint">把当前相框/背景配置保存为模板，在左侧模板库一键应用到各照片。</p>
        <div class="row">
          <input v-model="syncName" class="inp" placeholder="模板名称" />
          <button class="btn" @click="syncToSelected">保存为模板</button>
        </div>
      </section>
    </div>

    <!-- 照片选择（网格） -->
    <section class="card select">
      <div class="group-head">
        <Icon name="photo" />
        <h3>选择要导出的照片</h3>
        <span class="count">已选 {{ selectedCount }} / {{ library.items.length }} 张</span>
      </div>
      <div class="row tools">
        <button class="btn" :disabled="!library.items.length" @click="library.selectAll()">全选</button>
        <button class="btn" :disabled="!selectedCount" @click="library.selectNone()">取消全选</button>
        <span class="hint-inline">点击选择 · Ctrl/⌘+点击切换 · Shift+点击范围多选</span>
      </div>
      <div v-if="library.items.length === 0" class="hint">图库暂无照片，请先在图库模块导入。</div>
      <div v-else class="thumb-grid">
        <div
          v-for="item in library.items"
          :key="item.id"
          class="thumb"
          :class="{ selected: item.selected, active: item.id === library.activeId.value }"
          :title="`${item.name}${item.selected ? '（已选中）' : ''}`"
          @click="onThumbClick(item, $event)"
        >
          <img :src="item.thumbUrl || item.url" :alt="item.name" loading="lazy" />
          <span class="thumb-name">{{ item.name }}</span>
          <span v-if="item.selected" class="thumb-check">✓</span>
        </div>
      </div>
    </section>

    <!-- 吸底任务卡 -->
    <section class="card taskbar">
      <div class="estimate" v-if="estimate">
        <span class="est-title">输出</span>
        <span class="est-val">≈ {{ estimate.w }} × {{ estimate.h }} px</span>
        <span v-if="estimate.sizeText" class="est-val">{{ estimate.sizeText }}</span>
      </div>
      <div class="estimate" v-else>
        <span class="est-title">输出</span>
        <span class="est-val">—</span>
      </div>

      <div class="progress-zone">
        <template v-if="batch.running">
          <div class="prog-line">
            <div class="prog-track"><div class="prog-fill" :style="{ width: (batch.total ? (batch.done / batch.total) * 100 : 0) + '%' }" /></div>
            <span class="prog-text">{{ batch.done }}/{{ batch.total }} · {{ batch.label }}</span>
            <button class="btn danger" @click="cancelBatch">取消</button>
          </div>
        </template>
        <template v-else-if="batch.finished">
          <div class="summary">
            <span class="sum-ok">✓ 成功 {{ batch.success }}</span>
            <span v-if="batch.failed.length" class="sum-bad">· 失败 {{ batch.failed.length }}</span>
            <span v-if="batch.cancelled" class="sum-dim">（已取消）</span>
            <button class="btn dim" @click="resetBatch">清除</button>
          </div>
          <div v-if="batch.failed.length" class="fail-list">
            <div v-for="f in batch.failed.slice(0, 5)" :key="f.name" class="fail-item" :title="f.reason">{{ f.name }} — {{ f.reason }}</div>
            <div v-if="batch.failed.length > 5" class="fail-item dim">等 {{ batch.failed.length }} 张失败</div>
          </div>
        </template>
      </div>

      <div class="btns">
        <button class="btn primary big" :disabled="!library.activeId.value || batch.running" @click="exportSingle">导出当前照片</button>
        <button class="btn" :disabled="!targetCount || batch.running" @click="exportBatch">
          批量导出（{{ selectedCount ? selectedCount + ' 张选中' : '全部 ' + targetCount + ' 张' }}）
        </button>
      </div>
    </section>
  </div>

  <!-- 导出预览弹窗 -->
  <div v-if="preview" class="preview-mask" @click.self="closePreview">
    <div class="preview-box">
      <div class="preview-head">
        <span class="preview-title">导出成功</span>
        <button class="preview-close" title="关闭" @click="closePreview">×</button>
      </div>
      <div class="preview-img-wrap" :class="{ zoom: zoom1x }" @click="zoom1x = !zoom1x">
        <img :src="preview.url" :alt="preview.name" class="preview-img" :class="{ one: zoom1x }" />
      </div>
      <div class="preview-foot">
        <span class="preview-name" :title="preview.name">{{ preview.name }}</span>
        <span class="preview-meta">{{ preview.w && preview.h ? preview.w + ' × ' + preview.h + ' px' : '—' }}</span>
        <span class="preview-meta">{{ preview.sizeText }}</span>
        <span v-if="saved && savedPath" class="preview-saved" :title="savedPath">已导出到文件夹 ✓</span>
        <button v-if="saved && savedPath" class="btn primary" @click="openSavedFolder">打开所在文件夹</button>
        <button v-else class="btn primary" @click="savePreview">保存图片</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.export-view {
  height: 100%;
  overflow: auto;
  padding: 16px 20px 12px;
  background: var(--shell);
  max-width: 960px;
  margin: 0 auto;
}
.page-head { margin-bottom: 12px; }
.title {
  font-size: 13px;
  font-weight: 400;
  line-height: 18px;
  margin: 0 0 4px;
  color: var(--text);
}
.sub {
  color: var(--text-dim);
  font-size: 12px;
  font-weight: 400;
  line-height: 16px;
  margin: 0;
}
.cards {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-bottom: 12px;
}
.card {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 0;
  padding: 12px 14px;
}
.card.secondary { opacity: 0.92; }
.group-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 10px;
  color: var(--text-dim);
}
.group-head h3 {
  margin: 0;
  font-size: 12px;
  font-weight: 400;
  line-height: 16px;
  color: var(--text);
  text-transform: uppercase;
  letter-spacing: 0;
}
.head-hint { margin-left: auto; font-size: 11px; color: var(--text-dim); }
.divider { height: 1px; background: var(--border); margin: 10px 0; }
.row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  line-height: 16px;
}
.row > label:first-child {
  width: 56px;
  flex: none;
  font-size: 12px;
  font-weight: 400;
  color: var(--text-dim);
}
.row.tools { margin-bottom: 8px; gap: 8px; }
.seg {
  display: flex;
  border: 1px solid var(--border);
  border-radius: 0;
  overflow: hidden;
  height: 24px;
}
.seg button {
  background: var(--panel-2);
  color: var(--text-dim);
  border: none;
  border-right: 1px solid var(--border);
  padding: 0 14px;
  font-size: 12px;
  font-weight: 400;
  line-height: 16px;
  cursor: pointer;
  height: 100%;
}
.seg button:last-child { border-right: none; }
.seg button:hover { background: var(--hover); color: var(--text); }
.seg button.on {
  background: var(--text);
  color: var(--shell);
}
.check {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  user-select: none;
  font-size: 12px;
  color: var(--text-dim);
}
.check input {
  margin: 0;
}
.rules-area {
  flex: 1;
  min-width: 0;
  height: auto;
  min-height: 54px;
  padding: 4px 8px;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 0;
  color: var(--text);
  font-size: 12px;
  font-weight: 400;
  line-height: 16px;
  font-family: inherit;
  resize: vertical;
}
.inp {
  flex: 1;
  height: 22px;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 0;
  color: var(--text);
  padding: 0 8px;
  font-size: 12px;
  font-weight: 400;
  line-height: 16px;
}
.hint {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-dim);
  margin: 0 0 8px;
  line-height: 16px;
}
.count {
  font-size: 12px;
  font-weight: 400;
  color: var(--text-dim);
  line-height: 16px;
}
.hint-inline {
  font-size: 11px;
  font-weight: 400;
  color: var(--text-dim);
  line-height: 16px;
  margin-left: auto;
}
.thumb-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
  gap: 8px;
  max-height: 260px;
  overflow-y: auto;
  padding: 2px;
}
.thumb {
  position: relative;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 0;
  overflow: hidden;
  cursor: pointer;
}
.thumb:hover {
  background: var(--hover);
  border-color: var(--border);
}
.thumb.selected {
  border-color: var(--accent);
  box-shadow: inset 0 0 0 1px var(--accent);
}
.thumb.active {
  border-color: var(--text);
}
.thumb.selected.active {
  border-color: var(--text);
  box-shadow: inset 0 0 0 1px var(--accent);
}
.thumb img {
  display: block;
  width: 100%;
  height: 76px;
  object-fit: cover;
  background: var(--canvas-empty);
}
.thumb-name {
  display: block;
  padding: 2px 4px;
  font-size: 11px;
  font-weight: 400;
  color: var(--text-dim);
  line-height: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.thumb-check {
  position: absolute;
  top: 2px;
  right: 2px;
  width: 16px;
  height: 16px;
  background: var(--accent);
  color: #fff;
  font-size: 11px;
  font-weight: 400;
  line-height: 16px;
  text-align: center;
}
.btn {
  background: var(--btn-bg);
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 0;
  padding: 0 16px;
  height: 26px;
  font-size: 12px;
  font-weight: 400;
  line-height: 16px;
  cursor: pointer;
}
.btn:hover { background: var(--hover); color: var(--text-normal); }
.btn:active { background: var(--pressed); }
.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.btn.primary {
  background: var(--accent);
  color: var(--text);
  border-color: var(--accent);
}
.btn.primary:hover { background: var(--hover); }
.btn.big { height: 30px; padding: 0 20px; }
.btn.danger { color: var(--text); border-color: var(--accent); }
.btn.dim { opacity: 0.7; height: 20px; padding: 0 8px; font-size: 11px; }
.btns {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  flex: none;
}

/* 导出文件夹卡片（页面顶部，导出前必须选定） */
.folder-card {
  margin-bottom: 14px;
}
.folder-card.missing {
  border-color: #c0392b;
}
.folder-row {
  align-items: center;
}
.folder-card .folder-path {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: var(--text-dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  direction: rtl; /* 长路径省略左侧，保留末级目录名 */
  text-align: left;
}

/* 吸底任务卡 */
.taskbar {
  position: sticky;
  bottom: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 16px;
  border-top: 1px solid var(--border);
  background: var(--panel);
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.18);
}
.estimate { display: flex; align-items: baseline; gap: 8px; flex: none; }
.est-title { font-size: 11px; color: var(--text-dim); }
.est-val { font-size: 12px; color: var(--text); font-variant-numeric: tabular-nums; }
.progress-zone { flex: 1; min-width: 0; }
.prog-line { display: flex; align-items: center; gap: 8px; }
.prog-track { flex: 1; height: 4px; background: var(--panel-2); border: 1px solid var(--border); }
.prog-fill { height: 100%; background: var(--accent); transition: width 0.2s; }
.prog-text { font-size: 11px; color: var(--text-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 40%; }
.summary { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.sum-ok { color: var(--text); }
.sum-bad { color: var(--text-dim); }
.sum-dim { color: var(--text-dim); }
.fail-list { margin-top: 4px; }
.fail-item { font-size: 11px; color: var(--text-dim); line-height: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fail-item.dim { opacity: 0.7; }

/* ===== 导出预览弹窗（无玻璃拟态/无圆角/灰度） ===== */
.preview-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.preview-box {
  max-width: 70vw;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  background: var(--panel);
  border: 1px solid var(--border);
}
.preview-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 28px;
  padding: 0 8px 0 12px;
  border-bottom: 1px solid var(--border);
  background: var(--panel);
}
.preview-title {
  font-size: 13px;
  font-weight: 400;
  line-height: 18px;
  color: var(--text);
}
.preview-close {
  width: 22px;
  height: 22px;
  border: none;
  background: transparent;
  color: var(--text-dim);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
}
.preview-close:hover {
  background: var(--hover);
  color: var(--text);
}
.preview-img-wrap {
  flex: 1;
  min-height: 0;
  overflow: auto;
  background: var(--canvas-loaded);
  padding: 12px;
  cursor: zoom-in;
}
.preview-img-wrap.zoom { cursor: zoom-out; }
.preview-img {
  display: block;
  max-width: 100%;
  max-height: 60vh;
  object-fit: contain;
  margin: 0 auto;
}
.preview-img.one { max-width: none; max-height: none; cursor: zoom-out; }
.preview-foot {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 36px;
  padding: 4px 12px;
  border-top: 1px solid var(--border);
  background: var(--panel);
}
.preview-name {
  flex: 0 1 auto;
  min-width: 0;
  max-width: 40%;
  font-size: 12px;
  font-weight: 400;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.preview-meta { font-size: 11px; color: var(--text-dim); font-variant-numeric: tabular-nums; white-space: nowrap; }
.preview-saved { font-size: 11px; color: var(--text); white-space: nowrap; }
@media (max-width: 860px) {
  .cards { grid-template-columns: 1fr; }
  .taskbar { flex-wrap: wrap; }
}
</style>
