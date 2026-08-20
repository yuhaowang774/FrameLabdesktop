<script setup lang="ts">
// 底部信息预览：品牌 Logo / 相机型号 / EXIF 三个独立模块，各自可在画布上鼠标拖动
import { computed, ref } from 'vue'
import { useFrameConfig } from '../../composables/useFrameConfig'
import { resolveLogoDataURL } from '../../composables/useLogoStore'
import { DESIGN_CONTAINER } from '../../core/constants'

type ItemKey = 'logo' | 'model' | 'exif'

const { state, patch } = useFrameConfig()

const brandName = computed(() => state.brand)

// Logo 由 useLogoStore 渲染内置品牌官方 SVG / 自定义 Logo
const logoSrc = computed(() =>
  state.showLogo ? resolveLogoDataURL(state.brand) : '',
)

// 通用拖拽逻辑（每项独立）
const dragging = ref<ItemKey | null>(null)
const origin = ref({ x: 0, y: 0 })
const start = ref({ x: 0, y: 0 })
const dragEl = ref<HTMLElement | null>(null)

function containerRect(): DOMRect | null {
  const cont = dragEl.value?.closest('.frame-container') as HTMLElement | null
  return cont?.getBoundingClientRect() ?? null
}

function onPointerDown(e: PointerEvent, key: ItemKey) {
  const target = e.currentTarget as HTMLElement
  dragEl.value = target
  const rect = containerRect()
  if (!rect) return
  const scale = rect.width / DESIGN_CONTAINER
  const r = target.getBoundingClientRect()
  origin.value = {
    x: (r.left - rect.left) / scale,
    y: (r.top - rect.top) / scale,
  }
  start.value = { x: e.clientX, y: e.clientY }
  dragging.value = key
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  e.preventDefault()
}

function onPointerMove(e: PointerEvent) {
  if (!dragging.value || !dragEl.value) return
  const rect = containerRect()
  if (!rect) return
  const scale = rect.width / DESIGN_CONTAINER
  let nx = origin.value.x + (e.clientX - start.value.x) / scale
  let ny = origin.value.y + (e.clientY - start.value.y) / scale
  nx = Math.max(0, Math.min(DESIGN_CONTAINER, nx))
  ny = Math.max(0, Math.min(rect.height / scale, ny))
  const k = dragging.value
  patch({
    [k + 'X']: nx,
    [k + 'Y']: ny,
  } as Record<string, number>)
}

function onPointerUp() {
  dragging.value = null
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
}

// 每项绝对定位样式（左上角 = 设计坐标 x/y）
function absStyle(key: ItemKey) {
  const x = state[(key + 'X') as 'logoX']
  const y = state[(key + 'Y') as 'logoY']
  if (x == null || y == null) return {}
  return { left: x + 'px', top: y + 'px', transform: 'none' }
}
</script>

<template>
  <div class="footer-layer">
    <img
      v-if="state.showLogo && logoSrc"
      class="brand-logo drag-item"
      data-item="logo"
      :class="{ dragging: dragging === 'logo' }"
      :src="logoSrc"
      :alt="brandName"
      :style="[absStyle('logo'), { height: 'var(--logo-size)', opacity: 'var(--logo-opacity)' }]"
      draggable="false"
      @pointerdown="onPointerDown($event, 'logo')"
    />
    <span
      class="camera-model drag-item"
      data-item="model"
      v-if="state.showCameraModel"
      :class="{ dragging: dragging === 'model' }"
      :style="[
        absStyle('model'),
        {
          display: 'var(--camera-model-display)',
          font: 'var(--camera-model-italic) var(--camera-model-weight) var(--camera-model-size)/1 var(--camera-model-font-family)',
          opacity: 'var(--camera-model-opacity)',
          transform: 'translate(var(--camera-model-offset-x), var(--camera-model-offset-y))',
        },
      ]"
      @pointerdown="onPointerDown($event, 'model')"
      >{{ state.cameraModel }}</span
    >
    <div
      class="exif-text drag-item"
      data-item="exif"
      v-if="state.showExif"
      :class="{ dragging: dragging === 'exif' }"
      :style="[
        absStyle('exif'),
        {
          display: 'var(--exif-display)',
          font: 'var(--text-weight) var(--font-size)/1 var(--font-family)',
          opacity: 'var(--text-opacity)',
          color: 'var(--footer-text-color)',
        },
      ]"
      @pointerdown="onPointerDown($event, 'exif')"
    >
      {{ state.exifText }}
    </div>
  </div>
</template>

<style scoped>
.footer-layer {
  position: absolute;
  inset: 0;
  z-index: 2;
  pointer-events: none;
}
.drag-item {
  position: absolute;
  cursor: grab;
  user-select: none;
  touch-action: none;
  pointer-events: auto;
  padding: 4px;
}
.drag-item.dragging {
  cursor: grabbing;
}
.brand-logo {
  display: block;
  object-fit: contain;
  width: auto;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.25));
}
.exif-text {
  color: var(--footer-text-color);
  white-space: nowrap;
}
</style>
