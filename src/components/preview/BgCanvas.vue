<script setup lang="ts">
// 模糊背景画布：使用 bgRenderer 的 cover + 模糊算法，与导出保持一致
import { onMounted, ref, watch } from 'vue'
import { drawBlurredBackground } from '../../core/bgRenderer'
import { useFrameConfig } from '../../composables/useFrameConfig'

const props = defineProps<{
  image: HTMLImageElement | HTMLCanvasElement | null
  blur: number
}>()

const canvas = ref<HTMLCanvasElement | null>(null)
const { state } = useFrameConfig()

function render() {
  const el = canvas.value
  const img = props.image
  if (!el) return
  const parent = el.parentElement
  if (!parent) return
  const w = parent.clientWidth
  const h = parent.clientHeight
  el.width = w
  el.height = h
  const ctx = el.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, w, h)
  if (img && state.bgMode !== 'none') {
    // default：原图模糊+变暗；custom：上传图模糊但保持原亮
    const dim = state.bgMode === 'custom' ? 1 : 0.7
    drawBlurredBackground(ctx, img, w, h, props.blur, dim)
  }
}

onMounted(render)
watch(() => [props.image, props.blur, state.bgMode, state.theme], render, { deep: true })
</script>

<template>
  <canvas ref="canvas" class="bg-canvas"></canvas>
</template>

<style scoped>
.bg-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
}
</style>
