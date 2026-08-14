<script setup lang="ts">
// 批量处理（阶段 13）
// 流程：选预设配置（历史记录） → 选多张图 → 可选回填 EXIF → 逐张导出下载，单张失败跳过并汇总。
import { ref, computed } from 'vue'
import { useFrameConfig } from '../../composables/useFrameConfig'
import { useHistory, type HistoryItem } from '../../composables/useHistory'
import { parseExif } from '../../composables/useExif'
import { exportFrame, downloadBlob, makeExportFilename, type ExportFormat } from '../../core/exporter'
import type { FrameConfig } from '../../core/types'

const { state } = useFrameConfig()
const { items: history } = useHistory()

const CURRENT = '__current__'

// 预设来源：历史记录项 + 当前配置
const presetOptions = computed(() => [
  { value: CURRENT, label: '使用当前配置' },
  ...history.value.map((h: HistoryItem) => ({ value: String(h.ts), label: h.name })),
])
const selectedPreset = ref<string>(CURRENT)

function getPresetConfig(): FrameConfig {
  if (selectedPreset.value === CURRENT) {
    return JSON.parse(JSON.stringify(state)) as FrameConfig
  }
  const item = history.value.find((h) => String(h.ts) === selectedPreset.value)
  return item ? (JSON.parse(JSON.stringify(item.config)) as FrameConfig) : (JSON.parse(JSON.stringify(state)) as FrameConfig)
}

const fileInput = ref<HTMLInputElement | null>(null)
const files = ref<File[]>([])
const refillExif = ref(true)
const format = ref<ExportFormat>('png')

const running = ref(false)
const progress = ref({ done: 0, total: 0, ok: 0, fail: 0 })
const failed = ref<string[]>([])
const finished = ref(false)

function pickFiles() {
  fileInput.value?.click()
}
function onFiles(e: Event) {
  const input = e.target as HTMLInputElement
  const list = Array.from(input.files ?? [])
  files.value = list.filter((f) => f.type.startsWith('image/'))
  finished.value = false
  input.value = ''
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

function baseName(file: File): string {
  return file.name.replace(/\.[^.]+$/, '') || 'photo'
}

async function start() {
  if (!files.value.length || running.value) return
  running.value = true
  finished.value = false
  failed.value = []
  progress.value = { done: 0, total: files.value.length, ok: 0, fail: 0 }

  for (const file of files.value) {
    const preset = getPresetConfig()
    // 回填 EXIF：用该图自身的 EXIF 覆盖预设里的 exif 文本
    if (refillExif.value) {
      try {
        const exif = await parseExif(file)
        preset.exifText = exif.text
        preset.showExif = true
      } catch {
        // 无 EXIF 则沿用预设（保持 showExif 原值）
      }
    }
    try {
      const url = URL.createObjectURL(file)
      const img = await loadImage(url)
      const result = await exportFrame(img, preset, { format: format.value })
      downloadBlob(result.blob, makeExportFilename(result.format, baseName(file)))
      URL.revokeObjectURL(url)
      progress.value.ok++
    } catch {
      progress.value.fail++
      failed.value.push(file.name)
    } finally {
      progress.value.done++
    }
    // 间隔，避免浏览器批量下载被拦截
    await new Promise((r) => setTimeout(r, 120))
  }

  running.value = false
  finished.value = true
}

function clearFiles() {
  files.value = []
  finished.value = false
}
</script>

<template>
  <section class="control-block">
    <h4>批量处理</h4>

    <div class="field">
      <label>预设</label>
      <select v-model="selectedPreset" class="select" :disabled="running">
        <option v-for="o in presetOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
    </div>

    <div class="row">
      <label class="toggle">
        <input type="checkbox" v-model="refillExif" :disabled="running" />
        回填 EXIF
      </label>
      <select v-model="format" class="mini-select" :disabled="running">
        <option value="png">PNG 无损</option>
        <option value="jpg">JPG 高画质</option>
      </select>
    </div>

    <button class="full-btn" :disabled="running" @click="pickFiles">选择图片（可多选）</button>
    <p v-if="files.length" class="file-count">已选 {{ files.length }} 张</p>

    <button
      class="run-btn"
      :disabled="running || !files.length"
      @click="start"
    >
      {{ running ? `处理中 ${progress.done}/${progress.total}` : '开始批量导出' }}
    </button>

    <p v-if="running" class="status">
      成功 {{ progress.ok }} · 失败 {{ progress.fail }}
    </p>
    <p v-else-if="finished" class="status">
      完成：成功 {{ progress.ok }} 张，失败 {{ progress.fail }} 张
    </p>

    <ul v-if="failed.length" class="fail-list">
      <li v-for="(f, i) in failed" :key="i">{{ f }}</li>
    </ul>

    <button v-if="files.length && !running" class="link-btn" @click="clearFiles">清除已选</button>

    <input ref="fileInput" type="file" accept="image/*" multiple @change="onFiles" hidden />
  </section>
</template>

<style scoped>
.control-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
h4 {
  font-size: 13px;
  color: #aaa;
  margin-bottom: 2px;
}
.field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 13px;
  color: #ccc;
}
.select,
.mini-select {
  padding: 7px 9px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(0, 0, 0, 0.3);
  color: #fff;
  font-size: 13px;
}
.select {
  width: 60%;
}
.mini-select {
  flex: 1;
}
.row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  color: #ccc;
  white-space: nowrap;
}
.full-btn,
.run-btn {
  padding: 9px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
  cursor: pointer;
  font-size: 13px;
}
.run-btn {
  background: rgba(120, 170, 255, 0.18);
  border-color: rgba(120, 170, 255, 0.4);
}
.full-btn:hover,
.run-btn:hover:not(:disabled) {
  background: rgba(255, 255, 255, 0.12);
}
.run-btn:disabled,
.full-btn:disabled {
  opacity: 0.5;
  cursor: default;
}
.file-count {
  font-size: 12px;
  color: #9ad;
}
.status {
  font-size: 12px;
  color: #9ad;
  min-height: 14px;
}
.fail-list {
  list-style: none;
  margin: 0;
  padding: 6px 8px;
  border-radius: 7px;
  background: rgba(255, 90, 90, 0.12);
  font-size: 12px;
  color: #ffb3b3;
  max-height: 120px;
  overflow-y: auto;
}
.fail-list li {
  padding: 1px 0;
  word-break: break-all;
}
.link-btn {
  align-self: flex-start;
  background: none;
  border: none;
  color: #89a;
  cursor: pointer;
  font-size: 12px;
  padding: 0;
  text-decoration: underline;
}
</style>