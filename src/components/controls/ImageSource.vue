<script setup lang="ts">
// 图像源控件：单图上传 + 导出触发（PNG 无损 / JPG 高画质）
import { ref } from 'vue'
import { useFrameConfig } from '../../composables/useFrameConfig'
import { exportAndDownload } from '../../core/exporter'
import GlassModal from '../common/GlassModal.vue'

const props = defineProps<{ sourceImg: HTMLImageElement | null }>()
const emit = defineEmits<{ 'image-ready': [payload: { url: string; img: HTMLImageElement }] }>()

const { state } = useFrameConfig()
const fileInput = ref<HTMLInputElement | null>(null)
const exporting = ref(false)
const status = ref('')

// 统一错误弹窗（阶段 15：图片加载失败 / 导出失败）
const errOpen = ref(false)
const errTitle = ref('')
const errMsg = ref('')

function showError(title: string, msg: string) {
  errTitle.value = title
  errMsg.value = msg
  errOpen.value = true
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('文件已损坏或不是受支持的图片格式'))
    img.src = src
  })
}

async function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  if (!file.type.startsWith('image/')) {
    showError('上传失败', '请选择图片文件')
    input.value = ''
    return
  }
  const url = URL.createObjectURL(file)
  try {
    const img = await loadImage(url)
    emit('image-ready', { url, img })
    status.value = ''
  } catch (err) {
    // 释放无效 objectURL，避免内存泄漏
    URL.revokeObjectURL(url)
    showError('图片加载失败', (err as Error).message || '无法读取该图片')
  }
  input.value = ''
}

async function onExport(format: 'png' | 'jpg') {
  if (!props.sourceImg) {
    showError('无法导出', '请先上传照片')
    return
  }
  exporting.value = true
  status.value = '导出中…'
  try {
    await exportAndDownload(props.sourceImg, state, { format })
    status.value = '已导出'
  } catch (err) {
    const msg = (err as Error).message || '未知错误'
    status.value = '导出失败'
    showError('导出失败', msg)
  } finally {
    exporting.value = false
  }
}

function pick() {
  fileInput.value?.click()
}
</script>

<template>
  <section class="control-block">
    <h4>图像源</h4>
    <button class="full-btn" @click="pick">上传照片</button>
    <div class="export-row">
      <button class="export-btn" :disabled="exporting" @click="onExport('png')">导出 PNG</button>
      <button class="export-btn" :disabled="exporting" @click="onExport('jpg')">导出 JPG</button>
    </div>
    <p class="status" v-if="status">{{ status }}</p>
    <input ref="fileInput" type="file" accept="image/*" @change="onFileChange" hidden />
    <GlassModal
      v-model="errOpen"
      :title="errTitle"
      :message="errMsg"
      :show-cancel="false"
      confirm-text="知道了"
    />
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
.full-btn,
.export-btn {
  padding: 9px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
  cursor: pointer;
  font-size: 13px;
}
.export-btn:hover,
.full-btn:hover {
  background: rgba(255, 255, 255, 0.12);
}
.export-row {
  display: flex;
  gap: 8px;
}
.export-btn {
  flex: 1;
  background: rgba(120, 170, 255, 0.18);
  border-color: rgba(120, 170, 255, 0.4);
}
.status {
  font-size: 12px;
  color: #9ad;
  min-height: 14px;
}
</style>
