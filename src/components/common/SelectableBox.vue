<script setup lang="ts">
// Word 式可选中对象：选中后显示 8 个控制点，支持拖拽移动与缩放。
// 坐标采用"设计像素"（与 1200px 设计稿一致），由父级负责在 fit-scale 容器内定位。
import { ref } from 'vue'
import { computeRect, type Handle, type Rect } from '../../core/rectMath'

const props = defineProps<{
  rect: Rect
  /** 屏幕像素 / 设计像素 的比例（= 容器实际宽度 / 1200） */
  scale: number
  /** 锁定宽高比（图片用，保持原始比例） */
  lockAspect?: boolean
  /** 最小宽高（设计像素） */
  minSize?: number
  selected?: boolean
}>()

const emit = defineEmits<{
  'update:rect': [rect: Rect]
  select: []
}>()

const HANDLES: Handle[] = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']

const dragging = ref(false)

interface DragState {
  mode: Handle
  startX: number
  startY: number
  start: Rect
  /** 按下瞬间实时测量的 屏幕px/设计px 比例（不依赖可能滞后的 props.scale） */
  scale: number
  captureEl: HTMLElement
  pointerId: number
}
let ds: DragState | null = null

function onPointerDown(mode: Handle, e: PointerEvent) {
  e.stopPropagation()
  emit('select')
  // 始终用根元素 .selectable 测量真实缩放比例（handle 本身只有 12px，不能用于计算）。
  // 这样 move 与各方向缩放手柄的换算都一致，且不受 fitScale/zoom 变化后 props.scale 滞后影响。
  const current = e.currentTarget as HTMLElement
  const rootEl = (current.closest('.selectable') as HTMLElement | null) ?? current
  const screenW = rootEl.getBoundingClientRect().width
  const liveScale = props.rect.width > 0 ? screenW / props.rect.width : props.scale
  ds = {
    mode,
    startX: e.clientX,
    startY: e.clientY,
    start: { ...props.rect },
    scale: liveScale || props.scale || 1,
    captureEl: current,
    pointerId: e.pointerId,
  }
  dragging.value = true
  try {
    current.setPointerCapture(e.pointerId)
  } catch {
    /* ignore */
  }
}

function onPointerMove(e: PointerEvent) {
  if (!ds) return
  const dx = (e.clientX - ds.startX) / ds.scale
  const dy = (e.clientY - ds.startY) / ds.scale
  const next = computeRect(ds.mode, ds.start, dx, dy, {
    lockAspect: props.lockAspect,
    minSize: props.minSize,
  })
  emit('update:rect', next)
}

function onPointerUp() {
  if (!ds) return
  dragging.value = false
  try {
    ds.captureEl.releasePointerCapture(ds.pointerId)
  } catch {
    /* ignore */
  }
  ds = null
}
</script>

<template>
  <div
    class="selectable"
    :class="{ selected, dragging }"
    :style="{
      left: rect.left + 'px',
      top: rect.top + 'px',
      width: rect.width + 'px',
      height: rect.height + 'px',
    }"
    @pointerdown="onPointerDown('move', $event)"
    @pointermove="onPointerMove"
    @pointerup="onPointerUp"
  >
    <template v-if="selected">
      <span
        v-for="h in HANDLES"
        :key="h"
        class="handle"
        :class="'h-' + h"
        @pointerdown="onPointerDown(h, $event)"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
      />
    </template>
    <slot />
  </div>
</template>

<style scoped>
.selectable {
  position: absolute;
  cursor: move;
  touch-action: none;
}
.selectable.selected {
  outline: 1px solid var(--slider-thumb);
  outline-offset: 0;
}
.handle {
  position: absolute;
  width: 10px;
  height: 10px;
  background: var(--slider-thumb);
  border: none;
  border-radius: 0;
  transform: translate(-50%, -50%);
  z-index: 5;
  touch-action: none;
}
.h-nw { left: 0; top: 0; cursor: nwse-resize; }
.h-n  { left: 50%; top: 0; cursor: ns-resize; }
.h-ne { left: 100%; top: 0; cursor: nesw-resize; }
.h-e  { left: 100%; top: 50%; cursor: ew-resize; }
.h-se { left: 100%; top: 100%; cursor: nwse-resize; }
.h-s  { left: 50%; top: 100%; cursor: ns-resize; }
.h-sw { left: 0; top: 100%; cursor: nesw-resize; }
.h-w  { left: 0; top: 50%; cursor: ew-resize; }
</style>
