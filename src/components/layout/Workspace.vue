<script setup lang="ts">
// 中间主画布工作区：承载预览容器，fit 适配 + 用户缩放 + 拖拽平移。
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { useViewer } from '../../composables/useViewer'
import { useAppState } from '../../composables/useAppState'
import { useLibrary } from '../../composables/useLibrary'
import FrameContainer from '../preview/FrameContainer.vue'
import { DESIGN_CONTAINER } from '../../core/constants'

defineProps<{
  photoSrc: string | null
  bgImage: ImageBitmap | HTMLImageElement | HTMLCanvasElement | null
}>()

// 画布内拖拽控制点已停用（自由拖拽模式已取消，只保留简易参数模式）
const app = useAppState()
const library = useLibrary()

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
  // 锚点缩放：setZoomAt 按「实际生效倍率（受 10%~800% 钳制）」修正平移——
  // 已达上限/下限时倍率不变、平移不动，鼠标下的内容点保持固定，画面不偏移。
  viewer.setZoomAt(viewer.zoom.value * factor, dx, dy)
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

// ===== 拖拽平移（绑定在 stage：画布内图片或画布外空白区域均可拖动）=====
// 任何缩放倍率下均可拖动（未缩放时也能直接移动照片位置；
// Esc / 双击 / 底部工具栏「适应屏幕」均可复位视图）
function onPointerDown(e: PointerEvent) {
  // 审查报告 U9：仅左键开始平移；右键（打开菜单）/中键 / 点击菜单项本身均不抢指针
  //（此前按住右键拖动会平移画布；点菜单项时指针被捕获还可能吞掉 click）
  if (e.button !== 0) return
  if ((e.target as HTMLElement | null)?.closest('.ctx-menu')) return
  // INFO 面板展开时：点击 INFO 元素由 FooterInfo 处理元素拖拽（已 stopPropagation），
  // 点击元素外区域则正常平移画布。
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
  const el = e.currentTarget as HTMLElement
  // 仅在确实持有指针捕获时释放：pointerdown 可能未经过 stage（如 INFO 元素自身的
  // 拖拽拦截了事件），无条件 release 会抛 NotFoundError 触发「组件错误」弹窗
  if (el.hasPointerCapture?.(e.pointerId)) el.releasePointerCapture(e.pointerId)
}

// 总缩放 = fit * 用户 zoom
const totalScale = computed(() => fitScale.value * viewer.zoom.value)

// ===== 右键菜单：快速导出当前照片 =====
// 编辑界面右键弹出快捷菜单（当前仅「导出当前照片」一项），避免误右键直接触发写盘。
const ctxMenu = ref<{ x: number; y: number } | null>(null)
function onStageContextMenu(e: MouseEvent) {
  if (!library.activeId.value) return
  e.preventDefault()
  // 菜单贴边收纳：不超出窗口右缘/下缘
  ctxMenu.value = {
    x: Math.min(e.clientX, window.innerWidth - 186),
    y: Math.min(e.clientY, window.innerHeight - 76),
  }
  // 关闭监听必须延迟到下一个宏任务安装：若在本次事件派发中（watch 微任务）注册，
  // 下一次右键事件冒泡到 window 时会被上一次残留的 once 监听立即关闭，菜单时有时无
  setTimeout(() => {
    if (!ctxMenu.value) return
    installCtxListeners()
  }, 0)
}
// 审查报告 U16：三个 once 监听只有被触发的那一个会自解，其余滞留到下一次全局事件
//（每次开菜单多留 2 个闭包）——改为 AbortController 统一中止，关闭/卸载即清理
let ctxAbort: AbortController | null = null
function installCtxListeners(): void {
  ctxAbort?.abort()
  ctxAbort = new AbortController()
  const opt: AddEventListenerOptions = { once: true, signal: ctxAbort.signal }
  window.addEventListener('click', closeCtxMenu, opt)
  window.addEventListener('contextmenu', onWindowCtxClose, opt)
  window.addEventListener('keydown', onCtxKeydown, opt)
}
// 右键落在菜单触发元素上（handler 已 preventDefault）：由该 handler 重开菜单，不作为关闭信号
function onWindowCtxClose(e: MouseEvent) {
  if (e.defaultPrevented) return
  closeCtxMenu()
}
function closeCtxMenu() {
  ctxMenu.value = null
  ctxAbort?.abort()
  ctxAbort = null
}
function ctxExportCurrent() {
  ctxMenu.value = null
  app.requestSingleExport()
  app.setModule('export')
}
function onCtxKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') closeCtxMenu()
}
onBeforeUnmount(closeCtxMenu)
</script>

<template>
  <section class="workspace">
    <div
      class="stage grab"
      ref="stage"
      @wheel="onWheel"
      @dblclick="onDblClick"
      @pointerdown="onPointerDown"
      @pointermove="onPointerMove"
      @pointerup="onPointerUp"
      @contextmenu="onStageContextMenu"
    >
      <div
        class="fit-wrap"
        ref="fitWrap"
        :style="{
          width: wrapW + 'px',
          height: wrapH + 'px',
          transform: `translate(${viewer.panX.value}px, ${viewer.panY.value}px) scale(${totalScale})`,
          transformOrigin: 'top left',
        }"
      >
        <FrameContainer
          ref="frameRef"
          :photo-src="photoSrc"
          :bg-image="bgImage"
          :interactive="false"
        />
      </div>

      <!-- 缩放比例指示 -->
      <div class="zoom-indicator">{{ Math.round(viewer.zoom.value * 100) }}%</div>

      <!-- 右键快捷菜单：快速导出当前照片 -->
      <div
        v-if="ctxMenu"
        class="ctx-menu"
        :style="{ left: ctxMenu.x + 'px', top: ctxMenu.y + 'px' }"
      >
        <button class="ctx-item" @click="ctxExportCurrent">⬇ 导出当前照片</button>
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
.stage {
  flex: 1;
  overflow: hidden;
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 16px;
  cursor: default;
  /* 预览画布：无照片时中性灰；载入图片时由 frame-container 底色 #000000 显示 */
  background: var(--canvas-empty);
  touch-action: none;
}
.stage.grab {
  cursor: grab;
}
.stage.grab:active {
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
/* 右键快捷菜单：fixed 定位到鼠标处，玻璃拟态与全局一致 */
.ctx-menu {
  position: fixed;
  z-index: 300;
  min-width: 176px;
  padding: 4px;
  background: rgba(20, 28, 48, 0.92);
  -webkit-backdrop-filter: blur(12px);
  backdrop-filter: blur(12px);
  border: 1px solid var(--border);
  box-shadow: 0 16px 40px -18px rgba(0, 0, 0, 0.85);
}
.ctx-item {
  display: block;
  width: 100%;
  padding: 7px 12px;
  background: transparent;
  border: none;
  color: var(--text);
  font-size: 12px;
  font-weight: 400;
  line-height: 18px;
  text-align: left;
  cursor: pointer;
  white-space: nowrap;
}
.ctx-item:hover {
  background: var(--accent);
}
</style>
