<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useFrameConfig } from '../../composables/useFrameConfig'
import { drawRotatedCropped } from '../../core/photoEdit'
import type { PhotoCrop, PhotoRotation } from '../../core/types'

const props = defineProps<{
  src: string
  /** 已解码的源图（复用 App 传入的 Image，避免超大图二次解码）；未提供时内部按 src 加载 */
  image?: HTMLImageElement | null
  rotation: PhotoRotation
  crop: PhotoCrop
}>()
const emit = defineEmits<{ (e: 'ready', info: { w: number; h: number }): void }>()

const { state } = useFrameConfig()
const canvas = ref<HTMLCanvasElement | null>(null)
const fallbackImg = new Image()
fallbackImg.crossOrigin = 'anonymous'

/** 当前源图：优先复用外部传入的已解码 Image，否则用内部加载的 fallback */
function currentImg(): HTMLImageElement {
  return props.image ?? fallbackImg
}

let naturalW = 0
let naturalH = 0

// ===== 大图预览降采样 =====
// 超大源图（如 12000×8000）每帧参与 drawImage 全图重采样是拖拽/缩放卡顿主因。
// 加载时一次性降到长边上限内再供渲染（等比缩放，几何/裁剪数学完全等价）。
// 仅预览路径使用；导出 exporter 仍以原始全分辨率图排版，成品质量不受影响。
const PREVIEW_LONG_MAX = 6144
let drawSrc: HTMLImageElement | HTMLCanvasElement | null = null
let drawW = 0
let drawH = 0

function refreshDrawSource() {
  const im = currentImg()
  const iw = im.naturalWidth
  const ih = im.naturalHeight
  naturalW = iw
  naturalH = ih
  const long = Math.max(iw, ih)
  if (!iw || !ih || long <= PREVIEW_LONG_MAX) {
    drawSrc = im
    drawW = iw
    drawH = ih
    return
  }
  const f = PREVIEW_LONG_MAX / long
  const w = Math.max(1, Math.round(iw * f))
  const h = Math.max(1, Math.round(ih * f))
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  const cx = c.getContext('2d')
  if (!cx) {
    drawSrc = im
    drawW = iw
    drawH = ih
    return
  }
  cx.imageSmoothingEnabled = true
  cx.imageSmoothingQuality = 'high'
  cx.drawImage(im, 0, 0, w, h)
  drawSrc = c
  drawW = w
  drawH = h
}

function maybeEmitReady() {
  if (naturalW && naturalH) emit('ready', { w: naturalW, h: naturalH })
}

function render() {
  if (!naturalW || !naturalH || !canvas.value) return
  const c = canvas.value
  // 画布像素 = 显示框尺寸（CSS 已按真实比例铺满，避免被裁切/拉伸）
  const rect = c.getBoundingClientRect()
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const w = Math.max(1, Math.round(rect.width * dpr))
  const h = Math.max(1, Math.round(rect.height * dpr))
  if (c.width !== w) c.width = w
  if (c.height !== h) c.height = h
  const ctx = c.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, w, h)
  if (drawSrc) {
    drawRotatedCropped(ctx, drawSrc, drawW, drawH, props.rotation, props.crop, w, h)
  }
}

// 监听 canvas 自身尺寸变化：选择框比例/尺寸变化（含首次从占位正方形变为真实比例）时自动重绘
let ro: ResizeObserver | null = null

function load() {
  if (!props.src) return
  const im = currentImg()
  // 复用外部已解码图：直接读自然尺寸（无需等待 onload），避免二次解码大图
  if (props.image) {
    refreshDrawSource()
    maybeEmitReady()
    render()
    return
  }
  im.onload = () => {
    refreshDrawSource()
    maybeEmitReady()
    render()
  }
  im.src = props.src
}

onMounted(() => {
  load()
  render()
  window.addEventListener('resize', render)
  if (canvas.value && 'ResizeObserver' in window) {
    ro = new ResizeObserver(() => render())
    ro.observe(canvas.value)
  }
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', render)
  ro?.disconnect()
  ro = null
})

watch(() => props.src, load)
watch(
  () => [props.rotation, props.crop, state.scale, state.photoX, state.photoY],
  () => render(),
)
</script>

<template>
  <canvas ref="canvas" class="main-photo" :style="{ pointerEvents: 'none' }"></canvas>
</template>

<style scoped>
.main-photo {
  display: block;
  width: 100%;
  height: 100%;
  user-select: none;
  -webkit-user-drag: none;
  border-radius: var(--img-radius);
}
</style>
