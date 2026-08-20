<script setup lang="ts">
// 中间主画布工作区：承载预览容器，fit 适配 + 用户缩放 + 拖拽平移 + Before/After 对比 + 标尺。
import { ref, onMounted, onBeforeUnmount, watch, computed } from 'vue'
import { useViewer } from '../../composables/useViewer'
import FrameContainer from '../preview/FrameContainer.vue'
import { DESIGN_CONTAINER } from '../../core/constants'

const props = defineProps<{
  photoSrc: string | null
  bgImage: HTMLImageElement | null
}>()

const viewer = useViewer()

const stage = ref<HTMLElement | null>(null)
const fitWrap = ref<HTMLElement | null>(null)
const fitScale = ref(1)
const dragging = ref(false)
const dragStart = ref({ x: 0, y: 0, px: 0, py: 0 })
// split/slide 对比分割位置 0..1
const splitPos = ref(0.5)

const beforeImg = ref<HTMLImageElement | null>(null)
watch(
  () => props.photoSrc,
  (src) => {
    beforeImg.value = null
    if (src) {
      const im = new Image()
      im.onload = () => (beforeImg.value = im)
      im.src = src
    }
  },
  { immediate: true },
)

function fit() {
  const el = stage.value
  const wrap = fitWrap.value
  if (!el || !wrap) return
  const frame = el.querySelector('.frame-container') as HTMLElement | null
  const frameW = frame ? frame.offsetWidth : DESIGN_CONTAINER
  const frameH = frame ? frame.offsetHeight : DESIGN_CONTAINER
  const cs = getComputedStyle(el)
  const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight)
  const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom)
  const availW = el.clientWidth - padX
  const availH = el.clientHeight - padY
  const scale = Math.max(0.05, Math.min(availW / frameW, availH / frameH, 1))
  fitScale.value = scale
  wrap.style.width = `${frameW * scale}px`
  wrap.style.height = `${frameH * scale}px`
}

let frameRO: ResizeObserver | null = null
onMounted(() => {
  fit()
  window.addEventListener('resize', fit)
  const frame = stage.value?.querySelector('.frame-container') as HTMLElement | null
  if (frame && 'ResizeObserver' in window) {
    frameRO = new ResizeObserver(() => fit())
    frameRO.observe(frame)
  }
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', fit)
  frameRO?.disconnect()
  frameRO = null
})

// ===== 滚轮缩放（叠加在 fit 之上） =====
function onWheel(e: WheelEvent) {
  if (!e.ctrlKey && !e.metaKey && e.deltaY === 0) return
  e.preventDefault()
  const factor = e.deltaY < 0 ? 1.1 : 0.9
  viewer.zoomBy(factor - 1)
}
// ===== 拖拽平移 =====
function onPointerDown(e: PointerEvent) {
  if (viewer.zoom.value <= 1 && viewer.panX.value === 0 && viewer.panY.value === 0) return
  dragging.value = true
  dragStart.value = { x: e.clientX, y: e.clientY, px: viewer.panX.value, py: viewer.panY.value }
  ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
}
function onPointerMove(e: PointerEvent) {
  if (!dragging.value) return
  viewer.setPan(
    dragStart.value.px + (e.clientX - dragStart.value.x),
    dragStart.value.py + (e.clientY - dragStart.value.y),
  )
}
function onPointerUp(e: PointerEvent) {
  dragging.value = false
  ;(e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId)
}

// 总缩放 = fit * 用户 zoom
const totalScale = computed(() => fitScale.value * viewer.zoom.value)
const compareActive = computed(() => viewer.compare.value !== 'off')

// split 对比 clip（after 层右半显示，before 层左半显示）
const afterClip = computed(() => {
  const p = splitPos.value * 100
  if (viewer.compare.value === 'split') return `inset(0 0 0 ${p}%)`
  if (viewer.compare.value === 'slide' && !viewer.beforeVisible.value) return `inset(0 0 0 ${p}%)`
  return 'none'
})
const beforeClip = computed(() => {
  const p = splitPos.value * 100
  if (viewer.compare.value === 'split') return `inset(0 ${100 - p}% 0 0)`
  if (viewer.compare.value === 'slide' && viewer.beforeVisible.value) return `inset(0 ${100 - p}% 0 0)`
  return 'none'
})

function onSplitMove(e: PointerEvent) {
  const wrap = fitWrap.value
  if (!wrap) return
  const rect = wrap.getBoundingClientRect()
  splitPos.value = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
}
const splitDragging = ref(false)
function startSplit(e: PointerEvent) {
  splitDragging.value = true
  onSplitMove(e)
  window.addEventListener('pointermove', onSplitMove)
  window.addEventListener('pointerup', endSplit)
}
function endSplit() {
  splitDragging.value = false
  window.removeEventListener('pointermove', onSplitMove)
  window.removeEventListener('pointerup', endSplit)
}
</script>

<template>
  <section class="workspace">
    <!-- 标尺 -->
    <div v-if="viewer.showRulers.value" class="rulers">
      <div class="ruler-corner" />
      <div class="ruler ruler-h" />
      <div class="ruler ruler-v" />
    </div>

    <div
      class="stage"
      :class="{ grab: dragging }"
      ref="stage"
      @wheel="onWheel"
    >
      <div
        class="fit-wrap"
        ref="fitWrap"
        :style="{
          transform: `translate(${viewer.panX.value}px, ${viewer.panY.value}px) scale(${totalScale})`,
          transformOrigin: 'top left',
          cursor: dragging ? 'grabbing' : 'default',
        }"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
      >
        <!-- Before：原图（仅主照片，无装饰） -->
        <div v-if="compareActive" class="before-layer" :style="{ clipPath: beforeClip }">
          <img v-if="beforeImg" :src="props.photoSrc ?? ''" alt="before" class="before-img" />
        </div>

        <FrameContainer
          class="after-layer"
          :class="{ compare: compareActive }"
          :photo-src="photoSrc"
          :bg-image="bgImage"
          :style="{ clipPath: afterClip }"
        />

        <!-- 对比分割线手柄 -->
        <div
          v-if="compareActive"
          class="split-handle"
          :style="{ left: splitPos * 100 + '%' }"
          @pointerdown.stop="startSplit"
        >
          <span class="split-line" />
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.workspace {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  background: #2a2a2a;
}
.rulers {
  display: grid;
  grid-template-columns: 18px 1fr;
  grid-template-rows: 18px 1fr;
  background: #161616;
  border-bottom: 1px solid #222;
}
.ruler-corner {
  background: #1d1d1d;
  border-right: 1px solid #222;
  border-bottom: 1px solid #222;
}
.ruler {
  background-image: repeating-linear-gradient(
    to right,
    #555 0,
    #555 1px,
    transparent 1px,
    transparent 40px
  );
}
.ruler-v {
  grid-column: 1;
  grid-row: 2;
  background-image: repeating-linear-gradient(
    to bottom,
    #555 0,
    #555 1px,
    transparent 1px,
    transparent 40px
  );
  border-right: 1px solid #222;
}
.ruler-h {
  grid-column: 2;
  grid-row: 1;
  border-bottom: 1px solid #222;
}

.stage {
  flex: 1;
  overflow: hidden;
  position: relative;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 24px;
  background: #2a2a2a;
}
.stage.grab {
  cursor: grabbing;
}
.fit-wrap {
  position: relative;
  width: 1200px;
  flex: none;
}
.after-layer.compare {
  position: absolute;
  inset: 0;
}
.before-layer {
  position: absolute;
  inset: 0;
  background: #000;
  z-index: 5;
  overflow: hidden;
}
.before-img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}
.split-handle {
  position: absolute;
  top: 0;
  bottom: 0;
  width: 2px;
  z-index: 6;
  cursor: ew-resize;
  transform: translateX(-1px);
}
.split-line {
  position: absolute;
  left: 50%;
  top: 0;
  bottom: 0;
  width: 2px;
  background: rgba(255, 255, 255, 0.85);
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.6);
  transform: translateX(-50%);
}
</style>
