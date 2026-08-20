<script setup lang="ts">
// 模糊背景画布：使用 bgRenderer 的 cover + 模糊算法，与导出保持一致
import { onMounted, ref, watch } from 'vue'
import { drawBlurredBackground } from '../../core/bgRenderer'
import { useFrameConfig } from '../../composables/useFrameConfig'
import { DESIGN_CONTAINER } from '../../core/constants'

const props = defineProps<{
  image: HTMLImageElement | HTMLCanvasElement | null
  blur: number
}>()

const canvas = ref<HTMLCanvasElement | null>(null)
const { state } = useFrameConfig()
const customImg = ref<HTMLImageElement | null>(null)

// custom 模式下加载自定义背景图
watch(
  () => state.customBgImage,
  (src) => {
    customImg.value = null
    if (src) {
      const im = new Image()
      im.onload = () => {
        customImg.value = im
        render()
      }
      im.src = src
    } else {
      render()
    }
  },
  { immediate: true },
)

function render() {
  const el = canvas.value
  const img = state.bgMode === 'custom' && customImg.value ? customImg.value : props.image
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
    // canvas 内部坐标 = 内容区设计坐标（layout px 1:1），偏移量直接按内容区宽度换算
    const availW = DESIGN_CONTAINER - 2 * state.padding
    const scale = w / availW
    const offX = state.bgOffsetX * scale
    const offY = state.bgOffsetY * scale
    drawBlurredBackground(ctx, img, w, h, props.blur, dim, state.bgScale, offX, offY)
  }
}

onMounted(render)
watch(
  () => [
    props.image,
    props.blur,
    state.bgMode,
    state.bgScale,
    state.bgOffsetX,
    state.bgOffsetY,
  ],
  render,
  { deep: true },
)
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
