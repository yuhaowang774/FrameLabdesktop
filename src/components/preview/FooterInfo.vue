<script setup lang="ts">
// 底部信息预览：品牌 Logo / 相机型号 / EXIF 三个独立模块，各自可在画布上鼠标拖动
import { computed, ref, onMounted, onBeforeUnmount } from 'vue'
import { useFrameConfig } from '../../composables/useFrameConfig'
import { useAppState } from '../../composables/useAppState'
import { useViewer } from '../../composables/useViewer'
import { resolveLogoDataURL, resolveLogo } from '../../composables/useLogoStore'
import { DESIGN_CONTAINER, phoneBrandOf } from '../../core/constants'
import {
  computeFooterLayout,
  computeClassicLayout,
  computeCardLayout,
  cardThemeColors,
  cardBadgeColors,
  CARD_RADIUS,
  LENS_LINE_GAP,
  type FooterLayout,
  type CardRect,
} from '../../core/infoLayout'
import { logoAutoColor } from '../../core/colorUtils'
import { modelAlias } from '../../core/modelAlias'

type ItemKey = 'logo' | 'model' | 'exif' | 'date' | 'lens'

const { state, patch } = useFrameConfig()
const viewer = useViewer()

// Logo 着色：'auto' 时随背景明暗取黑/白（与导出端同一函数），浅色相框下 Logo 保持可辨
const logoColor = computed(() => logoAutoColor(state.logoColor, state.bgMode, state.bgColor))

// INFO 编辑态：仅「INFO信息设置」面板展开时三元素可拖拽；
// 收起后元素固定显示（相当于已打印在照片上），鼠标完全穿透不影响画布操作。
const infoEditing = computed(() => useAppState().state.rightPanels.info)

const brandName = computed(() => state.brand)

// 画板显示的相机型号：存储值可能是旧版本写入的机身代号（ILCE-6000 / FC3682），
// 这里统一翻译成营销名（α6000 / DJI Mini 3）。映射幂等，已是营销名的值不会被二次改写。
const modelText = computed(() => modelAlias(state.cameraModel))

// 型号偏移：仅 classic 布局叠加 -50% 实现水平居中（x 是内容区中点）；
// duo/inline 的 x 已由共享布局按左缘/行内位置精确计算，再叠 -50% 会把型号推出画板左缘。
const modelTransform = computed(() =>
  state.infoLayout === 'classic'
    ? 'translate(calc(-50% + var(--camera-model-offset-x)), var(--camera-model-offset-y))'
    : 'translate(var(--camera-model-offset-x), var(--camera-model-offset-y))',
)

// Logo 由 useLogoStore 渲染内置品牌官方 SVG / 自定义 Logo
const logoSrc = computed(() =>
  state.showLogo ? resolveLogoDataURL(state.brand, logoColor.value) : '',
)

// Logo 宽高比（duo/inline 默认排版需要；读取 logoSrc 建立异步加载后的响应式依赖）
const logoRatio = computed(() => {
  void (state.showLogo ? resolveLogoDataURL(state.brand, logoColor.value) : '')
  const c = resolveLogo(state.brand, logoColor.value)
  return c.height > 0 ? c.width / c.height : 2.6
})

// 通用拖拽逻辑（每项独立）
const dragging = ref<ItemKey | null>(null)
const origin = ref({ x: 0, y: 0 })
const start = ref({ x: 0, y: 0 })
const dragEl = ref<HTMLElement | null>(null)
const dragPointerId = ref(-1)
const footerLayer = ref<HTMLElement | null>(null)

// ===== 边缘自动平移（auto-pan）=====
// 画布缩放后画板可能溢出舞台（stage），元素拖到画板顶/底/左/右时鼠标会先碰到窗口边缘，
// 无法继续拖到画板边界。故在拖拽期间若鼠标接近 stage 边缘，自动向该方向平移画板（pan），
// 让画板边界持续进入可视区，元素即可拖到画板任意位置。
const stageEl = ref<HTMLElement | null>(null)
const lastMouse = ref({ x: 0, y: 0 })
const panStart = ref({ x: 0, y: 0 })
let autoPanRaf = 0
// 热区宽度（px）：鼠标距 stage 边缘小于该值时触发自动平移
const AUTO_PAN_EDGE = 60
// 每帧基础平移速度（px）：缺口小时平滑缓滚
const AUTO_PAN_SPEED = 16
// 每帧平移上限（px）：缺口大时快速补齐，避免 Logo 长时间到不了画板边界
const AUTO_PAN_MAX = 140

function getStage(): HTMLElement | null {
  if (!stageEl.value) {
    stageEl.value = (footerLayer.value?.closest('.stage') as HTMLElement | null) ?? null
  }
  return stageEl.value
}

// footer-layer 覆盖整个画板（含边框留白背景区），元素可在「背景区域（画板 content box）」内自由拖动。
// 元素坐标仍存「内容区坐标」（x/y 相对内容区左上角），内容区在背景区域中居中（偏移 = bgExpand），
// 允许负值 / 超出内容区，从而覆盖到边框留白背景区；导出侧需同步该偏移。
const pad = computed(() => state.padding)
// 背景区域扩展量（px，>0 时背景/边框/画布同步扩大）
const bgExpand = computed(() => state.bgExpand)
// 画板（整个 frame-container）设计宽 = 背景区域 + 左右边框留白
const canvasW = computed(() => DESIGN_CONTAINER + 2 * bgExpand.value + pad.value * 2)

function containerRect(): DOMRect | null {
  return footerLayer.value?.getBoundingClientRect() ?? null
}

function onPointerDown(e: PointerEvent, key: ItemKey) {
  if (!infoEditing.value) return
  // 阻止冒泡到画布 fit-wrap：避免点击元素时同时触发画布平移（元素外区域才会平移画布）
  e.stopPropagation()
  const target = e.currentTarget as HTMLElement
  dragEl.value = target
  // 直接取状态坐标作为拖拽起点，而非 getBoundingClientRect。
  // getBoundingClientRect 受 filter:drop-shadow（Logo）或 transform:translate（相机型号）
  // 影响会返回偏移后的视觉矩形，导致每次拖拽起点漂移、范围逐渐偏移。
  let x = state[(key + 'X') as 'logoX']
  let y = state[(key + 'Y') as 'logoY']
  // 首次拖拽（坐标尚未写入，仍为 null，默认位置由 defaultPos 兜底渲染）时，
  // 用与渲染一致的默认位置作为起点，而非直接返回——否则永远无法开始拖拽。
  if (x == null || y == null) {
    const d = defaultPos(key)
    x = d.x
    y = d.y
  }
  origin.value = { x, y }
  start.value = { x: e.clientX, y: e.clientY }
  lastMouse.value = { x: e.clientX, y: e.clientY }
  panStart.value = { x: viewer.panX.value, y: viewer.panY.value }
  dragging.value = key
  // 捕获指针：画布缩放后画板可能溢出舞台，logo 拖到画板顶/底需要鼠标移出窗口；
  // 不捕获会导致 pointermove 在窗口边缘中断，logo 拖不到画板边界。
  dragPointerId.value = e.pointerId
  try {
    target.setPointerCapture(e.pointerId)
  } catch {
    /* 某些环境（如 pointerId 无效）下忽略 */
  }
  guideVisible.value = true
  guideV.value = false
  guideH.value = false
  guideBand.value = false
  window.addEventListener('pointermove', onPointerMove)
  window.addEventListener('pointerup', onPointerUp)
  cancelAnimationFrame(autoPanRaf)
  autoPanRaf = requestAnimationFrame(autoPanLoop)
  e.preventDefault()
}

function autoPanLoop() {
  if (!dragging.value) return
  const stage = getStage()
  const frame = (footerLayer.value?.closest('.frame-container') as HTMLElement | null) ?? null
  if (stage && frame) {
    const sr = stage.getBoundingClientRect()
    const fr = frame.getBoundingClientRect()
    // 鼠标相对 stage 四边的距离（进入热区时触发平移）
    const distLeft = lastMouse.value.x - sr.left
    const distRight = sr.right - lastMouse.value.x
    const distTop = lastMouse.value.y - sr.top
    const distBottom = sr.bottom - lastMouse.value.y
    // 每帧推进量 = 热区系数 × min(缺口, max(基础速度, 缺口×0.4))。
    // 缺口 = 画板在该方向超出 stage 的量：缺口越大滚动越快（画板被缩放/平移出可视区
    // 数百 px 时几帧内补完），Logo 迅速贴到画板边界；缺口小则保持平滑缓滚。
    const heat = (d: number) => Math.max(0, (AUTO_PAN_EDGE - d) / AUTO_PAN_EDGE)
    const step = (d: number, gap: number) =>
      heat(d) * Math.min(AUTO_PAN_MAX, Math.max(AUTO_PAN_SPEED, gap * 0.4))
    let px = 0
    let py = 0
    // 仅当画板在该方向仍有溢出时继续滚（防止把画板滚出舞台）。
    // 露出画板右部 = 画板左移(panX 减)；左部 = 画板右移(panX 增)；下部 = 画板上移(panY 减)；上部 = 画板下移(panY 增)。
    if (distRight < AUTO_PAN_EDGE && fr.right > sr.right + 1) px = -step(distRight, fr.right - sr.right)
    else if (distLeft < AUTO_PAN_EDGE && fr.left < sr.left - 1) px = step(distLeft, sr.left - fr.left)
    if (distBottom < AUTO_PAN_EDGE && fr.bottom > sr.bottom + 1) py = -step(distBottom, fr.bottom - sr.bottom)
    else if (distTop < AUTO_PAN_EDGE && fr.top < sr.top - 1) py = step(distTop, sr.top - fr.top)
    if (px !== 0 || py !== 0) {
      viewer.setPan(viewer.panX.value + px, viewer.panY.value + py)
      // pan 变化后必须立即重算元素位置（鼠标此刻可能已停在边缘不再触发 pointermove），
      // 否则元素内容区坐标停留在旧值、未随画板滚动同步，导致元素漂移/拖不到边界。
      updatePosition(lastMouse.value.x, lastMouse.value.y)
    }
  }
  autoPanRaf = requestAnimationFrame(autoPanLoop)
}

// 依据鼠标屏幕坐标 + 拖拽起点的 pan 偏移，计算并写入元素内容区坐标（含画板范围钳制）。
function updatePosition(mx: number, my: number) {
  if (!dragging.value || !dragEl.value) return
  const rect = containerRect()
  if (!rect) return
  const scale = rect.width / canvasW.value
  const canvasH = rect.height / scale // 画板设计高（含上下边框留白）
  // 元素设计尺寸：offsetWidth/offsetHeight 不受祖先 transform 影响，即设计坐标尺寸。
  const elemW = dragEl.value.offsetWidth
  const elemH = dragEl.value.offsetHeight
  // auto-pan 会平移画板（pan 变化），需从"有效起点"中扣除 pan 偏移，
  // 否则 pan 带来的屏幕位移会被误算成元素拖拽，导致元素随画板一起漂移。
  const panDx = viewer.panX.value - panStart.value.x
  const panDy = viewer.panY.value - panStart.value.y
  let nx = origin.value.x + (mx - start.value.x - panDx) / scale
  let ny = origin.value.y + (my - start.value.y - panDy) / scale
  // 钳制元素「本体」在画板范围内（x/y 对称）：内容区坐标下界 = -(pad + bgExpand)（元素左/上缘最多到画板边缘）。
  // 上界 = 画板尺寸 - pad - bgExpand - 元素尺寸，使元素四边最多到画板四边：
  // x 右缘最多到画板右缘；y 底部最多到画板底缘（可覆盖背景区域下边扩展 bgBottomExpand 与下边框 padBottom）。
  // 渲染时 absStyle 再加 pad + bgExpand 得画板坐标。
  nx = Math.max(-(pad.value + bgExpand.value), Math.min(DESIGN_CONTAINER + pad.value + bgExpand.value - elemW, nx))
  ny = Math.max(-(pad.value + bgExpand.value), Math.min(canvasH - pad.value - bgExpand.value - elemH, ny))
  // ===== 居中辅助线：元素中心接近画板中心时吸附并高亮 =====
  const snapped = applyCenterSnap(nx, ny)
  const k = dragging.value
  patch({
    [k + 'X']: snapped.x,
    [k + 'Y']: snapped.y,
  } as Record<string, number>)
}

// 辅助线状态（拖拽时显示，接近中心时高亮）
const guideVisible = ref(false)
const guideV = ref(false) // 水平居中（垂直中线）
const guideH = ref(false) // 垂直居中（水平中线）
const guideBand = ref(false) // 下边白框带中线（下边宽度 > 0 时出现）

/** 下边白框带（画板最底部的边框留白 = padding + borderRatio 加宽）中心在内容区坐标系中的 y。
 *  仅在下边宽度 borderRatio > 0（存在加宽白框）时提供；否则返回 null（不显示、不吸附）。
 *  画板垂直结构（自顶向下）：pad → bgExpand → 内容区 → (bgExpand + bgBottomRatio 背景下扩展) → (pad + borderRatio 白框)。
 *  白框带贴画板最底部（背景扩展在其上方内侧），中心 = 画板底缘 − 带高/2，再转内容区坐标（减 pad + bgExpand）。 */
const bottomBandCenter = computed<number | null>(() => {
  if (state.borderRatio <= 0) return null
  const containerH = frameContainerH.value > 0
    ? frameContainerH.value
    : contentH.value + state.padding * 2 + state.borderRatio + bgExpand.value * 2 + state.bgBottomRatio
  return containerH - (pad.value + state.borderRatio) / 2 - pad.value - bgExpand.value
})

/** 下边白框带中线在画板中的位置样式（内容区坐标 → 画板坐标） */
const bottomBandStyle = computed(() => {
  const cy = bottomBandCenter.value
  if (cy == null) return null
  return { top: pad.value + bgExpand.value + cy + 'px' }
})

/** 画板中心在「内容区坐标系」中的位置（footer-layer 覆盖整个画板） */
function canvasCenterInContent(): { x: number; y: number } {
  const cH = contentH.value
  // canvasH = cH + bgExpand + bgBottomExpand + pad + padBottom
  const cy =
    (cH + bgExpand.value + state.bgExpand + state.bgBottomRatio + pad.value + pad.value + state.borderRatio) / 2 -
    pad.value -
    bgExpand.value
  return { x: DESIGN_CONTAINER / 2, y: cy }
}

/** 元素中心接近画板中心 / 下边白框带中线时吸附并返回吸附后的坐标 */
function applyCenterSnap(x: number, y: number): { x: number; y: number } {
  if (!dragEl.value) return { x, y }
  const cx = canvasCenterInContent()
  const elemW = dragEl.value.offsetWidth
  const elemH = dragEl.value.offsetHeight
  const T = 10 // 吸附阈值（设计 px）
  const dx = Math.abs(x + elemW / 2 - cx.x)
  guideV.value = dx < T
  // y 向双候选：画板水平中线 / 下边白框带中线（存在时），谁更近吸谁
  const band = bottomBandCenter.value
  const dCenter = Math.abs(y + elemH / 2 - cx.y)
  const dBand = band == null ? Infinity : Math.abs(y + elemH / 2 - band)
  guideH.value = dCenter < T && dCenter <= dBand
  guideBand.value = band != null && dBand < T && dBand < dCenter
  return {
    x: guideV.value ? cx.x - elemW / 2 : x,
    y: guideH.value
      ? cx.y - elemH / 2
      : guideBand.value
        ? (band as number) - elemH / 2
        : y,
  }
}

function onPointerMove(e: PointerEvent) {
  if (!dragging.value || !dragEl.value) return
  lastMouse.value = { x: e.clientX, y: e.clientY }
  updatePosition(e.clientX, e.clientY)
}

function onPointerUp() {
  dragging.value = null
  cancelAnimationFrame(autoPanRaf)
  if (dragEl.value && dragPointerId.value >= 0) {
    try {
      dragEl.value.releasePointerCapture(dragPointerId.value)
    } catch {
      /* 指针捕获可能已自动释放 */
    }
  }
  dragPointerId.value = -1
  guideVisible.value = false
  guideV.value = false
  guideH.value = false
  guideBand.value = false
  window.removeEventListener('pointermove', onPointerMove)
  window.removeEventListener('pointerup', onPointerUp)
}

// 内容区设计高度（用于默认底部定位）
const contentH = computed(() => state.canvasH
  ? state.canvasH - state.padding - (state.padding + state.borderRatio)
  : (frameContainerH.value > 0
    ? frameContainerH.value - state.padding - (state.padding + state.borderRatio)
    : state.canvasH - state.padding - (state.padding + state.borderRatio)),
)
const frameContainerH = ref(0)
// 通过 ResizeObserver 同步画板设计高
const frameEl = computed<HTMLElement | null>(() => document.querySelector('.frame-container'))
let _ro: ResizeObserver | null = null
onMounted(() => {
  const el = frameEl.value
  if (!el || typeof ResizeObserver === 'undefined') return
  _ro = new ResizeObserver(() => {
    frameContainerH.value = el.offsetHeight
  })
  _ro.observe(el)
  frameContainerH.value = el.offsetHeight
})
onBeforeUnmount(() => { _ro?.disconnect(); _ro = null })

// 每项默认位置：全部由共享布局模块计算（与 exporter.ts 同源）。
// 行高与文本宽度均取各组「生效样式」（独立 ?? 整体），单独修改某组字体/字号后排版自动跟随，
// 不会出现行重叠或右缘对齐失效。
function defaultPos(key: ItemKey): { x: number; y: number } {
  // 底部锚点 = 画布底缘（实测画板高 − padding − bgExpand，内容坐标系），INFO 落在底部留白条内
  // 而非压在照片下缘；最底行文本 top 再上移 overlayBottom 边距。
  // 注意：不能用 contentH（= canvasH − 2pad − borderRatio，含对称 bgExpand 与下边加宽），会双重计算溢出。
  const canvasBottom = frameContainerH.value > 0
    ? frameContainerH.value - pad.value - bgExpand.value
    : contentH.value
  // classic = 经典纵向堆叠；duo = 杂志双栏；inline = 悬浮双行
  const L: FooterLayout =
    state.infoLayout === 'duo' || state.infoLayout === 'inline'
      ? computeFooterLayout(state, canvasBottom, logoRatio.value)
      : computeClassicLayout(state, canvasBottom)
  return L[key]
}

// card 白底水印卡：与 exporter drawCardFooter 同源布局（computeCardLayout），不支持拖拽
const cardLayout = computed(() => {
  if (state.infoLayout !== 'card') return null
  const canvasBottom = frameContainerH.value > 0
    ? frameContainerH.value - pad.value - bgExpand.value
    : contentH.value
  return computeCardLayout(state, canvasBottom)
})
const cardTheme = computed(() => cardThemeColors(state.infoCardTheme))
const cardBadge = computed(() => {
  const phone = phoneBrandOf(state.brand)
  if (!phone?.badge.text) return null
  const c = cardBadgeColors(state.cardBadgeBg, state.cardBadgeFg, state.brand)
  return { text: phone.badge.text, bg: c.bg, fg: c.fg }
})
/** 卡内子项定位：内容区坐标 + padding + bgExpand → 画板坐标 */
function cardPos(r: CardRect) {
  return {
    left: pad.value + bgExpand.value + r.x + 'px',
    top: pad.value + bgExpand.value + r.y + 'px',
    width: r.w + 'px',
    height: r.h + 'px',
  }
}

// duo 双栏分隔竖线：右栏文字左侧浅灰线（与 exporter 一致，几何来自共享布局计算）；
// x 支持水平拖动（infoDividerX），上/下端手柄调高度（infoDividerTop/Bottom），
// null = 跟随默认布局（默认高度自动等于下边白框带全高）
const MIN_DIVIDER_H = 20 // 竖线最小高度（设计 px）

/** 竖线当前几何（内容区坐标）：手动值优先，null 回退默认布局 */
function dividerGeom(): { x: number; top: number; bottom: number } | null {
  if (state.infoLayout !== 'duo') return null
  if (!(state.showExif && state.exifText) && !(state.showDate && state.dateText)) return null
  const canvasBottom = frameContainerH.value > 0
    ? frameContainerH.value - pad.value - bgExpand.value
    : contentH.value
  const L = computeFooterLayout(state, canvasBottom, logoRatio.value)
  if (!L.divider) return null
  return {
    x: state.infoDividerX ?? L.divider.x,
    top: state.infoDividerTop ?? L.divider.y,
    bottom: state.infoDividerBottom ?? L.divider.y + L.divider.h,
  }
}

const duoDividerStyle = computed(() => {
  const g = dividerGeom()
  if (!g) return null
  return {
    // left 恒 0、以 transform 定位：拖动只触发合成不重排（消除拖影的关键）
    transform: `translateX(${pad.value + bgExpand.value + g.x}px)`,
    top: pad.value + bgExpand.value + g.top + 'px',
    height: Math.max(MIN_DIVIDER_H, g.bottom - g.top) + 'px',
  }
})

// ===== duo 分隔竖线拖拽：线体 = 水平移动；上/下手柄 = 调节对应端（高度） =====
type DividerEdge = 'x' | 'top' | 'bottom'
const dividerDragging = ref(false)
const dividerEdge = ref<DividerEdge>('x')
let divStart = { x: 0, top: 0, bottom: 0 }
let divStartClient = { x: 0, y: 0 }

function startDividerDrag(e: PointerEvent, edge: DividerEdge) {
  if (!infoEditing.value) return
  e.stopPropagation()
  const g = dividerGeom()
  if (!g) return
  divStart = { x: g.x, top: g.top, bottom: g.bottom }
  divStartClient = { x: e.clientX, y: e.clientY }
  dividerEdge.value = edge
  dividerDragging.value = true
  try {
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  } catch {
    /* 某些环境（如 pointerId 无效）下忽略 */
  }
  window.addEventListener('pointermove', onDividerMove)
  window.addEventListener('pointerup', onDividerUp)
  e.preventDefault()
}

function onDividerMove(e: PointerEvent) {
  if (!dividerDragging.value) return
  const rect = containerRect()
  if (!rect) return
  const scale = rect.width / canvasW.value
  const dx = (e.clientX - divStartClient.x) / scale
  const dy = (e.clientY - divStartClient.y) / scale
  const boardLo = -(pad.value + bgExpand.value) // 画板顶/左缘（内容区坐标）
  if (dividerEdge.value === 'x') {
    const hi = DESIGN_CONTAINER + pad.value + bgExpand.value // 画板右缘
    patch({ infoDividerX: Math.max(boardLo, Math.min(hi, divStart.x + dx)) })
  } else if (dividerEdge.value === 'top') {
    // 顶端跟随鼠标，但不越过底端（保底最小高度）
    const nt = Math.min(divStart.top + dy, divStart.bottom - MIN_DIVIDER_H)
    patch({ infoDividerTop: Math.max(boardLo, nt) })
  } else {
    // 底端跟随鼠标，但不越过顶端，且不超过画板底缘
    const canvasBottom = frameContainerH.value > 0
      ? frameContainerH.value - pad.value - bgExpand.value
      : contentH.value
    const nb = Math.max(divStart.bottom + dy, divStart.top + MIN_DIVIDER_H)
    patch({ infoDividerBottom: Math.min(canvasBottom, nb) })
  }
}

function onDividerUp() {
  dividerDragging.value = false
  window.removeEventListener('pointermove', onDividerMove)
  window.removeEventListener('pointerup', onDividerUp)
}

// duo 布局下日期默认沿用机型样式组（灰细小字，与样例一致）；
// 但用户在「日期样式」里显式改了任一属性后，以用户的独立设置为准。
// 这样既保留样例复刻效果，又保证单独调日期字号/粗细/透明度时立即生效。
const usesModelDateStyle = computed(() =>
  state.infoLayout === 'duo' &&
  state.dateFontFamily === null &&
  state.dateFontSize === null &&
  state.dateTextWeight === null &&
  state.dateTextOpacity === null,
)
const dateFontStyle = computed(() => {
  if (!usesModelDateStyle.value) {
    return 'var(--date-text-weight) var(--date-font-size)/1 var(--date-font-family)'
  }
  return 'var(--camera-model-italic) var(--camera-model-weight) var(--camera-model-size)/1 var(--camera-model-font-family)'
})
const dateOpacityStyle = computed(() =>
  usesModelDateStyle.value ? 'var(--camera-model-opacity)' : 'var(--date-text-opacity)',
)
// duo 下日期颜色同样逐属性回退：完全跟随机型时用机型颜色，否则用日期独立色（?? 自适应色）
const dateColorStyle = computed(() =>
  usesModelDateStyle.value ? 'var(--camera-model-color)' : 'var(--date-text-color)',
)
// 深色背景（模糊/照片填充）下文字加柔和投影，增强可读性（与导出端阴影一致）
const infoTextShadow = computed(() =>
  state.bgMode === 'solid' ? 'none' : '0 1px 3px rgba(0, 0, 0, 0.5)',
)

// 每项绝对定位样式：内容区坐标 + padding + 背景扩展偏移 → 画板坐标
function absStyle(key: ItemKey) {
  let x = state[(key + 'X') as 'logoX']
  let y = state[(key + 'Y') as 'logoY']
  if (x == null || y == null) {
    const d = defaultPos(key)
    x = d.x
    y = d.y
  }
  // classic 布局的文本元素（型号 / EXIF / 日期）默认 x 是内容区中点，
  // 需要向左平移 50% 才能真正居中；duo/inline 的 x 已由共享布局按左/右缘或中点算好，
  // 这里不能再做 -50% 偏移。
  const textKeysInClassic = new Set<ItemKey>(['model', 'exif', 'date', 'lens'])
  const centerShiftX = state.infoLayout === 'classic' && textKeysInClassic.has(key)
  return {
    left: pad.value + bgExpand.value + x + 'px',
    top: pad.value + bgExpand.value + y + 'px',
    transform: centerShiftX ? 'translate(-50%, 0)' : 'none',
  }
}
</script>

<template>
  <div ref="footerLayer" class="footer-layer" :class="{ editing: infoEditing }">
    <!-- 居中辅助线：INFO 面板展开时显示，拖拽元素接近中心时高亮 -->
    <div v-if="guideVisible" class="guide-v" :class="{ snap: guideV }" />
    <div v-if="guideVisible" class="guide-h" :class="{ snap: guideH }" />
    <!-- 下边白框带中线：下边宽度 > 0 时出现，元素拖近带中心时高亮吸附 -->
    <div
      v-if="guideVisible && bottomBandStyle"
      class="guide-band"
      :class="{ snap: guideBand }"
      :style="bottomBandStyle"
    />
    <!-- duo 双栏分隔竖线：编辑态可水平拖动线体；悬停显示两端手柄，拖动调节高度 -->
    <div
      v-if="duoDividerStyle"
      class="duo-divider"
      :class="{ dragging: dividerDragging }"
      :style="duoDividerStyle"
      @pointerdown="startDividerDrag($event, 'x')"
    >
      <div class="dv-handle top" title="拖动调节顶端" @pointerdown.stop="startDividerDrag($event, 'top')" />
      <div class="dv-handle bottom" title="拖动调节底端" @pointerdown.stop="startDividerDrag($event, 'bottom')" />
    </div>
    <!-- card 白底水印卡（手机品牌）：与导出同源布局，静态渲染不支持拖拽 -->
    <template v-if="cardLayout">
      <div
        class="phone-card"
        :style="[cardPos(cardLayout.card), { background: cardTheme.card, borderRadius: CARD_RADIUS + 'px' }]"
      />
      <span
        v-if="state.showCameraModel && state.cameraModel"
        class="pc-line pc-model"
        :style="[cardPos(cardLayout.model), { color: cardTheme.primary, font: `${state.cameraModelItalic ? 'italic ' : ''}${state.cameraModelWeight} ${cardLayout.model.h}px/1 ${state.cameraModelFont}` }]"
        >{{ modelText }}</span
      >
      <span
        v-if="cardLayout.date && state.dateText"
        class="pc-line pc-date"
        :style="[cardPos(cardLayout.date), { color: cardTheme.secondary, font: `${state.dateTextWeight ?? state.textWeight} ${cardLayout.date.h}px/1 ${state.dateFontFamily ?? state.fontFamily}` }]"
        >{{ state.dateText }}</span
      >
      <span
        v-if="state.showExif && state.exifText"
        class="pc-line pc-exif"
        :style="[cardPos(cardLayout.exif), { color: cardTheme.primary, font: `${state.exifTextWeight ?? state.textWeight} ${cardLayout.exif.h}px/1 ${state.exifFontFamily ?? state.fontFamily}` }]"
        >{{ state.exifText }}</span
      >
      <span
        v-if="cardLayout.lens && state.lensText"
        class="pc-line pc-lens"
        :style="[cardPos(cardLayout.lens), { color: cardTheme.secondary, font: `${state.lensTextWeight ?? state.textWeight} ${cardLayout.lens.h}px/1 ${state.lensFontFamily ?? state.fontFamily}` }]"
        >{{ state.lensText }}</span
      >
      <span
        v-if="cardBadge && cardLayout.badge"
        class="pc-badge"
        :style="[
          cardPos(cardLayout.badge),
          { background: cardBadge.bg, color: cardBadge.fg, fontSize: '20px', fontWeight: 600, lineHeight: cardLayout.badge.h + 'px' },
        ]"
        >{{ cardBadge.text }}</span
      >
    </template>
    <img
      v-if="state.showLogo && logoSrc && state.infoLayout !== 'card'"
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
      v-if="state.showCameraModel && state.infoLayout !== 'card'"
      :class="{ dragging: dragging === 'model' }"
      :style="[
        absStyle('model'),
        {
          display: 'var(--camera-model-display)',
          font: 'var(--camera-model-italic) var(--camera-model-weight) var(--camera-model-size)/1 var(--camera-model-font-family)',
          opacity: 'var(--camera-model-opacity)',
          color: 'var(--camera-model-color)',
          textShadow: infoTextShadow,
          transform: modelTransform,
        },
      ]"
      @pointerdown="onPointerDown($event, 'model')"
      >{{ modelText }}</span
    >
    <div
      class="exif-text drag-item"
      data-item="exif"
      v-if="state.showExif && state.infoLayout !== 'card'"
      :class="{ dragging: dragging === 'exif' }"
      :style="[
        absStyle('exif'),
        {
          display: 'var(--exif-display)',
          font: 'var(--exif-text-weight) var(--exif-font-size)/1 var(--exif-font-family)',
          opacity: 'var(--exif-text-opacity)',
          color: 'var(--exif-text-color)',
          textShadow: infoTextShadow,
        },
      ]"
      @pointerdown="onPointerDown($event, 'exif')"
    >
      <span class="exif-line">{{ state.exifText }}</span>
      <span
        v-if="state.showLens && state.lensText && state.infoLayout === 'classic'"
        class="lens-line"
        :style="{
          font: 'var(--lens-text-weight) var(--lens-font-size)/1 var(--lens-font-family)',
          opacity: 'var(--lens-text-opacity)',
          color: 'var(--lens-text-color)',
          marginTop: LENS_LINE_GAP + 'px',
        }"
        >{{ state.lensText }}</span>
    </div>

    <!-- 镜头行（duo 双栏左栏上行，独立定位可拖拽；classic 下随 EXIF 块内 lens-line） -->
    <div
      class="lens-text drag-item"
      data-item="lens"
      v-if="state.infoLayout === 'duo' && state.showLens && state.lensText"
      :class="{ dragging: dragging === 'lens' }"
      :style="[
        absStyle('lens'),
        {
          font: 'var(--lens-text-weight) var(--lens-font-size)/1 var(--lens-font-family)',
          opacity: 'var(--lens-text-opacity)',
          color: 'var(--lens-text-color)',
          textShadow: infoTextShadow,
        },
      ]"
      @pointerdown="onPointerDown($event, 'lens')"
    >
      {{ state.lensText }}
    </div>

    <!-- 拍摄日期：样式沿用 EXIF 文本（字体/字号/透明度），独立开关与文本 -->
    <div
      class="date-text drag-item"
      data-item="date"
      v-if="state.showDate && state.infoLayout !== 'card'"
      :class="{ dragging: dragging === 'date' }"
      :style="[
        absStyle('date'),
        {
          display: 'var(--date-display)',
          font: dateFontStyle,
          opacity: dateOpacityStyle,
          color: dateColorStyle,
          textShadow: infoTextShadow,
        },
      ]"
      @pointerdown="onPointerDown($event, 'date')"
    >
      {{ state.dateText }}
    </div>
  </div>
</template>

<style scoped>
.footer-layer {
  position: absolute;
  /* 覆盖整个画板（含边框留白背景区），元素坐标经 absStyle 加 padding 偏移定位，
     从而可在整个背景范围内自由拖动 */
  inset: 0;
  z-index: 2;
  pointer-events: none;
}
/* card 白底水印卡（手机品牌）：静态渲染，与导出 drawCardFooter 视觉一致 */
.phone-card {
  position: absolute;
}
.pc-line {
  position: absolute;
  white-space: nowrap;
}
.pc-badge {
  position: absolute;
  text-align: center;
  letter-spacing: 0.5px;
}
/* 居中辅助线：垂直中线（水平居中）、水平中线（垂直居中）、下边白框带中线 */
.guide-v,
.guide-h,
.guide-band {
  position: absolute;
  pointer-events: none;
  background: var(--border);
  opacity: 0.85;
}
.guide-v {
  left: 50%;
  top: 0;
  bottom: 0;
  width: 1px;
  transform: translateX(-0.5px);
}
.guide-h {
  top: 50%;
  left: 0;
  right: 0;
  height: 1px;
  transform: translateY(-0.5px);
}
.guide-band {
  left: 0;
  right: 0;
  height: 1px;
  transform: translateY(-0.5px);
}
/* 元素中心接近中心线 / 白框带中线时：高亮 */
.guide-v.snap,
.guide-h.snap,
.guide-band.snap {
  background: var(--slider-thumb);
  opacity: 1;
}
.drag-item {
  position: absolute;
  cursor: default;
  user-select: none;
  touch-action: none;
  /* 打印态：默认完全穿透，鼠标拖拽直接作用于照片/画布 */
  pointer-events: none;
  padding: 4px;
}
/* 编辑态（INFO 面板展开）：三元素可拖拽 */
.footer-layer.editing .drag-item {
  cursor: grab;
  pointer-events: auto;
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
/* 镜头型号行：EXIF 文本块附加行（块内纵向堆叠，与导出排版一致） */
.exif-text .exif-line,
.exif-text .lens-line {
  display: block;
}
/* 镜头行距由 LENS_LINE_GAP 内联绑定（与导出端同一常量），此处不再硬编码 */
.date-text {
  color: var(--footer-text-color);
  white-space: nowrap;
}
/* duo 双栏分隔竖线（浅灰，与导出一致）：容器 12px 命中热区，视觉 1px 线居中。
   定位走 transform（合成层），配 user-select/touch-action 约束，消除拖动拖影 */
.duo-divider {
  position: absolute;
  left: 0;
  width: 12px;
  margin-left: -6px; /* 以布局 x 为中心展开热区 */
  pointer-events: none;
  user-select: none;
  touch-action: none;
  will-change: transform;
}
.duo-divider::before {
  content: '';
  position: absolute;
  left: 5.5px;
  top: 0;
  bottom: 0;
  width: 1px;
  background: rgba(0, 0, 0, 0.18);
}
.footer-layer.editing .duo-divider {
  pointer-events: auto;
  cursor: ew-resize;
}
.duo-divider.dragging {
  cursor: ew-resize;
}
/* 高度调节手柄：竖线上/下端小方块，仅编辑态悬停竖线（或拖拽中）时显示 */
.dv-handle {
  position: absolute;
  left: 3px; /* 中心对齐 1px 视觉线（5.5 + 0.5） */
  width: 6px;
  height: 6px;
  box-sizing: border-box;
  background: var(--slider-thumb);
  border: 1px solid rgba(0, 0, 0, 0.4);
  cursor: ns-resize;
  opacity: 0;
  pointer-events: none;
  transition: opacity 0.12s;
}
.footer-layer.editing .duo-divider:hover .dv-handle,
.duo-divider.dragging .dv-handle {
  opacity: 1;
  pointer-events: auto;
}
.dv-handle.top {
  top: -3px;
}
.dv-handle.bottom {
  bottom: -3px;
}
  </style>
