<script setup lang="ts">
// 模糊背景画布：使用 bgRenderer 的 cover + 模糊算法，与导出保持一致
import { onMounted, ref, watch } from 'vue'
import { drawBlurredBackground } from '../../core/bgRenderer'
import { useFrameConfig } from '../../composables/useFrameConfig'

const props = defineProps<{
  image: HTMLImageElement | HTMLCanvasElement | null
  blur: number
  /** 画板（容器）设计宽，用于把 bgOffset 设计坐标换算为像素 */
  containerW: number
  /** 画板（容器）设计高 */
  containerH: number
}>()

const canvas = ref<HTMLCanvasElement | null>(null)
const { state } = useFrameConfig()
const customImg = ref<HTMLImageElement | null>(null)

// photo 模式下加载自定义背景图
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
  if (!el) return
  const w = props.containerW
  const h = props.containerH
  // 尺寸复用：仅在尺寸变化时重建缓冲，避免每次 render 强制重新分配 GPU 纹理
  if (el.width !== w) el.width = w
  if (el.height !== h) el.height = h
  const ctx = el.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, w, h)

  if (state.bgMode === 'solid') {
    // 纯色背景：直接填充颜色
    ctx.fillStyle = state.bgColor
    ctx.fillRect(0, 0, w, h)
  } else if (state.bgMode === 'blur') {
    // 背景模糊：原图模糊铺满背景区域（预览用 medium 缩放质量：即将被模糊，细节被抹平，无需 high 级重采样）
    if (props.image) {
      // 主图模糊背景不压暗（dim=1）：隐性 brightness(0.7) 是「模糊后偏暗/色彩不艳」的根因
      drawBlurredBackground(ctx, props.image, w, h, props.blur, 1, state.bgScale, state.bgOffsetX, state.bgOffsetY, 'medium')
    }
  } else if (state.bgMode === 'photo') {
    // 照片填充：自定义图片模糊但保持原亮
    const img = customImg.value || props.image
    if (img) {
      drawBlurredBackground(ctx, img, w, h, props.blur, 1, state.bgScale, state.bgOffsetX, state.bgOffsetY, 'medium')
    }
  }
}

onMounted(render)
watch(
  () => [
    props.image,
    props.blur,
    props.containerW,
    props.containerH,
    state.bgMode,
    state.bgColor,
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
