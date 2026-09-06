<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import { useFrameConfig } from '../../composables/useFrameConfig'
import { editingPhoto, photoImage } from '../../composables/useUi'
import { rotatedSize, clampCrop, drawRotatedCropped, FULL_CROP, type PhotoCrop } from '../../core/photoEdit'
import RangeSlider from './RangeSlider.vue'

const { state, patch } = useFrameConfig()
const emit = defineEmits<{ (e: 'close'): void }>()

// 角度归一化到 (-180, 180]
function normAngle(a: number): number {
  const n = ((a % 360) + 540) % 360 - 180
  return n === -180 ? 180 : n
}

// 本地编辑副本：旋转（任意角度）+ 裁剪（确认时写回 config）
const rotation = ref<number>(normAngle(state.photoRotation))
const crop = ref<PhotoCrop>({ ...state.photoCrop })

const stage = ref<HTMLElement | null>(null)

// 源图尺寸
const natural = ref<{ w: number; h: number }>({ w: 1, h: 1 })
const imgEl = new Image()
imgEl.crossOrigin = 'anonymous'

imgEl.onload = () => {
  natural.value = { w: imgEl.naturalWidth, h: imgEl.naturalHeight }
}

// 旋转后外接尺寸（stage 即按此比例铺满；与预览/导出的 drawRotatedCropped 同一套几何）
const rotated = computed(() => rotatedSize(natural.value.w, natural.value.h, rotation.value))
const stageAspect = computed(() => (rotated.value.h > 0 ? rotated.value.w / rotated.value.h : 1))

// ===== 背景渲染：直接用 drawRotatedCropped 画到 canvas（与预览/导出完全同源）=====
// 此前用 CSS rotate + object-fit:cover：90° 时 stage 比例与图源比例不匹配导致先裁剪
// 再旋转，照片比例明显失真。canvas 方案对任意角度都正确。
const bgCanvas = ref<HTMLCanvasElement | null>(null)
function renderBg() {
  const c = bgCanvas.value
  if (!c || !natural.value.w || !imgEl.naturalWidth) return
  const rect = c.getBoundingClientRect()
  if (!rect.width || !rect.height) return
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  const w = Math.max(1, Math.round(rect.width * dpr))
  const h = Math.max(1, Math.round(rect.height * dpr))
  if (c.width !== w) c.width = w
  if (c.height !== h) c.height = h
  const ctx = c.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, w, h)
  drawRotatedCropped(ctx, imgEl, natural.value.w, natural.value.h, rotation.value, FULL_CROP, w, h)
}
watch([rotation, natural], () => nextTick(renderBg))
function onStageResize() {
  renderBg()
}

// ===== 裁剪框交互（归一化坐标，相对 rotated 照片） =====
const dragging = ref<null | { mode: string; sx: number; sy: number; start: PhotoCrop }>(null)

function stageRect() {
  return stage.value?.getBoundingClientRect() ?? { left: 0, top: 0, width: 1, height: 1 }
}

function onPointerDown(mode: string, e: PointerEvent) {
  e.stopPropagation()
  const el = e.currentTarget as HTMLElement
  try {
    el.setPointerCapture(e.pointerId)
  } catch {}
  dragging.value = { mode, sx: e.clientX, sy: e.clientY, start: { ...crop.value } }
}
function onPointerMove(e: PointerEvent) {
  if (!dragging.value) return
  const r = stageRect()
  const dx = (e.clientX - dragging.value.sx) / r.width
  const dy = (e.clientY - dragging.value.sy) / r.height
  const s = dragging.value.start
  const m = dragging.value.mode
  let next: PhotoCrop = { ...s }
  const MIN = 0.08
  if (m === 'move') {
    next.x = s.x + dx
    next.y = s.y + dy
  } else {
    // 边/角缩放
    let x0 = s.x
    let y0 = s.y
    let x1 = s.x + s.w
    let y1 = s.y + s.h
    if (m.includes('w')) x0 = s.x + dx
    if (m.includes('e')) x1 = s.x + s.w + dx
    if (m.includes('n')) y0 = s.y + dy
    if (m.includes('s')) y1 = s.y + s.h + dy
    next = { x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) }
  }
  crop.value = clampCrop(next, MIN)
}
function onPointerUp(e: PointerEvent) {
  if (dragging.value) {
    try {
      ;(e.target as HTMLElement).releasePointerCapture?.(e.pointerId)
    } catch {}
    dragging.value = null
  }
}

// 自由旋转滑杆（-180..180，任意角度微调；与旋转按钮共用同一状态）
const freeAngle = computed({
  get: () => rotation.value,
  set: (v: number) => {
    rotation.value = v
  },
})

// 旋转按钮：顺时针/逆时针 90°，并重置裁剪为满框（便于重新选择）
function rotate(dir: 1 | -1) {
  rotation.value = normAngle(rotation.value + dir * 90)
  crop.value = { x: 0, y: 0, w: 1, h: 1 }
}

// 比例预设：在 rotated 空间内居中对齐固定比例
const presets: { label: string; ratio: number | null }[] = [
  { label: '自由', ratio: null },
  { label: '1:1', ratio: 1 },
  { label: '4:3', ratio: 4 / 3 },
  { label: '3:4', ratio: 3 / 4 },
  { label: '16:9', ratio: 16 / 9 },
]
function applyPreset(ratio: number | null) {
  if (ratio == null) {
    crop.value = { x: 0, y: 0, w: 1, h: 1 }
    return
  }
  // 在 rotated 照片内取最大居中矩形
  const W = rotated.value.w
  const H = rotated.value.h
  let w = W
  let h = W / ratio
  if (h > H) {
    h = H
    w = H * ratio
  }
  crop.value = clampCrop({ x: (W - w) / 2 / W, y: (H - h) / 2 / H, w: w / W, h: h / H })
}

// 裁剪框像素样式
const cropStyle = computed(() => ({
  position: 'absolute' as const,
  left: crop.value.x * 100 + '%',
  top: crop.value.y * 100 + '%',
  width: crop.value.w * 100 + '%',
  height: crop.value.h * 100 + '%',
}))

// 重置
function reset() {
  rotation.value = 0
  crop.value = { x: 0, y: 0, w: 1, h: 1 }
}

function confirm() {
  patch({ photoRotation: rotation.value, photoCrop: { ...crop.value } })
  editingPhoto.value = false
  emit('close')
}

// 监听 photoImage 变化以刷新源尺寸
watch(
  () => photoImage.value,
  (im) => {
    if (im && im.src) imgEl.src = im.src
  },
  { immediate: true },
)

let stageRo: ResizeObserver | null = null
onMounted(() => {
  const im = photoImage.value
  if (im && im.src) imgEl.src = im.src
  window.addEventListener('resize', onStageResize)
  if (stage.value && 'ResizeObserver' in window) {
    stageRo = new ResizeObserver(onStageResize)
    stageRo.observe(stage.value)
  }
  nextTick(renderBg)
})
onBeforeUnmount(() => {
  imgEl.onload = null
  window.removeEventListener('resize', onStageResize)
  stageRo?.disconnect()
  stageRo = null
})
</script>

<template>
  <div class="editor-mask" @pointerdown.self="confirm">
    <div class="editor">
      <div class="editor-head">
        <span class="title">编辑照片</span>
        <button class="x" @click="confirm">完成</button>
      </div>

      <div class="canvas-area">
        <div class="stage" ref="stage" :style="{ aspectRatio: stageAspect }">
          <canvas ref="bgCanvas" class="bg-canvas" aria-hidden="true"></canvas>
          <!-- 裁剪框 -->
          <div class="crop" :style="cropStyle" @pointerdown="onPointerDown('move', $event)" @pointermove="onPointerMove" @pointerup="onPointerUp">
            <div class="grid"></div>
            <span class="handle n" @pointerdown.stop="onPointerDown('n', $event)" @pointermove="onPointerMove" @pointerup="onPointerUp"></span>
            <span class="handle s" @pointerdown.stop="onPointerDown('s', $event)" @pointermove="onPointerMove" @pointerup="onPointerUp"></span>
            <span class="handle w" @pointerdown.stop="onPointerDown('w', $event)" @pointermove="onPointerMove" @pointerup="onPointerUp"></span>
            <span class="handle e" @pointerdown.stop="onPointerDown('e', $event)" @pointermove="onPointerMove" @pointerup="onPointerUp"></span>
            <span class="handle nw" @pointerdown.stop="onPointerDown('nw', $event)" @pointermove="onPointerMove" @pointerup="onPointerUp"></span>
            <span class="handle ne" @pointerdown.stop="onPointerDown('ne', $event)" @pointermove="onPointerMove" @pointerup="onPointerUp"></span>
            <span class="handle sw" @pointerdown.stop="onPointerDown('sw', $event)" @pointermove="onPointerMove" @pointerup="onPointerUp"></span>
            <span class="handle se" @pointerdown.stop="onPointerDown('se', $event)" @pointermove="onPointerMove" @pointerup="onPointerUp"></span>
          </div>
        </div>
      </div>

      <div class="toolbar">
        <button class="tool" @click="rotate(-1)">↺ 左转</button>
        <button class="tool" @click="rotate(1)">右转 ↻</button>
        <button class="tool" @click="reset">重置</button>
      </div>
      <!-- 自由旋转：任意角度（含 0.5° 细步），拉直地平线 / 倾斜构图 -->
      <RangeSlider
        v-model="freeAngle"
        :min="-180"
        :max="180"
        :step="0.5"
        label="自由旋转（度）"
      />
      <div class="presets">
        <button
          v-for="p in presets"
          :key="p.label"
          class="preset"
          @click="applyPreset(p.ratio)"
        >
          {{ p.label }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.editor-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.82);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.editor {
  width: min(92vw, 520px);
  background: var(--panel);
  border-radius: 0;
  padding: 12px 14px;
  color: var(--text);
  display: flex;
  flex-direction: column;
  gap: 10px;
  border: 1px solid var(--border);
}
.editor-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.title {
  font-weight: 400;
  font-size: 13px;
  line-height: 18px;
  color: var(--text);
}
.x {
  background: var(--btn-bg);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 0;
  padding: 0 14px;
  height: 22px;
  font-size: 12px;
  line-height: 16px;
  cursor: pointer;
}
.x:hover { background: var(--hover); color: var(--text-normal); }
.x:active { background: var(--pressed); }
.canvas-area {
  display: flex;
  justify-content: center;
}
.stage {
  position: relative;
  width: 100%;
  max-height: 60vh;
  background: var(--canvas-loaded);
  overflow: hidden;
  touch-action: none;
}
.crop {
  position: absolute;
  box-sizing: border-box;
  border: 1px solid var(--text);
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.5);
  cursor: move;
  touch-action: none;
}
.bg-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  display: block;
  pointer-events: none;
}
.grid {
  position: absolute;
  inset: 0;
  background-image: linear-gradient(rgba(255, 255, 255, 0.35) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255, 255, 255, 0.35) 1px, transparent 1px);
  background-size: 33.33% 33.33%;
  pointer-events: none;
}
.handle {
  position: absolute;
  width: 18px;
  height: 18px;
  background: #fff;
  border: 1px solid #aaaaaa;
  border-radius: 3px;
}
.handle.n { top: -9px; left: 50%; transform: translateX(-50%); cursor: ns-resize; }
.handle.s { bottom: -9px; left: 50%; transform: translateX(-50%); cursor: ns-resize; }
.handle.w { left: -9px; top: 50%; transform: translateY(-50%); cursor: ew-resize; }
.handle.e { right: -9px; top: 50%; transform: translateY(-50%); cursor: ew-resize; }
.handle.nw { top: -9px; left: -9px; cursor: nwse-resize; }
.handle.ne { top: -9px; right: -9px; cursor: nesw-resize; }
.handle.sw { bottom: -9px; left: -9px; cursor: nesw-resize; }
.handle.se { bottom: -9px; right: -9px; cursor: nwse-resize; }
.toolbar {
  display: flex;
  gap: 4px;
  justify-content: center;
}
.tool {
  flex: 1;
  height: 26px;
  background: var(--btn-bg);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 0;
  font-size: 12px;
  font-weight: 400;
  line-height: 16px;
  cursor: pointer;
}
.tool:hover { background: var(--hover); color: var(--text-normal); }
.tool:active { background: var(--pressed); }
.presets {
  display: flex;
  gap: 4px;
  justify-content: center;
  flex-wrap: wrap;
}
.preset {
  background: var(--panel-2);
  color: var(--text-dim);
  border: 1px solid var(--border);
  border-radius: 0;
  padding: 0 10px;
  height: 22px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 400;
  line-height: 16px;
}
.preset:hover { background: var(--hover); color: var(--text); }
.preset:active { background: var(--pressed); }
</style>
