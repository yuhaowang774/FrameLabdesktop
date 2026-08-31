<script setup lang="ts">
// INFO 信息设置：三个可折叠板块（相机品牌 / 相机型号 / EXIF 参数）。
// 与右侧「照片/背景/边框」模块一致的折叠面板设计：展开 = 该元素显示在画布上并可调参，收起 = 隐藏。
// 展开本面板时画布上的三个元素可拖拽微调位置；收起后固定显示（打印态）。
import { computed, ref } from 'vue'
import { useFrameConfig } from '../../composables/useFrameConfig'
import { BRANDS, RANGES, MAX_CUSTOM_LOGOS, CROP_FACTORS, BRAND_LOGO_COLORS } from '../../core/constants'
import { buildExifText, formatDate, type DateFormat } from '../../composables/useExif'
import { footerTextColor, logoAutoColor } from '../../core/colorUtils'
import ColorField from '../common/ColorField.vue'
import { useLogoStore, CUSTOM_PREFIX } from '../../composables/useLogoStore'
import RangeSlider from '../common/RangeSlider.vue'
import CollapsiblePanel from '../common/CollapsiblePanel.vue'
import Icon from '../common/Icon.vue'
import GlassModal from '../common/GlassModal.vue'
import TextStyleGroup from '../common/TextStyleGroup.vue'
import type { FrameConfig } from '../../core/types'

const { state, patch } = useFrameConfig()
const r = RANGES
const { listCustomLogos, uploadCustomLogo, removeCustomLogo } = useLogoStore()

// ===== 品牌选项 =====
const brandOptions = BRANDS.map((b) => ({ value: b.id, label: b.name }))
const customLogos = ref(listCustomLogos())
const customBrandOptions = computed(() =>
  customLogos.value.map((c) => ({ value: `${CUSTOM_PREFIX}${c.id}`, label: c.name })),
)

// ===== Logo 颜色：自动 / 白 / 黑 / 品牌主色（有公认标志色的品牌才出现）/ 自定义色 =====
const brandHex = computed(() => BRAND_LOGO_COLORS[state.brand])
// 「自动」态色块参考色：INFO 文字随底色自适应黑白；Logo 随底色取黑/白
const footerColor = computed(() => footerTextColor(state.bgMode, state.bgColor, 0.95))
const logoAutoSwatch = computed(() => logoAutoColor(state.logoColor, state.bgMode, state.bgColor))
function refreshCustom() {
  customLogos.value = listCustomLogos()
}

// 各组独立样式（EXIF/镜头/日期/型号）改动的统一写入入口
function onStylePatch(v: Record<string, unknown>) {
  patch(v as unknown as Partial<FrameConfig>)
}
const cropFactorOptions = CROP_FACTORS

// ===== 等效焦距 =====
// 切换开关/系数后从 exifRaw 重拼 EXIF 文本（等效 = 焦距 × 系数，自动模式用 EXIF 35mm 字段）。
// 无 raw（手动输入文本/无 EXIF 照片）时不重拼，保留用户手填内容。
function onEqFocalChange(eqFocal: boolean, cropFactor: number) {
  const next: Record<string, unknown> = { eqFocal, cropFactor }
  if (state.exifRaw) {
    next.exifText = buildExifText(state.exifRaw, { eqFocal, cropFactor })
  }
  patch(next)
}
function onCropFactorChange(v: string) {
  onEqFocalChange(state.eqFocal, Number(v))
}

// ===== 拍摄日期 =====
// 切换格式时从 exifRaw.dateTimeOriginal 重拼（无 EXIF 照片保留手填文本）。
const DATE_FORMATS: { value: DateFormat; label: string }[] = [
  { value: 'date', label: '2026/08/27' },
  { value: 'datetime', label: '2026/08/27 10:30' },
  { value: 'dash', label: '2026-08-27 10:30' },
  { value: 'zh', label: '2026年8月27日' },
]
function onDateFormatChange(v: string) {
  const fmt = v as DateFormat
  const next: Record<string, unknown> = { dateFormat: fmt }
  if (state.exifRaw?.dateTimeOriginal) {
    next.dateText = formatDate(state.exifRaw.dateTimeOriginal, fmt)
  }
  patch(next)
}

// ===== 三个板块的展开/收起状态（与「是否显示」开关解耦） =====
// 面板展开 = 查看/调节设置项；面板内的「显示」开关 = 控制元素是否出现在画布上。
const openLogo = ref(true)
const openModel = ref(true)
const openExif = ref(true)

// ===== 自定义 Logo 管理 =====
const logoInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
const failOpen = ref(false)
const failMsg = ref('')
const atLimit = computed(() => customLogos.value.length >= MAX_CUSTOM_LOGOS)

function pickLogo() {
  if (atLimit.value) {
    failMsg.value = `自定义 Logo 已达上限（${MAX_CUSTOM_LOGOS} 个）`
    failOpen.value = true
    return
  }
  logoInput.value?.click()
}

async function onLogoFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  uploading.value = true
  try {
    const id = await uploadCustomLogo(file)
    refreshCustom()
    patch({ brand: `${CUSTOM_PREFIX}${id}`, showLogo: true })
  } catch (err) {
    failMsg.value = (err as Error).message || '上传失败'
    failOpen.value = true
  } finally {
    uploading.value = false
    input.value = ''
  }
}

async function onDeleteCustom(id: string) {
  await removeCustomLogo(id)
  if (state.brand === `${CUSTOM_PREFIX}${id}`) {
    patch({ brand: BRANDS[0].id })
  }
  refreshCustom()
}
</script>

<template>
  <div class="info-panel">
    <!-- 信息布局预设：classic=纵向堆叠；duo=杂志双栏（左镜头/机型 / 中Logo / 右参数+日期）；
         inline=悬浮双行（Logo+机型内联居中，参数居中其下） -->
    <div class="field layout-field">
      <label>信息布局</label>
      <select v-model="state.infoLayout" class="select">
        <option value="classic">经典纵向</option>
        <option value="duo">杂志双栏</option>
        <option value="inline">悬浮双行</option>
      </select>
    </div>
    <!-- 板块 1：相机品牌 -->
    <CollapsiblePanel title="相机品牌" :open="openLogo" @toggle="openLogo = !openLogo">
      <template #icon><Icon name="brand" /></template>
      <label class="show-switch">
        <input
          type="checkbox"
          :checked="state.showLogo"
          @change="patch({ showLogo: ($event.target as HTMLInputElement).checked })"
        />
        <span class="box" />
        <span class="sw-tag">显示 Logo</span>
      </label>
      <div class="field">
        <label>品牌</label>
        <select v-model="state.brand" class="select">
          <option v-for="o in brandOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
          <optgroup v-if="customBrandOptions.length" label="自定义">
            <option v-for="o in customBrandOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
          </optgroup>
        </select>
      </div>
      <RangeSlider v-model="state.logoSize" :min="r.logoSize.min" :max="r.logoSize.max" :step="r.logoSize.step" label="Logo 大小" />
      <RangeSlider v-model="state.logoOpacity" :min="r.logoOpacity.min" :max="r.logoOpacity.max" :step="r.logoOpacity.step" label="Logo 透明度" />
      <div class="field">
        <label>Logo 颜色</label>
        <ColorField
          :model-value="state.logoColor"
          auto-value="auto"
          :auto-swatch="logoAutoSwatch"
          :extra-options="brandHex ? [{ value: brandHex, label: '品牌主色' }] : []"
          @update:model-value="(v: string | null) => patch({ logoColor: v ?? 'auto' })"
        />
      </div>
      <!-- 自定义 Logo：上传 + 列表 -->
      <div class="custom-logo">
        <button class="mini-btn" :disabled="uploading || atLimit" @click="pickLogo">
          {{ uploading ? '上传中…' : atLimit ? `已达上限 ${MAX_CUSTOM_LOGOS}` : '+ 上传自定义 Logo' }}
        </button>
        <ul v-if="customLogos.length" class="logo-list">
          <li v-for="c in customLogos" :key="c.id" :class="{ active: state.brand === CUSTOM_PREFIX + c.id }">
            <button class="logo-thumb" :title="c.name" @click="patch({ brand: CUSTOM_PREFIX + c.id, showLogo: true })">
              <img :src="c.dataURL" :alt="c.name" />
            </button>
            <span class="logo-name" :title="c.name">{{ c.name }}</span>
            <button class="logo-del" title="删除" @click="onDeleteCustom(c.id)">×</button>
          </li>
        </ul>
      </div>
    </CollapsiblePanel>

    <!-- 板块 2：相机型号 -->
    <CollapsiblePanel title="相机型号" :open="openModel" @toggle="openModel = !openModel">
      <template #icon><Icon name="model" /></template>
      <label class="show-switch">
        <input
          type="checkbox"
          :checked="state.showCameraModel"
          @change="patch({ showCameraModel: ($event.target as HTMLInputElement).checked })"
        />
        <span class="box" />
        <span class="sw-tag">显示型号</span>
      </label>
      <input v-model="state.cameraModel" class="text-input" placeholder="相机型号，如 A7R V" />
      <TextStyleGroup
        label="型号样式"
        font-field="cameraModelFont"
        size-field="cameraModelSize"
        weight-field="cameraModelWeight"
        opacity-field="cameraModelOpacity"
        :font="state.cameraModelFont"
        :size="state.cameraModelSize"
        :weight="state.cameraModelWeight"
        :opacity="state.cameraModelOpacity"
        :global-font="state.fontFamily"
        :global-size="state.fontSize"
        :global-weight="state.textWeight"
        :global-opacity="state.textOpacity"
        :size-range="r.cameraModelSize"
        color-field="cameraModelColor"
        :color="state.cameraModelColor"
        :global-color="footerColor"
        :follow-global="false"
        @patch="onStylePatch"
      />
      <RangeSlider v-model="state.cameraModelGap" :min="r.cameraModelGap.min" :max="r.cameraModelGap.max" :step="r.cameraModelGap.step" label="型号距 Logo" />
    </CollapsiblePanel>

    <!-- 板块 3：EXIF 参数（导入/内置照片时自动识别填充，无需手动点击） -->
    <CollapsiblePanel title="EXIF 参数" :open="openExif" @toggle="openExif = !openExif">
      <template #icon><Icon name="exif" /></template>

      <!-- 子模块：EXIF 参数文本（开关紧连其控制项与样式组） -->
      <div class="submod">
        <label class="show-switch">
          <input
            type="checkbox"
            :checked="state.showExif"
            @change="patch({ showExif: ($event.target as HTMLInputElement).checked })"
          />
          <span class="box" />
          <span class="sw-tag">显示 EXIF</span>
        </label>
        <input v-model="state.exifText" class="text-input" placeholder="如 200mm f/4 1/800s ISO400" />
        <div class="field">
          <label>等效焦距</label>
          <div class="eq-row">
            <label class="eq-switch">
              <input
                type="checkbox"
                :checked="state.eqFocal"
                @change="onEqFocalChange(($event.target as HTMLInputElement).checked, state.cropFactor)"
              />
              <span>显示 35mm 等效</span>
            </label>
            <select
              v-if="state.eqFocal"
              class="select"
              :value="String(state.cropFactor)"
              @change="onCropFactorChange(($event.target as HTMLSelectElement).value)"
            >
              <option v-for="o in cropFactorOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
          </div>
        </div>
        <TextStyleGroup
          label="EXIF 文本样式"
          font-field="exifFontFamily"
          size-field="exifFontSize"
          weight-field="exifTextWeight"
          opacity-field="exifTextOpacity"
          :font="state.exifFontFamily"
          :size="state.exifFontSize"
          :weight="state.exifTextWeight"
          :opacity="state.exifTextOpacity"
          :global-font="state.fontFamily"
          :global-size="state.fontSize"
          :global-weight="state.textWeight"
          :global-opacity="state.textOpacity"
          color-field="exifTextColor"
          :color="state.exifTextColor"
          :global-color="footerColor"
          :follow-global="true"
          @patch="onStylePatch"
        />
      </div>

      <!-- 子模块：镜头型号 -->
      <div class="submod">
        <label class="show-switch">
          <input
            type="checkbox"
            :checked="state.showLens"
            @change="patch({ showLens: ($event.target as HTMLInputElement).checked })"
          />
          <span class="box" />
          <span class="sw-tag">显示镜头型号</span>
        </label>
        <input v-model="state.lensText" class="text-input" placeholder="如 FE 55mm F1.8 ZA（导入照片自动填充）" />
        <TextStyleGroup
          label="镜头样式"
          font-field="lensFontFamily"
          size-field="lensFontSize"
          weight-field="lensTextWeight"
          opacity-field="lensTextOpacity"
          :font="state.lensFontFamily"
          :size="state.lensFontSize"
          :weight="state.lensTextWeight"
          :opacity="state.lensTextOpacity"
          :global-font="state.fontFamily"
          :global-size="state.fontSize"
          :global-weight="state.textWeight"
          :global-opacity="state.textOpacity"
          color-field="lensTextColor"
          :color="state.lensTextColor"
          :global-color="footerColor"
          :follow-global="true"
          @patch="onStylePatch"
        />
      </div>

      <!-- 子模块：拍摄日期 -->
      <div class="submod">
        <label class="show-switch">
          <input
            type="checkbox"
            :checked="state.showDate"
            @change="patch({ showDate: ($event.target as HTMLInputElement).checked })"
          />
          <span class="box" />
          <span class="sw-tag">显示拍摄日期</span>
        </label>
        <input v-model="state.dateText" class="text-input" placeholder="如 2026/08/27（导入照片自动填充）" />
        <div class="field">
          <label>日期格式</label>
          <select
            class="select"
            :value="state.dateFormat"
            @change="onDateFormatChange(($event.target as HTMLSelectElement).value)"
          >
            <option v-for="o in DATE_FORMATS" :key="o.value" :value="o.value">{{ o.label }}</option>
          </select>
        </div>
        <TextStyleGroup
          label="日期样式"
          font-field="dateFontFamily"
          size-field="dateFontSize"
          weight-field="dateTextWeight"
          opacity-field="dateTextOpacity"
          :font="state.dateFontFamily"
          :size="state.dateFontSize"
          :weight="state.dateTextWeight"
          :opacity="state.dateTextOpacity"
          :global-font="state.fontFamily"
          :global-size="state.fontSize"
          :global-weight="state.textWeight"
          :global-opacity="state.textOpacity"
          color-field="dateTextColor"
          :color="state.dateTextColor"
          :global-color="footerColor"
          :follow-global="true"
          @patch="onStylePatch"
        />
      </div>
    </CollapsiblePanel>

    <input ref="logoInput" type="file" accept="image/*" @change="onLogoFile" hidden />
    <GlassModal
      v-model="failOpen"
      title="自定义 Logo"
      :message="failMsg"
      :show-cancel="false"
      confirm-text="知道了"
    />
  </div>
</template>

<style scoped>
.info-panel { display: flex; flex-direction: column; }
.layout-field { margin-bottom: 2px; }
/* 嵌套子折叠面板：第一个不显示顶部边框（外层面板 body 已带分割线） */
.info-panel :deep(.panel:first-child) {
  border-top: none;
}
.info-panel :deep(.panel-body) {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
/* 子模块：开关 + 控制项 + 样式组 作为一个整体紧邻排布，块间以细分隔线区分 */
.submod {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.info-panel :deep(.panel-body) > .submod + .submod {
  margin-top: 2px;
  padding-top: 10px;
  border-top: 1px solid var(--border);
}
/* 是否显示开关：checkbox + 间距 + 文字自然排列（不被遮挡） */
.show-switch {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 20px;
  cursor: pointer;
  user-select: none;
  line-height: 16px;
}
.show-switch .sw-tag {
  font-size: 12px;
  font-weight: 400;
  color: var(--text);
}
.show-switch input {
  position: absolute;
  opacity: 0;
  width: 0;
  height: 0;
}
.box {
  position: relative;
  width: 14px;
  height: 14px;
  border: 1px solid var(--border);
  background: var(--panel-2);
  border-radius: 0;
  flex: none;
}
.show-switch input:checked + .box {
  background: var(--slider-thumb);
  border-color: var(--slider-thumb);
}
.show-switch input:checked + .box::after {
  content: '';
  position: absolute;
  left: 4px;
  top: 1px;
  width: 4px;
  height: 8px;
  border: solid #333;
  border-width: 0 1.5px 1.5px 0;
  transform: rotate(45deg);
}
.txt {
  font-size: 12px;
  font-weight: 400;
  color: var(--text);
}
.field {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 22px;
  line-height: 16px;
}
.eq-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}
.eq-switch {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  user-select: none;
  font-size: 12px;
  color: var(--text-dim);
  white-space: nowrap;
}
.eq-switch input {
  margin: 0;
}
.field > label {
  flex: none;
  width: 72px;
  font-size: 12px;
  font-weight: 400;
  color: var(--text-dim);
}
.select,
.text-input {
  flex: 1;
  min-width: 0;
  height: 24px;
  padding: 0 8px;
  border-radius: 0;
  border: 1px solid var(--border);
  background: var(--panel-2);
  color: var(--text);
  font-size: 12px;
  font-weight: 400;
  line-height: 16px;
}
.mini-btn {
  height: 24px;
  padding: 0 12px;
  border: 1px solid var(--border);
  background: var(--panel-2);
  color: var(--text);
  cursor: pointer;
  font-size: 12px;
  font-weight: 400;
  line-height: 16px;
  border-radius: 0;
  align-self: flex-start;
}
.mini-btn:hover:not(:disabled) { background: var(--hover); color: var(--text-normal); }
.mini-btn:active:not(:disabled) { background: var(--pressed); }
.mini-btn:disabled { opacity: 0.5; cursor: default; }
.custom-logo {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px;
  border: 1px dashed var(--border);
}
.logo-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin: 0;
  padding: 0;
}
.logo-list li {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--panel-2);
  padding: 3px 6px;
  border: 1px solid transparent;
}
.logo-list li.active {
  background: var(--accent);
  border-color: var(--accent);
}
.logo-thumb {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 0;
  background: var(--panel-3);
  cursor: pointer;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}
.logo-thumb img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
.logo-name {
  flex: 1;
  font-size: 11px;
  font-weight: 400;
  color: var(--text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 16px;
}
.logo-del {
  flex-shrink: 0;
  width: 18px;
  height: 18px;
  border: 1px solid transparent;
  background: transparent;
  color: var(--text-dim);
  cursor: pointer;
  font-size: 13px;
  line-height: 1;
}
.logo-del:hover { background: var(--hover); color: var(--text-normal); }
</style>
