<script setup lang="ts">
// 图像源控件：单图上传（导出已拆至 ExportActions）。
// 桌面端：经 Rust 对话框选择本地图片（asset URL 引用路径）；网页端：file input。
import { ref } from 'vue'
import { useFrameConfig } from '../../composables/useFrameConfig'
import { parseExif } from '../../composables/useExif'
import { useSourceFile } from '../../composables/useSourceFile'
import { editingPhoto } from '../../composables/useUi'
import { isTauri } from '../../platform/env'
import { pickImageFiles, assetUrl, readLocalBytes } from '../../platform/fs'
import GlassModal from '../common/GlassModal.vue'

const emit = defineEmits<{ 'image-ready': [payload: { url: string; img: HTMLImageElement }] }>()

const { state, patch } = useFrameConfig()
const { setSourceFile, setSourcePath } = useSourceFile()
const fileInput = ref<HTMLInputElement | null>(null)

// 统一错误弹窗（图片加载失败）
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

/** EXIF 自动识别与参数回填（File 与 ArrayBuffer 双端通用） */
async function applyExif(source: File | ArrayBuffer) {
  const exif = await parseExif(source)
  const patchData: Record<string, unknown> = { exifText: exif.text, showExif: true }
  if (exif.model) {
    patchData.cameraModel = exif.model
    patchData.showCameraModel = true
  }
  if (exif.brandId) {
    patchData.brand = exif.brandId
  }
  patch(patchData)
}

/** 桌面端：Rust 对话框选择本地图片 */
async function pickDesktop() {
  const list = await pickImageFiles()
  if (!list.length) return
  const entry = list[0]
  const url = assetUrl(entry.path)
  try {
    const img = await loadImage(url)
    emit('image-ready', { url, img })
    setSourcePath(entry.path)
    try {
      const bytes = await readLocalBytes(entry.path)
      await applyExif(bytes)
    } catch {
      /* 无 EXIF 或解析失败：留空，用户可手动填写 */
    }
  } catch (err) {
    showError('图片加载失败', (err as Error).message || '无法读取该图片')
  }
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
    // 记录当前主图文件，供"识别 Exif"复用
    setSourceFile(file)
    // 上传主图时自动识别 EXIF 参数（失败不阻断主流程）
    try {
      await applyExif(file)
    } catch {
      /* 无 EXIF 或解析失败：留空，用户可手动填写 */
    }
  } catch (err) {
    // 释放无效 objectURL，避免内存泄漏
    URL.revokeObjectURL(url)
    showError('图片加载失败', (err as Error).message || '无法读取该图片')
  }
  input.value = ''
}

function pick() {
  if (isTauri) {
    void pickDesktop()
    return
  }
  fileInput.value?.click()
}
</script>

<template>
  <section class="control-block">
    <h4>图像源</h4>
    <button class="full-btn" @click="pick">上传照片</button>
    <input ref="fileInput" type="file" accept="image/*" @change="onFileChange" hidden />
    <div v-if="state.photoSrc" class="preview-thumb">
      <img :src="state.photoSrc" alt="预览" />
      <div class="thumb-actions">
        <button class="mini-btn" @click="editingPhoto = true" title="旋转 / 裁剪照片">编辑照片</button>
        <button class="mini-btn ghost" @click="pick" title="重新选择">更换</button>
      </div>
    </div>
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
.full-btn {
  padding: 9px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
  cursor: pointer;
  font-size: 13px;
}
.full-btn:hover {
  background: rgba(255, 255, 255, 0.12);
}
.preview-thumb {
  position: relative;
  margin-top: 4px;
  border-radius: 10px;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.1);
}
.preview-thumb img {
  display: block;
  width: 100%;
  max-height: 180px;
  object-fit: contain;
  background: #0c0c0c;
}
.thumb-actions {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  gap: 6px;
  padding: 8px;
  background: linear-gradient(to top, rgba(0, 0, 0, 0.7), transparent);
}
.mini-btn {
  flex: 1;
  padding: 7px 8px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.18);
  background: rgba(255, 255, 255, 0.12);
  color: #fff;
  cursor: pointer;
  font-size: 12px;
}
.mini-btn:hover {
  background: rgba(255, 255, 255, 0.22);
}
.mini-btn.ghost {
  background: rgba(0, 0, 0, 0.35);
}
</style>
