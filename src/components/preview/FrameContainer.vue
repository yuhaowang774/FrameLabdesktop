<script setup lang="ts">
// 1200px 边框容器：CSS 变量驱动布局，组合背景/主照片/底部信息（可拖拽）
import { computed, ref, watch, onMounted, onBeforeUnmount } from 'vue'
import BgCanvas from './BgCanvas.vue'
import MainPhoto from './MainPhoto.vue'
import FooterInfo from './FooterInfo.vue'
import EffectOverlay from './EffectOverlay.vue'
import SelectableBox from '../common/SelectableBox.vue'
import { useFrameConfig } from '../../composables/useFrameConfig'
import { useLayers } from '../../composables/useLayers'
import { DESIGN_CONTAINER } from '../../core/constants'
import { mapPhotoRectToConfig, mapBgRectToConfig, bgRectFromConfig } from '../../core/dragMap'
import { rotatedSize } from '../../core/photoEdit'
import { applyShowToggles } from '../../core/showToggles'

const props = defineProps<{
  /** 主照片 src（dataURL 或 objectURL） */
  photoSrc: string | null
  /** 背景图元素（原图或自定义图），供 BgCanvas 绘制 */
  bgImage: HTMLImageElement | HTMLCanvasElement | null
  /** 是否启用画布拖拽交互：自由拖拽模式=true；简易模式=false（隐藏拖拽控制点/选择框） */
  interactive?: boolean
}>()
const interactive = computed(() => props.interactive !== false)

// 复用已解码的背景图（HTMLImageElement）供 MainPhoto 显示，避免超大图二次解码
const photoImg = computed<HTMLImageElement | null>(() =>
  props.bgImage instanceof HTMLImageElement ? props.bgImage : null,
)

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
  if (rect && rect.width) contScale.value = rect.width / containerWDesign.value
}
onMounted(() => {
  updateScale()
  // 子组件先于父组件 Workspace 的 fit() 挂载，fit() 会设置祖先 transform: scale；
  // 下一帧再读一次，确保拿到缩放后的真实屏幕尺寸。
  requestAnimationFrame(updateScale)
  if (root.value && 'ResizeObserver' in window) {
    ro = new ResizeObserver(updateScale)
    // 观察 border-box：frame 是 box-sizing:border-box，边框宽度(padding)变化时
    // 只有 border-box 尺寸变化，content box（内容区恒 1200px）不变，必须指定 border-box 才能触发。
    ro.observe(root.value, { box: 'border-box' })
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

// 内容区设计尺寸（frame-container 的 content box，即 padding 内侧）
// 所有 photoX/photoY、bgOffset、logoX 等设计坐标统一使用"内容区坐标系"，原点在内容区左上角。
// 关键：基准宽度固定为设计稿宽度，与边框宽度(padding)解耦。
// 这样调节「边框宽度」时照片大小不变，边框在照片四周向外扩展，画布随之变大（而非向内压缩照片）。
const BASE_CONTENT = DESIGN_CONTAINER
const availW = computed(() => BASE_CONTENT)

// 有效配置：显示开关（隐藏边框/背景 → 布局几何归零）。预览与导出同源。
const effConfig = computed(() => applyShowToggles(state))

// 实际 CSS padding：上/左/右 = eff padding（边框隐藏时归零，照片铺满）。
const cssPadding = computed(() => effConfig.value.padding)
// 下边宽度：边框留白下边 = padding + borderRatio（eff）
const cssPadBottom = computed(() => effConfig.value.padding + effConfig.value.borderRatio)

// 画面（边框）比例：内容区宽高比（16:9 / 4:3 / 1:1 ...）。null = 自由（跟随照片）。
const frameRatio = computed(() => state.frameRatio)

// 照片在内容区内的「基准宽」（scale=100 时的照片宽）：
// - 自由模式：= 内容区宽（照片宽 = 内容宽 × scale%，原行为）
// - 比例模式：= contain 适配宽（照片等比完整放入固定比例内容区，取「贴宽 / 贴高」中较小者）
const photoBaseW = computed(() => {
  if (!frameRatio.value) return availW.value
  const ch = availW.value / frameRatio.value
  const contentAspect = availW.value / ch
  const pa = photoDisplayAspect.value
  return pa >= contentAspect ? availW.value : ch * pa
})

const photoRect = computed(() => {
  const w = photoBaseW.value * (state.scale / 100)
  const h = w / photoDisplayAspect.value
  // 内容区坐标：x=0 即贴内容区左缘（= 画布左 padding 内侧）
  const x = state.photoX ?? (availW.value - w) / 2
  // 自由模式默认贴内容区顶；比例模式默认垂直居中（照片完整放入固定比例内容区）
  const y = state.photoY ?? (frameRatio.value ? (availW.value / frameRatio.value - h) / 2 : 0)
  return { left: x, top: y, width: w, height: h }
})

// 内容区坐标 → frame-container absolute 定位坐标（加 padding + 背景四等宽扩展偏移），
// 供 SelectableBox / 静态层渲染。内容区在背景区域（content box）中居中，偏移 = bgExpand。
const photoRectAbs = computed(() => ({
  left: cssPadding.value + bgExpand.value + photoRect.value.left,
  top: cssPadding.value + bgExpand.value + photoRect.value.top,
  width: photoRect.value.width,
  height: photoRect.value.height,
}))

// 内容区设计高度（照片/INFO 坐标系，边框内侧固定区域）：
// 比例模式固定高（1200/ratio）；自由模式 = 照片高。canvasH 存在时由用户手动指定覆盖。
const contentHDesign = computed(() => {
  if (state.canvasH) return Math.max(0, state.canvasH - effConfig.value.padding - cssPadBottom.value)
  if (frameRatio.value) return availW.value / frameRatio.value
  return Math.max(0, photoRect.value.top + photoRect.value.height)
})

// ===== 背景区域（独立于内容区，单位 px，与边框宽度一致） =====
// bgExpand=0：背景=内容区；>0：上/左/右各扩 bgExpand，下边扩 bgExpand + bgBottomRatio，边框/画布同步跟随。
// 背景区域始终以内容区为锚点：内容区左/上距背景区域边缘 = bgExpand，下距 = bgExpand + bgBottomRatio。
const bgExpand = computed(() => effConfig.value.bgExpand)
const bgBottomExpand = computed(() => effConfig.value.bgExpand + effConfig.value.bgBottomRatio)
const bgAreaW = computed(() => availW.value + 2 * bgExpand.value)
const bgAreaH = computed(() => contentHDesign.value + bgExpand.value + bgBottomExpand.value)

// 容器设计尺寸（box-sizing: border-box）：边框层始终包裹「背景区域」。
// 背景扩宽时边框（padding 区）与画布同步跟随扩大，照片保持在内容区不动。
const containerWDesign = computed(() => bgAreaW.value + effConfig.value.padding * 2)
const containerHDesign = computed(() =>
  Math.max(0, contentHDesign.value + bgExpand.value + bgBottomExpand.value + effConfig.value.padding + cssPadBottom.value),
)

function onPhotoRect(r: { left: number; top: number; width: number; height: number }) {
  selectedLayer.value = 'photo'
  // r 为 frame-container absolute 坐标（含 padding），转回内容区坐标再映射
  const content = { ...r, left: r.left - cssPadding.value, top: r.top - cssPadding.value }
  const cfg = mapPhotoRectToConfig(content, photoBaseW.value, state.padding)
  // 保留亚像素精度（避免多次拖拽累积取整漂移）；导出时再四舍五入
  patch({
    photoX: content.left,
    photoY: content.top,
    scale: cfg.scale,
  })
}

// ===== 背景矩形（按图像 cover 宽高比缩放后边界，设计坐标） =====
// 关键：背景必须保持"图像自身宽高比"，而不是容器宽高比，否则竖向缩放会失效/跳动。
function bgImageSize(): { iw: number; ih: number } {
  const img = props.bgImage
  if (!img) return { iw: bgAreaW.value, ih: bgAreaH.value }
  if ('naturalWidth' in img && (img as HTMLImageElement).naturalWidth) {
    return {
      iw: (img as HTMLImageElement).naturalWidth,
      ih: (img as HTMLImageElement).naturalHeight,
    }
  }
  if ('width' in img && (img as HTMLCanvasElement).width) {
    return { iw: (img as HTMLCanvasElement).width, ih: (img as HTMLCanvasElement).height }
  }
  return { iw: bgAreaW.value, ih: bgAreaH.value }
}

// ===== 背景区域（覆盖范围独立于内容区，四等宽扩展，以内容区中心为锚点） =====
// bgExpand=0：背景=内容区；>0：背景扩宽，边框同步跟随。
// 背景区域即画板的 content box（画板 padding = 边框宽度），背景 .bg-clip inset = padding 即覆盖背景区域。
const bgCoverW = computed(() => {
  const { iw, ih } = bgImageSize()
  const s0 = Math.max(bgAreaW.value / iw, bgAreaH.value / ih)
  return iw * s0
})
const bgAspect = computed(() => {
  const { iw, ih } = bgImageSize()
  return ih / iw
})

// 背景选择框：坐标为「背景区域坐标」（= content box 坐标），转画板 absolute 坐标仅需加 padding
const bgRect = computed(() =>
  bgRectFromConfig(
    state.bgScale,
    state.bgOffsetX,
    state.bgOffsetY,
    bgCoverW.value,
    bgAspect.value,
    bgAreaW.value,
    bgAreaH.value,
  ),
)
const bgRectAbs = computed(() => ({
  left: cssPadding.value + bgRect.value.left,
  top: cssPadding.value + bgRect.value.top,
  width: bgRect.value.width,
  height: bgRect.value.height,
}))

function onBgRect(r: { left: number; top: number; width: number; height: number }) {
  selectedLayer.value = 'bg'
  // r 为 frame-container absolute 坐标（含 padding），转回背景区域（content box）坐标再映射
  const content = {
    left: r.left - cssPadding.value,
    top: r.top - cssPadding.value,
    width: r.width,
    height: r.height,
  }
  const cfg = mapBgRectToConfig(content, bgAreaW.value, bgAreaH.value, bgCoverW.value)
  patch(cfg)
}

// 主照片加载完成后记录源图尺寸。页脚 INFO 元素不在此固化位置：
// logoX/exifY 等为 null 时由 FooterInfo.defaultPos / exporter 按当前开关动态计算默认布局
// （镜头型号行/日期行增减、字号变化均自动重排）；用户拖拽后才写入具体坐标。
function onPhotoReady(info: { w: number; h: number }) {
  photoNatural.value = { w: info.w, h: info.h }
}

// 调整边框宽度(padding)时：照片保持「当前位置」视觉不动，四周留白等量增大，画布从照片中心向外扩展。
// 做法：photoX/photoY 内容区坐标与照片大小均不变；容器宽/高 = 内容区 + 2*padding 随之增大。
// 屏幕层面由 Workspace.fit() 配合：识别「内容区不变、仅 border-box 变化」时保持 fitScale 不变，
// 照片在屏幕上的位置与大小完全不动，画布经 .stage 居中向四周对称扩展。

// 切换照片：不做位置重置 —— App 层在原子切换时已通过 loadCursorFor 恢复该照片历史保存的
// 完整参数（含 photoX/photoY/canvasH/页脚位置）；无历史时默认参数即自动布局。
// 这里仅同步更新 photoNatural：bgImage 与 photoSrc 在同一 tick 更新，直接用新图的自然尺寸，
// 避免容器先塌缩成 1:1 再跳变导致的切换卡顿。
watch(
  () => props.photoSrc,
  () => {
    const img = props.bgImage
    const w = img && img instanceof HTMLImageElement && img.naturalWidth ? img.naturalWidth : 1
    const h = img && img instanceof HTMLImageElement && img.naturalHeight ? img.naturalHeight : 1
    photoNatural.value = { w, h }
  },
)

// 暴露照片设计尺寸（供 Workspace.fit 判断「照片是否变化」，避免依赖 DOM 测量）。
// 边框宽度/背景扩展变化时照片尺寸不变，Workspace 据此保持 fitScale 不重算。
defineExpose({
  getPhotoSize(): { w: number; h: number } {
    return { w: photoRect.value.width, h: photoRect.value.height }
  },
  // 画板设计尺寸（响应式）：供 Workspace 同一 Vue flush 内推导 wrap 布局尺寸，
  // 与本组件 :style 同帧更新、同一次布局原子生效（消除 RO 回调写 wrap 滞后一帧的中间态）。
  frameW: containerWDesign,
  frameH: containerHDesign,
})
</script>

<template>
  <!-- 画板（由内向外第 4 层，最外承载一切）：同心嵌套结构由内向外为「照片 → 背景 → 边框 → 画板」 -->
  <div
    class="frame-container"
    :class="{ 'no-border': !effConfig.showBorder }"
    ref="root"
    :style="{ width: containerWDesign + 'px', height: containerHDesign + 'px' }"
    @pointerdown.self="selectedLayer = 'artboard'"
  >
    <!-- 背景层（由内向外第 2 层）：覆盖范围独立于内容区（bgExpand 四等宽扩展）。
         背景 = 画板 content box（padding 内侧），边框层随画板尺寸同步包裹背景。 -->
    <div class="bg-clip" v-if="state.showBackground && isVisible('bg')">
      <BgCanvas :image="bgImage" :blur="bgBlur" :container-w="bgAreaW" :container-h="bgAreaH" class="bg-layer" />
    </div>

    <!-- 边框层（由内向外第 3 层）：纯色相框，包裹背景内容区的一圈 -->
    <div class="border-layer" />

    <!-- 背景选择框：仅自由拖拽模式启用拖拽平移 / 角点缩放 -->
    <SelectableBox
      v-if="interactive && state.bgMode !== 'solid' && isVisible('bg')"
      :rect="bgRectAbs"
      :scale="contScale"
      :selected="selectedLayer === 'bg'"
      :lock-aspect="true"
      :min-size="100"
      @select="selectedLayer = 'bg'"
      @update:rect="onBgRect"
      class="bg-select"
    />

    <!-- 主照片层（由内向外第 1 层，最内核心）：始终渲染；仅自由拖拽模式外加 SelectableBox 控制点 -->
    <template v-if="photoSrc && isVisible('photo')">
      <SelectableBox
        v-if="interactive"
        :rect="photoRectAbs"
        :scale="contScale"
        :selected="selectedLayer === 'photo'"
        :lock-aspect="true"
        :min-size="60"
        @select="selectedLayer = 'photo'"
        @update:rect="onPhotoRect"
        class="photo-select"
      >
        <MainPhoto :src="photoSrc" :image="photoImg" :rotation="state.photoRotation" :crop="state.photoCrop" @ready="onPhotoReady" />
      </SelectableBox>
      <div
        v-else
        class="photo-static"
        :style="{
          left: photoRectAbs.left + 'px',
          top: photoRectAbs.top + 'px',
          width: photoRectAbs.width + 'px',
          height: photoRectAbs.height + 'px',
        }"
      >
        <MainPhoto :src="photoSrc" :image="photoImg" :rotation="state.photoRotation" :crop="state.photoCrop" @ready="onPhotoReady" />
      </div>
    </template>

    <!-- 未选择照片提示：编辑页且无主照片时显示在画板上 -->
    <div v-if="!photoSrc" class="no-photo-hint">请选择导入照片</div>

    <!-- 信息图层（顶层：Logo + 相机型号 + EXIF）：未导入照片时不显示 -->
    <div
      v-show="photoSrc && state.showInfo && isVisible('info')"
      class="info-layer"
      :class="{ selected: selectedLayer === 'info' }"
      @pointerdown="interactive && (selectedLayer = 'info')"
    >
      <FooterInfo />
    </div>

    <!-- 顶层效果叠加：暗角 + 颗粒 + 水印（与导出一致） -->
    <EffectOverlay :container-h="containerHDesign" />
  </div>
</template>

<style scoped>
.frame-container {
  position: relative;
  /* 宽度/高度由 :style 动态绑定（containerWDesign × containerHDesign）。
     注意：不要设置 max-width: 100%。
     它会被祖先 .fit-wrap 的 transform: scale(fitScale*zoom) 二次压缩（layout 一次 + transform 一次），
     导致内部「设计px ≠ CSSpx」、坐标错乱，照片拖拽按下点无法跟随光标。
     正确做法是 frame-container 布局尺寸恒等于设计px（内容区+边框），缩放完全交给 fit-wrap 的 transform。 */
  padding: var(--frame-pad-top) var(--frame-pad-x) var(--frame-pad-bottom);
  border-radius: var(--frame-radius);
  /* 允许选择框手柄溢出容器显示（背景放大时手柄在容器外） */
  overflow: visible;
  /* 边框底色兜底（正常使用时背景层/边框层会覆盖它；隐藏背景层时可见） */
  background: var(--frame-color);
  box-sizing: border-box;
}
.frame-container.no-border {
  /* 边框隐藏：画板底色改透明，避免照片边缘露出边框色 */
  background: transparent;
}
.bg-clip {
  position: absolute;
  /* 背景 = 画板 content box（padding 内侧）= 背景区域（bgExpand 四等宽扩展后） */
  inset: var(--frame-pad-top) var(--frame-pad-x) var(--frame-pad-bottom);
  border-radius: var(--frame-radius-inner);
  overflow: hidden;
  z-index: 0;
  /* 形成独立层叠上下文，确保内部 effect-overlay(z-index:4) 不会溢出到照片之上 */
  isolation: isolate;
}
/* 纯色相框边框层：用 border 模拟 padding 留白区，包裹背景区域的一圈（画板之上、背景之下）。
   背景扩宽时画板尺寸同步增大，边框外缘跟随扩大。内圆角由 border-radius 与 border-width 自动同心。 */
.border-layer {
  position: absolute;
  inset: 0;
  border: solid var(--frame-color);
  border-width: var(--frame-pad-top) var(--frame-pad-x) var(--frame-pad-bottom);
  border-radius: var(--frame-radius);
  z-index: 1;
  pointer-events: none;
}
.bg-layer {
  z-index: 0;
}
.bg-select {
  z-index: 2;
}
.photo-select {
  z-index: 5;
}
.photo-static {
  position: absolute;
  z-index: 5;
  pointer-events: none;
  border-radius: var(--img-radius);
  /* 立体阴影（由 --photo-shadow 驱动，与导出一致） */
  box-shadow: var(--photo-shadow);
  overflow: hidden;
}
/* 信息图层：铺满容器，作为顶层被点击时选中（不拦截照片/背景拖拽）。
   注意：绝不能让 .info-layer 的直接子元素（FooterInfo 的 footer-layer）继承 pointer-events:auto，
   否则 footer-layer（inset:0 铺满）会拦截照片/背景拖拽。footer-layer 自身已是 pointer-events:none，
   仅 logo/model/exif 三个 .drag-item 为 auto。 */
.info-layer {
  position: absolute;
  inset: 0;
  z-index: 6;
  pointer-events: none;
}
.info-layer.selected {
  outline: 1px dashed var(--text);
  outline-offset: -2px;
}
/* 未选择照片提示：居中覆盖在画板上方，不拦截交互 */
.no-photo-hint {
  position: absolute;
  inset: 0;
  z-index: 7;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.75);
  font-size: 26px;
  letter-spacing: 1px;
  pointer-events: none;
  user-select: none;
}
</style>
