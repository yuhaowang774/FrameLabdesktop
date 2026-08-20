<script setup lang="ts">
// 顶层效果叠加画布：暗角 + 颗粒 + 水印（与导出 exporter 一致，受 layerVisible.info 控制）。
import { onMounted, ref, watch, nextTick } from 'vue'
import {
  drawVignette,
  drawGrain,
  drawWatermark,
  type ImgSource,
} from '../../core/bgRenderer'
import { useFrameConfig } from '../../composables/useFrameConfig'
import { DESIGN_CONTAINER } from '../../core/constants'

const props = defineProps<{
  /** 容器设计高度（px） */
  containerH: number
}>()

const { state } = useFrameConfig()
const canvas = ref<HTMLCanvasElement | null>(null)
let wmImg: ImgSource | null = null

async function ensureWmImage() {
  if (state.watermarkImage && (!wmImg || (wmImg as HTMLImageElement).src !== state.watermarkImage)) {
    const im = new Image()
    im.src = state.watermarkImage
    if (im.complete) wmImg = im
    else {
      await new Promise((res) => {
        im.onload = res
        im.onerror = res
      })
      wmImg = im
    }
  } else if (!state.watermarkImage) {
    wmImg = null
  }
}

function render() {
  const el = canvas.value
  if (!el) return
  const w = DESIGN_CONTAINER
  const h = Math.round(props.containerH)
  el.width = w
  el.height = h
  const ctx = el.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, w, h)
  if (state.layerVisible.info === false) return
  if (state.vignette > 0) drawVignette(ctx, w, h, state.vignette)
  if (state.grain > 0) drawGrain(ctx, w, h, state.grain, 7)
  if (state.showWatermark) {
    drawWatermark(ctx, w, h, {
      text: state.watermarkText,
      image: wmImg,
      opacity: state.watermarkOpacity,
      size: state.watermarkSize,
      angle: state.watermarkAngle,
      tile: state.watermarkTile,
      align: state.watermarkAlign,
      bottom: state.watermarkBottom,
    })
  }
}

onMounted(render)
watch(
  () => [
    props.containerH,
    state.vignette,
    state.grain,
    state.showWatermark,
    state.watermarkText,
    state.watermarkImage,
    state.watermarkOpacity,
    state.watermarkSize,
    state.watermarkAngle,
    state.watermarkTile,
    state.watermarkAlign,
    state.watermarkBottom,
    state.layerVisible.info,
  ],
  async () => {
    await ensureWmImage()
    nextTick(render)
  },
  { deep: true },
)
</script>

<template>
  <canvas ref="canvas" class="effect-overlay"></canvas>
</template>

<style scoped>
.effect-overlay {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  z-index: 4;
  pointer-events: none;
}
</style>
