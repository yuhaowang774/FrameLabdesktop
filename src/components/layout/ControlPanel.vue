<script setup lang="ts">
// 右侧可折叠参数面板组：
// 顶部单行线性图标工具栏 + 四个可折叠面板（照片/背景/边框/INFO信息设置）
// + 底部两个扁平功能按钮（上一张 / 复位）。
import { useAppState } from '../../composables/useAppState'
import { useLibrary } from '../../composables/useLibrary'
import { useFrameConfig } from '../../composables/useFrameConfig'
import CollapsiblePanel from '../common/CollapsiblePanel.vue'
import Icon from '../common/Icon.vue'
import ImageLayout from '../controls/ImageLayout.vue'
import BackgroundMode from '../controls/BackgroundMode.vue'
import BorderSettings from '../controls/BorderSettings.vue'
import InfoLayerPanel from '../controls/InfoLayerPanel.vue'

const app = useAppState()
const library = useLibrary()
const { reset, patch } = useFrameConfig()
const P = app.state.rightPanels

function isOpen(id: 'photo' | 'background' | 'border' | 'info'): boolean {
  return P[id]
}

/** 顶部工具栏：全部折叠 / 全部展开 */
function setAllOpen(open: boolean) {
  app.setPanel('right', 'photo', open)
  app.setPanel('right', 'background', open)
  app.setPanel('right', 'border', open)
  app.setPanel('right', 'info', open)
}

// ===== 各模块独立复位（仅重置该模块的字段，其他保留） =====
const DEFAULT = {
  // 照片
  shadow: 0.5,
  photoRadius: 0,
  photoRotation: 0 as 0 | 90 | 180 | 270,
  photoCrop: { x: 0, y: 0, w: 1, h: 1 },
  photoX: null as number | null,
  photoY: null as number | null,
  // 背景
  bgMode: 'blur' as const,
  bgColor: '#000000',
  bgScale: 1,
  bgOffsetX: 0,
  bgOffsetY: 0,
  bgExpand: 0,
  bgBottomRatio: 0,
  blur: 40,
  // 边框
  padding: 0,
  borderRatio: 0,
  borderColor: '#000000',
  borderRadius: 0,
  frameRatio: null as number | null,
  // INFO
  showLogo: false,
  showCameraModel: false,
  showExif: false,
  showLens: false,
  brand: 'sony',
  logoColor: 'auto',
  logoSize: 40,
  logoOpacity: 1,
  cameraModel: '',
  cameraModelSize: 14,
  cameraModelGap: 8,
  exifText: '',
  lensText: '',
  fontFamily: 'sans-serif',
  fontSize: 12,
  textWeight: 400,
  textOpacity: 1,
  overlayBottom: 16,
  distLogoText: 24,
  // INFO 文本独立样式复位为「跟随整体」（null）
  exifFontFamily: null, exifFontSize: null, exifTextWeight: null, exifTextOpacity: null,
  lensFontFamily: null, lensFontSize: null, lensTextWeight: null, lensTextOpacity: null,
  dateFontFamily: null, dateFontSize: null, dateTextWeight: null, dateTextOpacity: null,
  exifTextColor: null, lensTextColor: null, dateTextColor: null, cameraModelColor: null,
}
function resetPhoto() { patch({
  shadow: DEFAULT.shadow, photoRadius: DEFAULT.photoRadius,
  photoRotation: DEFAULT.photoRotation, photoCrop: DEFAULT.photoCrop,
  photoX: DEFAULT.photoX, photoY: DEFAULT.photoY,
}) }
function resetBackground() { patch({
  bgMode: DEFAULT.bgMode, bgColor: DEFAULT.bgColor,
  bgScale: DEFAULT.bgScale, bgOffsetX: DEFAULT.bgOffsetX, bgOffsetY: DEFAULT.bgOffsetY,
  bgExpand: DEFAULT.bgExpand, bgBottomRatio: DEFAULT.bgBottomRatio,
  blur: DEFAULT.blur,
}) }
function resetBorder() { patch({
  padding: DEFAULT.padding, borderRatio: DEFAULT.borderRatio,
  borderColor: DEFAULT.borderColor, borderRadius: DEFAULT.borderRadius,
  frameRatio: DEFAULT.frameRatio,
}) }
function resetInfo() { patch({
  showLogo: DEFAULT.showLogo, showCameraModel: DEFAULT.showCameraModel, showExif: DEFAULT.showExif,
  showLens: DEFAULT.showLens,
  brand: DEFAULT.brand, logoColor: DEFAULT.logoColor, logoSize: DEFAULT.logoSize, logoOpacity: DEFAULT.logoOpacity,
  cameraModel: DEFAULT.cameraModel, cameraModelSize: DEFAULT.cameraModelSize, cameraModelGap: DEFAULT.cameraModelGap,
  exifText: DEFAULT.exifText, lensText: DEFAULT.lensText,
  fontFamily: DEFAULT.fontFamily, fontSize: DEFAULT.fontSize,
  textWeight: DEFAULT.textWeight, textOpacity: DEFAULT.textOpacity,
  exifFontFamily: DEFAULT.exifFontFamily, exifFontSize: DEFAULT.exifFontSize,
  exifTextWeight: DEFAULT.exifTextWeight, exifTextOpacity: DEFAULT.exifTextOpacity,
  lensFontFamily: DEFAULT.lensFontFamily, lensFontSize: DEFAULT.lensFontSize,
  lensTextWeight: DEFAULT.lensTextWeight, lensTextOpacity: DEFAULT.lensTextOpacity,
  dateFontFamily: DEFAULT.dateFontFamily, dateFontSize: DEFAULT.dateFontSize,
  dateTextWeight: DEFAULT.dateTextWeight, dateTextOpacity: DEFAULT.dateTextOpacity,
  exifTextColor: DEFAULT.exifTextColor, lensTextColor: DEFAULT.lensTextColor,
  dateTextColor: DEFAULT.dateTextColor, cameraModelColor: DEFAULT.cameraModelColor,
  overlayBottom: DEFAULT.overlayBottom, distLogoText: DEFAULT.distLogoText,
  // 页脚坐标一并复位为 null（回自动布局），否则旧物化坐标会让复位后布局仍偏移
  logoX: null, logoY: null, modelX: null, modelY: null,
  exifX: null, exifY: null, dateX: null, dateY: null,
}) }

// ===== 左边缘拖拽调整宽度（持久化到 useAppState.setRightWidth） =====
let startX = 0
let startW = 0
function onResizeDown(e: PointerEvent) {
  startX = e.clientX
  startW = app.state.rightWidth
  window.addEventListener('pointermove', onResizeMove)
  window.addEventListener('pointerup', onResizeUp)
  e.preventDefault()
}
function onResizeMove(e: PointerEvent) {
  // 向左拖拽（clientX 减小）→ 宽度增加
  app.setRightWidth(startW + (startX - e.clientX))
}
function onResizeUp() {
  window.removeEventListener('pointermove', onResizeMove)
  window.removeEventListener('pointerup', onResizeUp)
}
</script>

<template>
  <aside class="right-panels" :style="{ width: app.rightWidthPx.value }">
    <!-- 左边缘拖拽手柄：向左拖变宽 -->
    <div class="resize-handle" title="拖拽调整右栏宽度" @pointerdown="onResizeDown" />

    <!-- 顶部：单行线性图标工具栏 -->
    <div class="panel-toolbar">
      <button class="tb-icon" title="全部折叠" @click="setAllOpen(false)">
        <Icon name="collapse" />
      </button>
      <button class="tb-icon" title="全部展开" @click="setAllOpen(true)">
        <Icon name="expand" />
      </button>
      <span class="tb-sep" />
      <button class="tb-icon" title="复位全部参数" @click="reset()">
        <Icon name="reset" />
      </button>
    </div>

    <!-- 面板组：纵向单列，细分割线分隔（由内向外：照片 → 背景 → 边框 → INFO） -->
    <div class="panel-list">
      <!-- 1. 照片 -->
      <CollapsiblePanel
        title="照片"
        :open="isOpen('photo')"
        @toggle="app.togglePanel('right', 'photo')"
      >
        <template #icon><Icon name="photo" /></template>
        <template #actions>
          <button title="复位照片参数" @click="resetPhoto()">复位</button>
        </template>
        <ImageLayout />
      </CollapsiblePanel>

      <!-- 2. 背景 -->
      <CollapsiblePanel
        title="背景"
        :open="isOpen('background')"
        @toggle="app.togglePanel('right', 'background')"
      >
        <template #icon><Icon name="background" /></template>
        <template #actions>
          <button title="复位背景参数" @click="resetBackground()">复位</button>
        </template>
        <BackgroundMode />
      </CollapsiblePanel>

      <!-- 3. 边框 -->
      <CollapsiblePanel
        title="边框"
        :open="isOpen('border')"
        @toggle="app.togglePanel('right', 'border')"
      >
        <template #icon><Icon name="border" /></template>
        <template #actions>
          <button title="复位边框参数" @click="resetBorder()">复位</button>
        </template>
        <BorderSettings />
      </CollapsiblePanel>

      <!-- 4. INFO 信息设置 -->
      <CollapsiblePanel
        title="INFO信息设置"
        :open="isOpen('info')"
        @toggle="app.togglePanel('right', 'info')"
      >
        <template #icon><Icon name="info" /></template>
        <template #actions>
          <button title="复位 INFO 参数" @click="resetInfo()">复位</button>
        </template>
        <InfoLayerPanel />
      </CollapsiblePanel>
    </div>

    <!-- 底部：两个扁平矩形功能按钮 -->
    <div class="panel-footer">
      <button class="foot-btn" title="切换到上一张照片" @click="library.prev()">上一张</button>
      <button class="foot-btn" title="将所有参数复位到默认值" @click="reset()">复位</button>
    </div>
  </aside>
</template>

<style scoped>
.right-panels {
  position: relative;
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--panel);
  border-left: 1px solid var(--border);
  flex-shrink: 0;
  min-width: 200px;
  max-width: 520px;
  direction: rtl;
}
.right-panels > * {
  direction: ltr;
}
.resize-handle {
  position: absolute;
  top: 0;
  left: 0;
  bottom: 0;
  width: 5px;
  cursor: ew-resize;
  z-index: 4;
  background: transparent;
}
.resize-handle:hover {
  background: var(--panel-3);
}

/* ===== 顶部：单行线性图标工具栏 ===== */
.panel-toolbar {
  flex: none;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 6px 8px;
  border-bottom: 1px solid var(--border);
  background: var(--panel);
}
.tb-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 26px;
  height: 24px;
  border: none;
  border-radius: 3px;
  background: transparent;
  color: var(--text-dim);
  cursor: pointer;
  padding: 0;
}
.tb-icon:hover {
  background: var(--hover);
  color: var(--text);
}
.tb-sep {
  width: 1px;
  height: 14px;
  margin: 0 4px;
  background: var(--border);
}

/* ===== 面板列表：纵向单列滚动 ===== */
.panel-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
}
.sub-divider {
  margin: 8px 0 6px;
  padding-top: 6px;
  border-top: 1px solid var(--border);
  font-size: 12px;
  font-weight: 400; /* 禁止粗体 */
  letter-spacing: 0;
  text-transform: none;
  line-height: 16px;
  color: var(--text-dim);
}
.sub-divider:first-child {
  border-top: none;
  padding-top: 0;
  margin-top: 2px;
}

/* ===== 底部：两个扁平矩形按钮 ===== */
.panel-footer {
  flex: none;
  display: flex;
  border-top: 1px solid var(--border);
  background: var(--panel);
}
.foot-btn {
  flex: 1;
  height: 26px;
  border: none;
  border-right: 1px solid var(--border);
  background: var(--btn-bg);
  color: var(--text);
  font-size: 12px;
  font-weight: 400;
  line-height: 16px;
  cursor: pointer;
  border-radius: 0; /* 圆角 ≤ 2px */
  padding: 0 6px;
}
.foot-btn:last-child {
  border-right: none;
}
.foot-btn:hover {
  background: var(--hover);
  color: var(--text-normal);
}
.foot-btn:active {
  background: var(--pressed);
}
</style>
