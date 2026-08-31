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
  type ExportFormat,
  type ExportOptions,
} from '../../core/exporter'
import type { ImgSource } from '../../core/bgRenderer'
import { isTauri } from '../../platform/env'

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

/** 解析映射规则：每行「查找 => 替换」，空行与缺替换值的行跳过 */
function parseRules(src: string): [string, string][] {
  return src
    .split('\n')
    .map((line) => line.split('=>'))
    .filter((p): p is [string, ...string[]] => p.length >= 2 && !!p[0].trim())
    .map((p) => [p[0].trim(), p.slice(1).join('=>').trim()])
}

/** 按规则表链式替换（未启用映射时原样返回） */
function applyRules(s: string): string {
  if (!rulesEnabled.value || !s) return s
  let out = s
  for (const [from, to] of parseRules(rulesText.value)) out = out.split(from).join(to)
  return out
}

// ===== 导出预览 =====
const preview = ref<{ url: string; name: string; blob: Blob } | null>(null)
function closePreview() {
  if (preview.value) URL.revokeObjectURL(preview.value.url)
  preview.value = null
}

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
  const text = applyRules(
    exif && state.eqFocal
      ? buildExifText(exif.raw, { eqFocal: state.eqFocal, cropFactor: state.cropFactor })
      : (exif?.text ?? ''),
  )
  const dateText = exif?.raw.dateTimeOriginal ? formatDate(exif.raw.dateTimeOriginal, state.dateFormat) : ''
  return {
    ...state,
    exifText: text,
    dateText,
    cameraModel: applyRules(exif?.model ?? ''),
    lensText: applyRules(exif?.lens ?? ''),
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

/** 导出并弹出预览 */
async function exportSingle() {
  const active = library.items.find((i) => i.id === library.activeId.value)
  if (!active) return
  app.startTask('导出单张 · ' + active.name)
  try {
    // 单张导出 = 当前编辑器所见即所得：state 已随照片切换恢复该照片参数，不回填
    // （否则会用手动改过的文本会被导入时的原始解析结果覆盖）。
    const blob = await renderOne(active, false)
    app.setTaskProgress(1)
    // 生成预览
    if (preview.value) URL.revokeObjectURL(preview.value.url)
    const name = makeExportFilename(format.value, active.name.replace(/\.[^.]+$/, ''))
    preview.value = { url: URL.createObjectURL(blob), name, blob }
  } catch (e) {
    window.alert('导出失败：' + (e as Error).message)
  } finally {
    setTimeout(() => app.endTask(), 400)
  }
}

/** 保存预览中的图片：桌面端弹系统保存对话框（Rust 写盘），网页端触发浏览器下载 */
async function savePreview() {
  if (!preview.value) return
  const { blob, name } = preview.value
  if (isTauri) {
    const { saveBlobAs } = await import('../../platform/fs')
    await saveBlobAs(blob, name)
  } else {
    downloadBlob(blob, name)
  }
}

async function exportBatch() {
  const list = selectedCount.value > 0 ? library.items.filter((i) => i.selected) : library.items
  if (!list.length) return
  // 桌面端：先选导出目录；取消则中止。网页端：逐张触发浏览器下载。
  let folder: string | null = null
  if (isTauri) {
    const { pickExportFolder } = await import('../../platform/fs')
    folder = await pickExportFolder()
    if (!folder) return
  }
  app.startTask('批量导出')
  try {
    let last: { blob: Blob; name: string } | null = null
    for (let i = 0; i < list.length; i++) {
      // 逐张反馈：标签显示当前正在渲染的照片（96MP 单张渲染可达十余秒）
      app.setTaskLabel(`批量导出 ${i + 1}/${list.length} · ${list[i].name}`)
      const blob = await renderOne(list[i], backfillExif.value)
      const name = makeExportFilename(format.value, list[i].name.replace(/\.[^.]+$/, ''))
      if (folder) {
        const { writeBlobTo } = await import('../../platform/fs')
        await writeBlobTo(folder, name, blob)
      } else {
        downloadBlob(blob, name)
      }
      last = { blob, name }
      app.setTaskProgress((i + 1) / list.length)
      await new Promise((r) => setTimeout(r, 30))
    }
    // 批量导出也弹预览（最后一张）
    if (last) {
      if (preview.value) URL.revokeObjectURL(preview.value.url)
      preview.value = { url: URL.createObjectURL(last.blob), name: last.name, blob: last.blob }
    }
  } catch (e) {
    window.alert('批量导出失败：' + (e as Error).message)
  } finally {
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
    <h2 class="title">导出</h2>
    <p class="sub">配置成品输出参数，支持单张 / 批量导出。所有处理在本地完成。</p>

    <div class="cards">
      <section class="card">
        <h3>输出设置</h3>
        <div class="row">
          <label>格式</label>
          <div class="seg">
            <button :class="{ on: format === 'png' }" @click="format = 'png'">PNG 无损</button>
            <button :class="{ on: format === 'jpg' }" @click="format = 'jpg'">JPG 高画质</button>
          </div>
        </div>
        <div v-if="format === 'jpg'" class="row">
          <label>画质</label>
          <input type="range" min="0.5" max="1" step="0.01" v-model.number="jpgQuality" />
          <span class="val">{{ jpgQuality.toFixed(2) }}</span>
        </div>
        <div class="row">
          <label>超采样</label>
          <div class="seg">
            <button :class="{ on: supersample === 1 }" @click="supersample = 1">1x</button>
            <button :class="{ on: supersample === 2 }" @click="supersample = 2">2x</button>
            <button :class="{ on: supersample === 3 }" @click="supersample = 3">3x</button>
          </div>
        </div>
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

      <section class="card">
        <h3>批量同步</h3>
        <p class="hint">把当前相框/背景配置保存为模板，应用到多张选中照片。</p>
        <div class="row">
          <input v-model="syncName" class="inp" placeholder="模板名称" />
          <button class="btn primary" @click="syncToSelected">保存为模板</button>
        </div>
      </section>
    </div>

    <section class="card select">
      <h3>选择要导出的照片</h3>
      <div class="row">
        <button class="btn" :disabled="!library.items.length" @click="library.selectAll()">全选</button>
        <button class="btn" :disabled="!selectedCount" @click="library.selectNone()">取消全选</button>
        <span class="count">已选 {{ selectedCount }} / {{ library.items.length }} 张</span>
        <span class="hint-inline">点击选择 · Ctrl/⌘+点击切换 · Shift+点击范围多选</span>
      </div>
      <div v-if="library.items.length === 0" class="hint">图库暂无照片，请先在图库模块导入。</div>
      <div v-else class="thumb-strip">
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

    <section class="card actions">
      <h3>导出任务（{{ targetCount }} 张）</h3>
      <div class="btns">
        <button class="btn primary" :disabled="!library.activeId.value" @click="exportSingle">导出当前照片</button>
        <button class="btn" :disabled="!targetCount" @click="exportBatch">
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
      <div class="preview-img-wrap">
        <img :src="preview.url" :alt="preview.name" class="preview-img" />
      </div>
      <div class="preview-foot">
        <span class="preview-name" :title="preview.name">{{ preview.name }}</span>
        <button class="btn primary" @click="savePreview">保存图片</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.export-view {
  height: 100%;
  overflow: auto;
  padding: 16px 20px;
  background: var(--shell);
}
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
  margin: 0 0 16px;
}
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 8px;
}
.card {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 0;
  padding: 12px;
}
.card h3 {
  margin: 0 0 8px;
  font-size: 12px;
  font-weight: 400;
  line-height: 16px;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0;
}
.row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
  line-height: 16px;
}
.row label {
  width: 56px;
  font-size: 12px;
  font-weight: 400;
  color: var(--text-dim);
}
.seg {
  display: flex;
  border: 1px solid var(--border);
  border-radius: 0;
  overflow: hidden;
  height: 22px;
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
  background: var(--accent);
  color: var(--text-dim);
}
.val {
  font-size: 12px;
  color: var(--text);
  min-width: 36px;
  line-height: 16px;
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
.thumb-strip {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding: 4px 0 6px;
}
.thumb {
  position: relative;
  flex: none;
  width: 96px;
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
  height: 64px;
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
.actions {
  margin-top: 12px;
}
.btns {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

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
}
.preview-img {
  display: block;
  max-width: 100%;
  max-height: 60vh;
  object-fit: contain;
  margin: 0 auto;
}
.preview-foot {
  display: flex;
  align-items: center;
  gap: 12px;
  height: 32px;
  padding: 0 12px;
  border-top: 1px solid var(--border);
  background: var(--panel);
}
.preview-name {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  font-weight: 400;
  color: var(--text-dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
</style>
