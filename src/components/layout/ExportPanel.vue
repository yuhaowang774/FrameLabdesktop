<script setup lang="ts">
// 导出模块（对标 LrC 导出/打印）：格式/画质/尺寸配置、单张/批量导出、进度条、参数批量同步。
import { ref, computed } from 'vue'
import { useLibrary } from '../../composables/useLibrary'
import { useFrameConfig } from '../../composables/useFrameConfig'
import { useAppState } from '../../composables/useAppState'
import { useTemplates } from '../../composables/useTemplates'
import {
  exportFrame,
  downloadBlob,
  makeExportFilename,
  type ExportFormat,
  type ExportOptions,
} from '../../core/exporter'
import type { ImgSource } from '../../core/bgRenderer'

const library = useLibrary()
const { state } = useFrameConfig()
const app = useAppState()
const templates = useTemplates()

const format = ref<ExportFormat>('png')
const jpgQuality = ref(0.95)
const supersample = ref(1)

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

async function renderOne(item: { url: string }): Promise<Blob> {
  const source = await loadImage(item.url)
  const opts: ExportOptions = { format: format.value, jpgQuality: jpgQuality.value, scale: supersample.value }
  if (state.bgMode === 'custom' && state.customBgImage) {
    opts.backgroundImage = await loadImage(state.customBgImage)
  }
  const res = await exportFrame(source as ImgSource, state, opts)
  return res.blob
}

async function exportSingle() {
  const active = library.items.find((i) => i.id === library.activeId.value)
  if (!active) return
  app.startTask('导出单张')
  try {
    const blob = await renderOne(active)
    downloadBlob(blob, makeExportFilename(format.value, active.name.replace(/\.[^.]+$/, '')))
    app.setTaskProgress(1)
  } finally {
    setTimeout(() => app.endTask(), 400)
  }
}

async function exportBatch() {
  const list = selectedCount.value > 0 ? library.items.filter((i) => i.selected) : library.items
  if (!list.length) return
  app.startTask('批量导出')
  for (let i = 0; i < list.length; i++) {
    const blob = await renderOne(list[i])
    downloadBlob(blob, makeExportFilename(format.value, list[i].name.replace(/\.[^.]+$/, '')))
    app.setTaskProgress((i + 1) / list.length)
    await new Promise((r) => setTimeout(r, 30))
  }
  setTimeout(() => app.endTask(), 400)
}

// ===== 参数批量同步（对标 LrC 同步设置） =====
const syncName = ref('')
function syncToSelected() {
  if (!syncName.value.trim()) syncName.value = '批量同步模板'
  templates.saveCurrent(syncName.value, state, 'all')
  window.alert('已将当前配置保存为模板「' + syncName.value + '」，可在左侧「相框模板库 / 背景模板库」点击应用到各照片。')
  syncName.value = ''
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
      </section>

      <section class="card">
        <h3>批量同步（对标 LrC 同步设置）</h3>
        <p class="hint">把当前相框/背景配置保存为模板，应用到多张选中照片。</p>
        <div class="row">
          <input v-model="syncName" class="inp" placeholder="模板名称" />
          <button class="btn primary" @click="syncToSelected">保存为模板</button>
        </div>
      </section>
    </div>

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
</template>

<style scoped>
.export-view {
  height: 100%;
  overflow: auto;
  padding: 22px 26px;
  background: var(--bg);
}
.title {
  font-size: 20px;
  margin: 0;
}
.sub {
  color: var(--text-dim);
  font-size: 13px;
  margin: 6px 0 18px;
}
.cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 16px;
}
.card {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 16px;
}
.card h3 {
  margin: 0 0 12px;
  font-size: 14px;
}
.row {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 12px;
}
.row label {
  width: 56px;
  font-size: 13px;
  color: var(--text-dim);
}
.seg {
  display: flex;
  border: 1px solid var(--border);
  border-radius: 7px;
  overflow: hidden;
}
.seg button {
  background: var(--panel-2);
  color: var(--text-dim);
  border: none;
  padding: 6px 14px;
  font-size: 12px;
  cursor: pointer;
}
.seg button.on {
  background: var(--accent);
  color: #fff;
}
.val {
  font-size: 12px;
  color: var(--text);
  min-width: 36px;
}
.inp {
  flex: 1;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 7px;
  color: var(--text);
  padding: 7px 9px;
  font-size: 13px;
}
.hint {
  font-size: 12px;
  color: var(--text-dim);
  margin: 0 0 10px;
}
.btn {
  background: var(--panel-2);
  border: 1px solid var(--border);
  color: var(--text);
  border-radius: 8px;
  padding: 9px 16px;
  font-size: 13px;
  cursor: pointer;
}
.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.btn.primary {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}
.actions {
  margin-top: 16px;
}
.btns {
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
}
</style>
