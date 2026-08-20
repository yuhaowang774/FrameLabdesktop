<script setup lang="ts">
import { ref, watch, onMounted, onBeforeUnmount } from 'vue'
import { useFrameConfig } from '../../composables/useFrameConfig'
import { drawRotatedCropped } from '../../core/photoEdit'
import type { PhotoCrop, PhotoRotation } from '../../core/types'

const props = defineProps<{
  src: string
  rotation: PhotoRotation
  crop: PhotoCrop
}>()
const emit = defineEmits<{ (e: 'ready', info: { w: number; h: number }): void }>()

const { state } = useFrameConfig()
const canvas = ref<HTMLCanvasElement | null>(null)
const img = new Image()
img.crossOrigin = 'anonymous'

let naturalW = 0
let naturalH = 0

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
  drawRotatedCropped(ctx, img, naturalW, naturalH, props.rotation, props.crop, w, h)
}

// 监听 canvas 自身尺寸变化：选择框比例/尺寸变化（含首次从占位正方形变为真实比例）时自动重绘
let ro: ResizeObserver | null = null

function load() {
  if (!props.src) return
  img.onload = () => {
    naturalW = img.naturalWidth
    naturalH = img.naturalHeight
    maybeEmitReady()
    render()
  }
  img.src = props.src
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
}
</style>
