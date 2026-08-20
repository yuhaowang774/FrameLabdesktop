<script setup lang="ts">
// 1200px 边框容器：CSS 变量驱动布局，组合背景/主照片/底部信息（可拖拽）
import { computed, ref, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import BgCanvas from './BgCanvas.vue'
import MainPhoto from './MainPhoto.vue'
import FooterInfo from './FooterInfo.vue'
import EffectOverlay from './EffectOverlay.vue'
import SelectableBox from '../common/SelectableBox.vue'
import InfoLayerDisplay from './InfoLayerDisplay.vue'
import { useFrameConfig } from '../../composables/useFrameConfig'
import { useLayers } from '../../composables/useLayers'
import { DESIGN_CONTAINER } from '../../core/constants'
import { mapPhotoRectToConfig, mapBgRectToConfig, bgRectFromConfig } from '../../core/dragMap'
import { rotatedSize } from '../../core/photoEdit'

const props = defineProps<{
  /** 主照片 src（dataURL 或 objectURL） */
  photoSrc: string | null
  /** 背景图元素（原图或自定义图），供 BgCanvas 绘制 */
  bgImage: HTMLImageElement | HTMLCanvasElement | null
}>()

const { state, patch } = useFrameConfig()
const { selectedLayer, isVisible } = useLayers()
const bgBlur = computed(() => state.blur)
const root = ref<HTMLElement | null>(null)

// 屏幕像素 / 设计像素 比例（随窗口缩放实时更新，避免拖拽漂移）
// 关键：ResizeObserver 仅响应 border-box 变化，而祖先 .fit-wrap 的 transform: scale(fitScale)
// 改变不会触发它；必须同时监听 window.resize，用 getBoundingClientRect（含 transform）重新计算。
const contScale = ref(1)
let ro: ResizeObserver | null = null
function updateScale() {
  const rect = root.value?.getBoundingClientRect()
  if (rect && rect.width) contScale.value = rect.width / DESIGN_CONTAINER
}
onMounted(() => {
  updateScale()
  // 子组件先于父组件 Workspace 的 fit() 挂载，fit() 会设置祖先 transform: scale；
  // 下一帧再读一次，确保拿到缩放后的真实屏幕尺寸。
  requestAnimationFrame(updateScale)
  if (root.value && 'ResizeObserver' in window) {
    ro = new ResizeObserver(updateScale)
    ro.observe(root.value)
  }
  window.addEventListener('resize', updateScale)
})
function disposeRo() {
  ro?.disconnect()
  ro = null
  window.removeEventListener('resize', updateScale)
}
onBeforeUnmount(disposeRo)

// ===== 主照片矩形（设计坐标，左上角 + 宽高） =====
// 照片源图原始尺寸（由 MainPhoto 加载后回传）；未加载时给占位 1:1 避免塌缩
const photoNatural = ref<{ w: number; h: number }>({ w: 1, h: 1 })

// 旋转 + 裁剪后的"实际显示比例"（决定选择框宽高，确保所见即所得）
const photoDisplayAspect = computed(() => {
  const r = rotatedSize(photoNatural.value.w, photoNatural.value.h, state.photoRotation)
  const c = state.photoCrop
  const dw = r.w * c.w
  const dh = r.h * c.h
  return dh > 0 ? dw / dh : 1
})

// 内容区设计尺寸（frame-container 的 padding box，绝对定位子元素的包含块）
// 所有 photoX/photoY、bgOffset、logoX 等设计坐标统一使用"内容区坐标系"，原点在内容区左上角。
const availW = computed(() => DESIGN_CONTAINER - state.padding * 2)

const photoRect = computed(() => {
  const w = (availW.value * state.scale) / 100
  const h = w / photoDisplayAspect.value
  // 内容区坐标：x=0 即贴内容区左缘（= 画布左 padding 内侧）
  const x = state.photoX ?? (availW.value - w) / 2
  const y = state.photoY ?? 0
  return { left: x, top: y, width: w, height: h }
})

// 容器设计高度（固定画布，box-sizing: border-box）
// - 非 none 模式：使用固定 canvasH（导入时按初始照片比例计算），照片缩放不改变画布/背景
// - none 模式：无边框，画布高度随照片（铺满）
const containerHDesign = computed(() =>
  state.bgMode === 'none' ? photoRect.value.top + photoRect.value.height : (state.canvasH || photoRect.value.top + photoRect.value.height + state.padding),
)
// 内容区设计高度（= 容器高 - 上下 padding）
const contentHDesign = computed(() => Math.max(0, containerHDesign.value - state.padding * 2))

function onPhotoRect(r: { left: number; top: number; width: number; height: number }) {
  selectedLayer.value = 'photo'
  const cfg = mapPhotoRectToConfig(r, availW.value, state.padding)
  // 保留亚像素精度（避免多次拖拽累积取整漂移）；导出时再四舍五入
  patch({
    photoX: r.left,
    photoY: r.top,
    scale: cfg.scale,
  })
}

// ===== 背景矩形（按图像 cover 宽高比缩放后边界，设计坐标） =====
// 关键：背景必须保持"图像自身宽高比"，而不是容器宽高比，否则竖向缩放会失效/跳动。
function bgImageSize(): { iw: number; ih: number } {
  const img = props.bgImage
  if (!img) return { iw: availW.value, ih: contentHDesign.value }
  if ('naturalWidth' in img && (img as HTMLImageElement).naturalWidth) {
    return {
      iw: (img as HTMLImageElement).naturalWidth,
      ih: (img as HTMLImageElement).naturalHeight,
    }
  }
  if ('width' in img && (img as HTMLCanvasElement).width) {
    return { iw: (img as HTMLCanvasElement).width, ih: (img as HTMLCanvasElement).height }
  }
  return { iw: availW.value, ih: contentHDesign.value }
}

// cover 宽度：图片在内容区内 cover 填充时的像素宽（zoom=1 基准）
const bgCoverW = computed(() => {
  const { iw, ih } = bgImageSize()
  const W = availW.value
  const H = contentHDesign.value
  const s0 = Math.max(W / iw, H / ih)
  return iw * s0
})
const bgAspect = computed(() => {
  const { iw, ih } = bgImageSize()
  return ih / iw
})

const bgRect = computed(() =>
  bgRectFromConfig(
    state.bgScale,
    state.bgOffsetX,
    state.bgOffsetY,
    bgCoverW.value,
    bgAspect.value,
    availW.value,
    contentHDesign.value,
  ),
)

function onBgRect(r: { left: number; top: number; width: number; height: number }) {
  selectedLayer.value = 'bg'
  const cfg = mapBgRectToConfig(r, availW.value, contentHDesign.value, bgCoverW.value)
  patch(cfg)
}

// 主照片加载完成后，记录源图尺寸、自动定位；未拖动页脚则自动布局
function autoPlaceFooter() {
  const placed =
    state.logoX != null || state.logoY != null ||
    state.modelX != null || state.modelY != null ||
    state.exifX != null || state.exifY != null
  if (placed) return
  // 内容区坐标：页脚 x 相对内容区左缘（0 = 左 padding 内侧），y 相对内容区高度
  const contentH = contentHDesign.value
  const baseX =
    state.overlayAlign === 'left'
      ? 0
      : state.overlayAlign === 'right'
        ? availW.value
        : availW.value / 2
  const exifY = Math.max(0, contentH - state.distBottom - state.fontSize)
  const row1Y = Math.max(0, exifY - state.distLogoText - state.logoSize)
  patch({
    logoX: baseX,
    logoY: row1Y,
    modelX: baseX,
    modelY: row1Y,
    exifX: baseX,
    exifY,
  })
}

function onPhotoReady(info: { w: number; h: number }) {
  photoNatural.value = { w: info.w, h: info.h }
  // 首次加载：若未手动定位照片，则按默认居中（保持当前 scale）
  if (state.photoX == null || state.photoY == null) {
    const w = (availW.value * state.scale) / 100
    // 按初始照片高度 + 2*padding 计算并固定画布高度（照片缩放不再改变画布）
    const aspect = photoDisplayAspect.value
    const photoH = aspect > 0 ? w / aspect : w
    patch({
      photoX: Math.round((availW.value - w) / 2),
      photoY: 0,
      canvasH: Math.round(photoH + state.padding * 2),
    })
  }
  nextTick(autoPlaceFooter)
}

// 切换照片：清空手动定位、页脚位置与画布高度，等重新加载后按新比例重新布局
watch(
  () => props.photoSrc,
  () => {
    const reset: Record<string, number | null> = {
      photoX: null,
      photoY: null,
      canvasH: 0,
    }
    if (
      state.logoX != null || state.logoY != null ||
      state.modelX != null || state.modelY != null ||
      state.exifX != null || state.exifY != null
    ) {
      reset.logoX = null
      reset.logoY = null
      reset.modelX = null
      reset.modelY = null
      reset.exifX = null
      reset.exifY = null
    }
    patch(reset as any)
    photoNatural.value = { w: 1, h: 1 }
  },
)
</script>

<template>
  <div
    class="frame-container"
    ref="root"
    :style="{ height: containerHDesign + 'px', background: state.artboardColor }"
    @pointerdown.self="selectedLayer = 'artboard'"
  >
    <!-- 背景层（裁剪，含圆角）；SelectionBox 在裁剪层之外以便手柄不被裁切 -->
    <div class="bg-clip" v-show="isVisible('bg')">
      <BgCanvas :image="bgImage" :blur="bgBlur" class="bg-layer" />
    </div>

    <!-- 背景选择框：拖拽平移 / 角点缩放（保持图像比例） -->
    <SelectableBox
      v-if="state.bgMode !== 'none' && isVisible('bg')"
      :rect="bgRect"
      :scale="contScale"
      :selected="selectedLayer === 'bg'"
      :lock-aspect="true"
      :min-size="100"
      @select="selectedLayer = 'bg'"
      @update:rect="onBgRect"
      class="bg-select"
    />

    <!-- 主照片选择框：拖拽移动 / 角点缩放（保持比例） -->
    <SelectableBox
      v-if="photoSrc && isVisible('photo')"
      :rect="photoRect"
      :scale="contScale"
      :selected="selectedLayer === 'photo'"
      :lock-aspect="true"
      :min-size="60"
      @select="selectedLayer = 'photo'"
      @update:rect="onPhotoRect"
      class="photo-select"
    >
      <MainPhoto :src="photoSrc" :rotation="state.photoRotation" :crop="state.photoCrop" @ready="onPhotoReady" />
    </SelectableBox>

    <!-- 信息图层（顶层：Logo + 相机型号 + EXIF） -->
    <div
      v-show="isVisible('info')"
      class="info-layer"
      :class="{ selected: selectedLayer === 'info' }"
      @pointerdown="selectedLayer = 'info'"
    >
      <FooterInfo @placed="autoPlaceFooter" />
    </div>

    <!-- 顶层 INFO 多元素容器层（自由拖拽排版）：bindTarget 决定继承照片变换与否 -->
    <InfoLayerDisplay
      v-show="isVisible('info')"
      :photo-rect="{ center: { x: photoRect.left + photoRect.width / 2, y: photoRect.top + photoRect.height / 2 }, angleDeg: state.photoRotation }"
      :canvas-w="availW"
      :canvas-h="contentHDesign"
      :scale="contScale"
      :visible="true"
    />

    <!-- 顶层效果叠加：暗角 + 颗粒 + 水印（与导出一致） -->
    <EffectOverlay :container-h="containerHDesign" />
  </div>
</template>

<style scoped>
.frame-container {
  position: relative;
  width: 1200px;
  max-width: 100%;
  padding: var(--frame-padding);
  border-radius: calc(var(--border-radius) + 8px);
  /* 允许选择框手柄溢出容器显示（背景放大时手柄在容器外） */
  overflow: visible;
  background: #0a0a0a;
  box-sizing: border-box;
}
.bg-clip {
  position: absolute;
  inset: 0;
  border-radius: calc(var(--border-radius) + 8px);
  overflow: hidden;
  z-index: 0;
}
.bg-layer {
  z-index: 0;
}
.bg-select {
  z-index: 1;
}
.photo-select {
  z-index: 2;
}
/* 信息图层：铺满容器，作为顶层被点击时选中（不拦截照片/背景拖拽） */
.info-layer {
  position: absolute;
  inset: 0;
  z-index: 3;
  pointer-events: none;
}
.info-layer > * {
  pointer-events: auto;
}
.info-layer.selected {
  outline: 1.5px dashed rgba(64, 169, 255, 0.9);
  outline-offset: -2px;
}
</style>
