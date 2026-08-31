<script setup lang="ts">
// 中间主画布工作区：承载预览容器，fit 适配 + 用户缩放 + 拖拽平移。
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { useViewer } from '../../composables/useViewer'
import { useAppState } from '../../composables/useAppState'
import FrameContainer from '../preview/FrameContainer.vue'
import { DESIGN_CONTAINER } from '../../core/constants'

defineProps<{
  photoSrc: string | null
  bgImage: HTMLImageElement | null
}>()

// 自由拖拽模式启用画布内拖拽交互，简易模式隐藏控制点
const app = useAppState()

const viewer = useViewer()

const stage = ref<HTMLElement | null>(null)
const fitWrap = ref<HTMLElement | null>(null)
const frameRef = ref<InstanceType<typeof FrameContainer> | null>(null)
const fitScale = ref(1)
const dragging = ref(false)
const dragStart = ref({ x: 0, y: 0, px: 0, py: 0 })

// 上次 fit 时的尺寸快照：用于识别「仅外层画布变化（边框宽度 padding / 背景扩展 bgExpand）」——
// 照片元素在设计坐标系中的尺寸不变，只有 border-box 变化。此时不能重算 fitScale（否则画布变大
// 会导致整体缩小，照片在屏幕上跟着缩放/移动），必须保持缩放比不变，让背景/边框向外扩展。
let lastFrameW = 0
let lastFrameH = 0
let lastPhotoW = 0
let lastPhotoH = 0

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
  // 照片设计尺寸（由 FrameContainer 直接暴露，可靠）：作为「照片视觉是否变化」的判定基准。
  // 边框宽度(padding) / 背景扩展(bgExpand)变化时照片尺寸不变，仅画布外层增大/缩小。
  const ps = frameRef.value?.getPhotoSize?.()
  const photoW = ps?.w ?? 0
  const photoH = ps?.h ?? 0
  // 仅外层画布变化：照片尺寸不变、border-box 增大/缩小。
  // 保持 fitScale 不变 → 照片在屏幕上的位置与大小完全不动；
  // 配合 .stage 的 flex 居中（wrap 随画布尺寸变化重新居中），
  // 画布从照片中心向四周等量扩展（超出舞台的部分被裁剪，可滚轮缩小查看）。
  const outerOnly =
    lastFrameW > 0 &&
    photoW === lastPhotoW &&
    photoH === lastPhotoH &&
    (frameW !== lastFrameW || frameH !== lastFrameH)

  if (outerOnly) {
    // 单侧画布增量 Δ（画布宽/高各变化 2Δ）
    const dW = (frameW - lastFrameW) / 2
    const dH = (frameH - lastFrameH) / 2
    // 用户有滚轮缩放（zoom≠1）时，flex 重排会让照片产生 fitScale*(zoom-1)*Δ 的
    // 屏幕漂移，用 pan 反向补偿，保证任何缩放状态下照片都纹丝不动。
    const driftX = fitScale.value * (viewer.zoom.value - 1) * dW
    const driftY = fitScale.value * (viewer.zoom.value - 1) * dH
    if (driftX || driftY) {
      viewer.setPan(viewer.panX.value - driftX, viewer.panY.value - driftY)
    }
  } else {
    fitScale.value = Math.max(0.05, Math.min(availW / frameW, availH / frameH, 1))
  }
  // wrap 尺寸不再手写：由 wrapW/wrapH computed 响应式驱动（与画板 :style 同帧布局）。
  lastFrameW = frameW
  lastFrameH = frameH
  lastPhotoW = photoW
  lastPhotoH = photoH
  measureWrapOrigin()
}

// ===== 滚轮缩放性能 =====
// 1) rAF 合帧：高分辨率滚轮/触控板每秒可触发 60~120 次，合并到每帧一次计算；
// 2) 缓存布局原点：原先每个滚轮事件都 getBoundingClientRect 读取变换后矩形，
//    会强制同步布局（layout thrash）——改为仅在 fit/resize 时测量一次布局原点
//    （transform-origin: top left ⇒ rect.left = 布局left + panX，缩放不移动原点），
//    滚轮时用 panX 实时推算，全程零布局读取。
let wheelRaf = 0
let pendingFactor = 1
let pendingAnchor = { x: 0, y: 0 }
let wrapOrigin = { x: 0, y: 0 }
function measureWrapOrigin() {
  const wrap = fitWrap.value
  if (!wrap) return
  const r = wrap.getBoundingClientRect()
  wrapOrigin = { x: r.left - viewer.panX.value, y: r.top - viewer.panY.value }
}

let frameRO: ResizeObserver | null = null

// ===== wrap 布局尺寸（响应式，与画板 :style 同帧原子生效） =====
// wrap 尺寸 = 画板设计尺寸 × fitScale。原先由 RO→fit() 手写 wrap.style.width/height，
// 落在渲染周期的 RO 阶段（比 Vue flush 晚一个渲染阶段）：拖动边框/背景宽度时存在
// 「画板已变大、wrap 仍是旧尺寸」的中间帧，flex 按旧 wrap 居中 → 照片屏幕位置 ±Δ/2 振荡（抖动）。
// 改为响应式推导后与画板 :style 在同一次布局中更新，中间态被结构性消除。
const exFrameW = computed(() => frameRef.value?.frameW ?? DESIGN_CONTAINER)
const exFrameH = computed(() => frameRef.value?.frameH ?? 800)
const wrapW = computed(() => exFrameW.value * fitScale.value)
const wrapH = computed(() => exFrameH.value * fitScale.value)

// fit：只负责 fitScale 决策（初次适配 / 窗口 resize / 照片或画布内容变化时重算）
// 与 outerOnly 漂移补偿；不再写 wrap 尺寸（已由上方 computed 驱动）。
// RO 回调中同步调用保证 fitScale 变化也在本帧绘制前生效（Vue flush 在微任务中先于绘制）。
onMounted(() => {
  fit()
  window.addEventListener('resize', fit)
  const frame = stage.value?.querySelector('.frame-container') as HTMLElement | null
  if (frame && 'ResizeObserver' in window) {
    frameRO = new ResizeObserver(fit)
    // 必须观察 border-box：frame 是 box-sizing:border-box，padding(边框宽度)变化时
    // 只有 border-box 尺寸变化，content box（内容区恒 1200px）不变，默认 content-box 观察不触发。
    frameRO.observe(frame, { box: 'border-box' })
  }
})
onBeforeUnmount(() => {
  window.removeEventListener('resize', fit)
  frameRO?.disconnect()
  frameRO = null
  cancelAnimationFrame(wheelRaf)
})

// ===== 滚轮缩放（叠加在 fit 之上）：以鼠标所在位置为锚点缩放整体画布 =====
// 无论 INFO 面板是否展开，滚轮缩放始终可用（INFO 元素本身无滚轮交互）。
function onWheel(e: WheelEvent) {
  e.preventDefault()
  const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
  const wrap = fitWrap.value
  if (!wrap) {
    viewer.zoomBy(factor - 1)
    return
  }
  // 同帧多次滚动：倍率复合、锚点取最后一次，统一到 rAF 回调计算
  pendingFactor *= factor
  pendingAnchor = { x: e.clientX, y: e.clientY }
  if (!wheelRaf) wheelRaf = requestAnimationFrame(applyWheelZoom)
}
function applyWheelZoom() {
  wheelRaf = 0
  const factor = pendingFactor
  const anchor = pendingAnchor
  pendingFactor = 1
  // 锚点偏移 = 鼠标 - (布局原点 + 当前平移)：由缓存推算，避免强制布局
  const dx = anchor.x - (wrapOrigin.x + viewer.panX.value)
  const dy = anchor.y - (wrapOrigin.y + viewer.panY.value)
  // 先改倍率（totalScale 随之变化），再据锚点修正平移，使鼠标下的内容点保持不动
  viewer.zoomBy(factor - 1)
  viewer.setPan(
    viewer.panX.value - (factor - 1) * dx,
    viewer.panY.value - (factor - 1) * dy,
  )
}
// ===== 双击快速放大 / 复位（放大预览）=====
// 未放大时：以双击位置为锚点放大 2x（查看细节）；已放大（zoom>1 或有平移）时：复位视图。
function onDblClick(e: MouseEvent) {
  if (viewer.zoom.value > 1.01 || viewer.panX.value !== 0 || viewer.panY.value !== 0) {
    viewer.resetView()
    return
  }
  const factor = 2
  const wrap = fitWrap.value
  if (!wrap) {
    viewer.setZoom(factor)
    return
  }
  // 与滚轮缩放同一套锚点数学：双击点下的内容保持不动
  const dx = e.clientX - (wrapOrigin.x + viewer.panX.value)
  const dy = e.clientY - (wrapOrigin.y + viewer.panY.value)
  viewer.setZoom(factor)
  viewer.setPan(-(factor - 1) * dx, -(factor - 1) * dy)
}

// ===== 拖拽平移 =====
function onPointerDown(e: PointerEvent) {
  // INFO 面板展开时：点击 INFO 元素由 FooterInfo 处理元素拖拽（已 stopPropagation），
  // 点击元素外区域则正常平移画布（移除原先的 infoEditing 整体禁用）。
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
</script>

<template>
  <section class="workspace">
    <div
      class="stage"
      :class="{ grab: dragging }"
      ref="stage"
      @wheel="onWheel"
      @dblclick="onDblClick"
    >
      <div
        class="fit-wrap"
        ref="fitWrap"
        :style="{
          width: wrapW + 'px',
          height: wrapH + 'px',
          transform: `translate(${viewer.panX.value}px, ${viewer.panY.value}px) scale(${totalScale})`,
          transformOrigin: 'top left',
          cursor: dragging ? 'grabbing' : 'default',
        }"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
      >
        <FrameContainer
          ref="frameRef"
          :photo-src="photoSrc"
          :bg-image="bgImage"
          :interactive="app.editMode.value === 'free'"
        />
      </div>

      <!-- 缩放比例指示 -->
      <div class="zoom-indicator">{{ Math.round(viewer.zoom.value * 100) }}%</div>
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
.stage {
  flex: 1;
  overflow: hidden;
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 16px;
  /* 预览画布：无照片时中性灰；载入图片时由 frame-container 底色 #000000 显示 */
  background: var(--canvas-empty);
}
.stage.grab {
  cursor: grabbing;
}
.zoom-indicator {
  position: absolute;
  right: 14px;
  bottom: 14px;
  padding: 4px 10px;
  border-radius: 6px;
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.03em;
  pointer-events: none;
  user-select: none;
}
.fit-wrap {
  position: relative;
  width: 1200px;
  flex: none;
  /* 独立合成层：缩放/平移只改变合成器矩阵，不再触发整个画布子树重绘 */
  will-change: transform;
}
</style>
