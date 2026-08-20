<script setup lang="ts">
// 顶层 INFO 信息层预览浮层（DOM/SVG）
// ----------------------------------------------------------------------------
// 渲染 infoLayer.elements 的可视化预览，并提供拖拽 / 四角缩放 / 旋转交互。
// 仅负责预览交互，导出时不渲染（见 core/infoRenderer）。
//
// 坐标空间：本组件位于 FrameContainer 内，与照片/背景选择框共享同一设计坐标系
// （原点 = frame-container 内容左上角，1 单位 = 1 设计 px）。父级通过 transform:scale
// 适配屏幕，因此所有屏幕换算都基于 frame-container 的 getBoundingClientRect。
//
// bindTarget 处理：
//   - 'canvas'：元素坐标 (x,y) 相对画布中心 (600, containerH/2)
//   - 'photo' ：元素坐标 (x,y) 相对照片中心，整体再随照片旋转/平移
import { computed, ref } from 'vue'
import { useInfoLayer } from '../../composables/useInfoLayer'
import { resolveExifTemplate } from '../../core/infoRenderer'
import { useFrameConfig } from '../../composables/useFrameConfig'
import { resolveLogoDataURL } from '../../composables/useLogoStore'
import type { InfoElement } from '../../core/types'

const props = defineProps<{
  photoRect: { center: { x: number; y: number }; angleDeg: number }
  /** 内容区设计宽度（availW） */
  canvasW: number
  /** 内容区设计高度 */
  canvasH: number
  scale: number // 父级缩放比（design px → 屏幕 px），用于指针事件换算
  visible: boolean
}>()

const { layer, elements, selectedIds, select, selectOnly, clearSelection, updateElement, snap, snapEnabled } = useInfoLayer()
const { state } = useFrameConfig()
// EXIF 字段直接取自全局参数（已由上传流程写入 state.exifRaw / cameraModel）
const exifRaw = computed(() => state.exifRaw)
const cameraModel = computed(() => state.cameraModel)

// 画布中心 = 内容区中心（内容区坐标系，与预览 DOM 绝对定位一致）
const canvasCx = computed(() => props.canvasW / 2)
const canvasCy = computed(() => props.canvasH / 2)

// 元素中心在「frame-container 设计坐标系」中的位置
function designPos(el: InfoElement): { x: number; y: number } {
  if (layer.value.bindTarget === 'photo') {
    const a = (props.photoRect.angleDeg * Math.PI) / 180
    return {
      x: props.photoRect.center.x + el.x * Math.cos(a) - el.y * Math.sin(a),
      y: props.photoRect.center.y + el.x * Math.sin(a) + el.y * Math.cos(a),
    }
  }
  return { x: canvasCx.value + el.x, y: canvasCy.value + el.y }
}

// 元素样式：绝对定位到设计坐标，以中心为原点做旋转/缩放
function elStyle(el: InfoElement) {
  const p = designPos(el)
  return {
    left: p.x + 'px',
    top: p.y + 'px',
    transform: `translate(-50%, -50%) rotate(${el.rotate}deg) scale(${el.scale})`,
    opacity: el.opacity,
    zIndex: el.zIndex,
  }
}

// 元素显示文本 / Logo
function elemText(el: InfoElement): string {
  if (el.type === 'text') return el.text
  if (el.type === 'exif') return resolveExifTemplate(el.template, exifRaw.value, cameraModel.value)
  return ''
}
function logoSrc(el: InfoElement): string {
  if (el.type === 'logo' && el.logoId !== 'none') return resolveLogoDataURL(el.logoId)
  return ''
}

// 拖拽中临时吸附参考线（设计坐标）
const guideX = ref<number | null>(null)
const guideY = ref<number | null>(null)

// ===== frame-container 屏幕矩形 =====
function containerRect(): DOMRect | null {
  const root = (document.querySelector('.frame-container') as HTMLElement | null)
  return root?.getBoundingClientRect() ?? null
}
// 设计坐标 → 屏幕坐标
function designToScreenX(dx: number): number {
  const rect = containerRect()
  if (!rect) return 0
  return rect.left + dx * (rect.width / 1200)
}
function designToScreenY(dy: number): number {
  const rect = containerRect()
  if (!rect) return 0
  return rect.top + dy * (rect.width / 1200)
}

// ===== 指针交互 =====
interface DragState {
  mode: 'move' | 'scale' | 'rotate'
  id: string
  startX: number
  startY: number
  origX: number
  origY: number
  origScale: number
  origRotate: number
  cx: number
  cy: number
  startAngle: number
  startDist: number
}
let drag: DragState | null = null

function onPointerDownMove(e: PointerEvent, el: InfoElement) {
  e.stopPropagation()
  if (!selectedIds.value.has(el.id)) {
    if (e.shiftKey) select(el.id, true)
    else selectOnly(el.id)
  } else if (e.shiftKey) {
    select(el.id, true)
    return
  }
  drag = {
    mode: 'move',
    id: el.id,
    startX: e.clientX,
    startY: e.clientY,
    origX: el.x,
    origY: el.y,
    origScale: el.scale,
    origRotate: el.rotate,
    cx: 0,
    cy: 0,
    startAngle: 0,
    startDist: 0,
  }
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
}

function onPointerDownScale(e: PointerEvent, el: InfoElement, _corner: 'tl' | 'tr' | 'bl' | 'br') {
  e.stopPropagation()
  selectOnly(el.id)
  const d = designPos(el)
  const cxS = designToScreenX(d.x)
  const cyS = designToScreenY(d.y)
  drag = {
    mode: 'scale',
    id: el.id,
    startX: e.clientX,
    startY: e.clientY,
    origX: el.x,
    origY: el.y,
    origScale: el.scale,
    origRotate: el.rotate,
    cx: d.x,
    cy: d.y,
    startAngle: 0,
    startDist: Math.hypot(e.clientX - cxS, e.clientY - cyS),
  }
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
}

function onPointerDownRotate(e: PointerEvent, el: InfoElement) {
  e.stopPropagation()
  selectOnly(el.id)
  const d = designPos(el)
  const cxS = designToScreenX(d.x)
  const cyS = designToScreenY(d.y)
  drag = {
    mode: 'rotate',
    id: el.id,
    startX: e.clientX,
    startY: e.clientY,
    origX: el.x,
    origY: el.y,
    origScale: el.scale,
    origRotate: el.rotate,
    cx: d.x,
    cy: d.y,
    startAngle: Math.atan2(e.clientY - cyS, e.clientX - cxS),
    startDist: 0,
  }
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
}

function onPointerMove(e: PointerEvent) {
  if (!drag) return
  const el = elements.value.find((x) => x.id === drag!.id)
  if (!el) return
  if (drag.mode === 'move') {
    let nx = drag.origX + e.movementX / props.scale
    let ny = drag.origY + e.movementY / props.scale
    if (snapEnabled.value) {
      const res = snap(nx, ny, el)
      nx = res.x
      ny = res.y
      guideX.value = res.guides.x ?? null
      guideY.value = res.guides.y ?? null
    } else {
      guideX.value = null
      guideY.value = null
    }
    updateElement(el.id, { x: round(nx), y: round(ny) })
  } else if (drag.mode === 'scale') {
    const cxS = designToScreenX(drag.cx)
    const cyS = designToScreenY(drag.cy)
    const dist = Math.hypot(e.clientX - cxS, e.clientY - cyS)
    const origDist = drag.startDist || 1
    const ratio = dist / origDist
    const ns = clamp(drag.origScale * ratio, 0.05, 10)
    updateElement(el.id, { scale: round(ns) })
  } else if (drag.mode === 'rotate') {
    const cxS = designToScreenX(drag.cx)
    const cyS = designToScreenY(drag.cy)
    const ang = Math.atan2(e.clientY - cyS, e.clientX - cxS)
    let deg = drag.origRotate + ((ang - drag.startAngle) * 180) / Math.PI
    if (e.shiftKey) deg = Math.round(deg / 15) * 15
    updateElement(el.id, { rotate: round(deg) })
  }
}

function onPointerUp() {
  drag = null
  guideX.value = null
  guideY.value = null
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
}

// 点击空白处取消选中
function onBackgroundPointerDown() {
  clearSelection()
}

function round(n: number): number {
  return Math.round(n * 100) / 100
}
function clamp(n: number, a: number, b: number): number {
  return Math.max(a, Math.min(b, n))
}
</script>

<template>
  <div
    v-if="layer.enabled && visible"
    class="info-layer"
    @pointerdown.self="onBackgroundPointerDown"
  >
    <div
      v-for="el in elements.filter((e) => e.enable)"
      :key="el.id"
      class="info-el"
      :class="[`type-${el.type}`, { selected: selectedIds.has(el.id) }]"
      :style="elStyle(el)"
      @pointerdown="onPointerDownMove($event, el)"
    >
      <!-- 文字 / EXIF -->
      <div
        v-if="el.type === 'text' || el.type === 'exif'"
        class="text-content"
        :style="{
          fontFamily: el.fontFamily,
          fontSize: el.fontSize + 'px',
          fontWeight: el.fontWeight,
          color: el.color,
          textAlign: el.align,
          letterSpacing: el.letterSpacing + 'px',
          lineHeight: el.lineHeight,
          whiteSpace: 'pre',
        }"
      >{{ elemText(el) }}</div>

      <!-- Logo -->
      <img v-else-if="el.type === 'logo' && el.logoId !== 'none'" :src="logoSrc(el)" class="logo-content" :style="{ width: el.baseWidth + 'px' }" draggable="false" />

      <!-- 分割线 -->
      <div
        v-else-if="el.type === 'divider'"
        class="divider-content"
        :style="{ width: el.width + 'px', height: el.thickness + 'px', background: el.color }"
      ></div>

      <!-- 选中包围盒 + 控制点（仅预览交互，导出不渲染） -->
      <template v-if="selectedIds.has(el.id)">
        <div class="bbox"></div>
        <div class="handle tl" @pointerdown.stop="onPointerDownScale($event, el, 'tl')"></div>
        <div class="handle tr" @pointerdown.stop="onPointerDownScale($event, el, 'tr')"></div>
        <div class="handle bl" @pointerdown.stop="onPointerDownScale($event, el, 'bl')"></div>
        <div class="handle br" @pointerdown.stop="onPointerDownScale($event, el, 'br')"></div>
        <div class="handle rotate" @pointerdown.stop="onPointerDownRotate($event, el)"></div>
      </template>
    </div>

    <!-- 吸附参考线（设计坐标） -->
    <div v-if="guideX !== null" class="guide guide-x" :style="{ left: guideX + 'px' }"></div>
    <div v-if="guideY !== null" class="guide guide-y" :style="{ top: guideY + 'px' }"></div>
  </div>
</template>

<style scoped>
.info-layer {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 4;
}
.info-el {
  position: absolute;
  transform-origin: center;
  pointer-events: auto;
  cursor: move;
  user-select: none;
}
.info-el .text-content {
  display: block;
}
.info-el .logo-content {
  display: block;
}
.info-el .divider-content {
  display: block;
}
/* 选中态包围盒 */
.info-el .bbox {
  position: absolute;
  left: -4px;
  top: -4px;
  right: -4px;
  bottom: -4px;
  border: 1px solid #4da3ff;
  pointer-events: none;
}
.handle {
  position: absolute;
  width: 10px;
  height: 10px;
  background: #fff;
  border: 1.5px solid #4da3ff;
  border-radius: 2px;
  pointer-events: auto;
}
.handle.tl { left: -9px; top: -9px; cursor: nwse-resize; }
.handle.tr { right: -9px; top: -9px; cursor: nesw-resize; }
.handle.bl { left: -9px; bottom: -9px; cursor: nesw-resize; }
.handle.br { right: -9px; bottom: -9px; cursor: nwse-resize; }
.handle.rotate {
  left: 50%;
  top: -28px;
  margin-left: -6px;
  border-radius: 50%;
  cursor: grab;
}
.handle.rotate::after {
  content: '';
  position: absolute;
  left: 4px;
  top: 10px;
  width: 1px;
  height: 16px;
  background: #4da3ff;
}
.guide {
  position: absolute;
  background: #ff4d4f;
  pointer-events: none;
}
.guide-x { top: -2000px; width: 1px; height: 4000px; }
.guide-y { left: -2000px; height: 1px; width: 4000px; }
</style>
