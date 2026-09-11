<script setup lang="ts">
// 顶层效果叠加画布：暗角 + 颗粒 + 水印（与导出 exporter 一致，受 layerVisible.info 控制）。
import { onMounted, onBeforeUnmount, ref, watch, nextTick } from 'vue'
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
  // 尺寸复用：仅在尺寸变化时重建缓冲
  if (el.width !== w) el.width = w
  if (el.height !== h) el.height = h
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
// rAF 合帧：颗粒 drawGrain 每次重建全画布 ImageData（数十万次随机采样），
// 水印/暗角滑块高频拖动时逐事件重绘代价高；合帧后每帧至多一次。
let renderRaf = 0
function scheduleRender() {
  if (renderRaf) return
  renderRaf = requestAnimationFrame(() => {
    renderRaf = 0
    void (async () => {
      await ensureWmImage()
      nextTick(render)
    })()
  })
}
onBeforeUnmount(() => {
  if (renderRaf) cancelAnimationFrame(renderRaf)
})
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
  scheduleRender,
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
  /* 审查报告 R2：效果层（暗角/颗粒/水印）与导出一致应位于照片与信息层之上。
     此前 z-index:4 低于照片(5)/INFO(6)，预览只看得到背景部分的效果，成片却全图覆盖。 */
  z-index: 7;
  pointer-events: none;
}
</style>
