<script setup lang="ts">
// 顶层 INFO 多元素层的预览渲染（审查报告 R9）。
// 背景：此前该层只有导出端绘制（exporter → drawInfoLayer），预览完全看不到——用户在
// INFO 面板里添加的文字/EXIF/Logo/分割线会直接出现在成片里（「成片多了没见过的元素」）。
// 本组件用与导出同一个渲染器（core/infoRenderer.drawInfoLayer，预览模式含
// exportable=false 的“仅预览”元素）在画板同尺寸 canvas 上绘制，坐标与导出完全同源。
import { onMounted, onBeforeUnmount, ref, watch, nextTick } from 'vue'
import { useFrameConfig } from '../../composables/useFrameConfig'
import { drawInfoLayer } from '../../core/infoRenderer'
import { modelAlias } from '../../core/modelAlias'
import { DESIGN_CONTAINER } from '../../core/constants'

const props = defineProps<{
  /** 画板设计高度（px） */
  containerH: number
  /** 照片中心 X（画板绝对坐标，设计 px；bindTarget=photo 时构造照片变换矩阵用） */
  photoCx: number
  /** 照片中心 Y（画板绝对坐标，设计 px） */
  photoCy: number
}>()

const { state } = useFrameConfig()
const canvas = ref<HTMLCanvasElement | null>(null)

function render(): void {
  const el = canvas.value
  if (!el) return
  const w = DESIGN_CONTAINER
  const h = Math.max(1, Math.round(props.containerH))
  if (el.width !== w) el.width = w
  if (el.height !== h) el.height = h
  const ctx = el.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, w, h)
  const layer = state.infoLayer
  if (!layer?.enabled || !state.showInfo || state.layerVisible.info === false) return
  // bindTarget=photo：构造与导出同源的照片变换矩阵（设计 px 空间，translate 照片中心 + rotate）
  let outerMatrix: DOMMatrix | undefined
  if (layer.bindTarget === 'photo') {
    outerMatrix = new DOMMatrix().translate(props.photoCx, props.photoCy).rotate(state.photoRotation)
  }
  drawInfoLayer(ctx, layer, {
    exifRaw: state.exifRaw,
    model: modelAlias(state.cameraModel),
    eqFocal: state.eqFocal,
    cropFactor: state.cropFactor,
    outerMatrix,
    canvasCenter: { x: DESIGN_CONTAINER / 2, y: h / 2 },
    unitScale: 1,
    forPreview: true,
  })
}

// rAF 合帧：元素参数（x/y/scale/文字）连续拖动时每帧至多重绘一次
let renderRaf = 0
function scheduleRender(): void {
  if (renderRaf) return
  renderRaf = requestAnimationFrame(() => {
    renderRaf = 0
    nextTick(render)
  })
}
onMounted(render)
onBeforeUnmount(() => {
  if (renderRaf) cancelAnimationFrame(renderRaf)
})
watch(
  () => [
    state.infoLayer,
    state.exifRaw,
    state.cameraModel,
    state.eqFocal,
    state.cropFactor,
    state.photoRotation,
    state.showInfo,
    state.layerVisible.info,
    props.containerH,
    props.photoCx,
    props.photoCy,
  ],
  scheduleRender,
  { deep: true },
)
</script>

<template>
  <canvas ref="canvas" class="info-layer-canvas" />
</template>

<style scoped>
.info-layer-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  /* 层级：INFO 文本层(6) 之上、效果层(8) 之下——与导出绘制顺序一致（R2/R9） */
  z-index: 7;
  pointer-events: none;
}
</style>
