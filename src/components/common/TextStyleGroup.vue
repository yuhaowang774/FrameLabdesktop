<script setup lang="ts">
// 单组 INFO 文本样式控件：字体 / 字号 / 粗细 / 透明度。
// 独立字段为 null 时表示「跟随整体 INFO 样式」，界面显示整体值并提示「跟随整体」，
// 用户一旦改动即写入该组独立值；提供「↺ 跟随整体」一键清除独立覆盖。
import { computed } from 'vue'
import { RANGES } from '../../core/constants'
import { previewFont } from '../../composables/useCssVars'
import RangeSlider from '../common/RangeSlider.vue'
import FontSelect from '../common/FontSelect.vue'

const props = defineProps<{
  label: string
  fontField: string
  sizeField: string
  weightField: string
  opacityField: string
  font: string | null
  size: number | null
  weight: number | null
  opacity: number | null
  globalFont: string
  globalSize: number
  globalWeight: number
  globalOpacity: number
  /** 是否允许「跟随整体」回退（型号等本就独立的项传 false） */
  followGlobal?: boolean
}>()
const emit = defineEmits<{ (e: 'patch', v: Record<string, unknown>): void }>()

const r = RANGES
const effFont = computed(() => props.font ?? props.globalFont)
const effSize = computed(() => props.size ?? props.globalSize)
const effWeight = computed(() => props.weight ?? props.globalWeight)
const effOpacity = computed(() => props.opacity ?? props.globalOpacity)
const isFollowing = computed(
  () => props.font === null && props.size === null && props.weight === null && props.opacity === null,
)

function applyFontPreview(v: string | null) {
  previewFont.value = v
}
function setFont(v: string) {
  emit('patch', { [props.fontField]: v })
}
function setSize(v: number) {
  emit('patch', { [props.sizeField]: v })
}
function setWeight(v: number) {
  emit('patch', { [props.weightField]: v })
}
function setOpacity(v: number) {
  emit('patch', { [props.opacityField]: v })
}
function reset() {
  emit('patch', {
    [props.fontField]: null,
    [props.sizeField]: null,
    [props.weightField]: null,
    [props.opacityField]: null,
  })
}
</script>

<template>
  <div class="style-group">
    <div class="sg-head">
      <span class="sg-label">{{ label }}</span>
      <button
        v-if="followGlobal && !isFollowing"
        type="button"
        class="sg-reset"
        title="恢复跟随整体 INFO 样式"
        @click="reset"
      >
        ↺ 跟随整体
      </button>
      <span v-else-if="followGlobal" class="sg-tag">跟随整体</span>
    </div>
    <div class="field">
      <label>字体</label>
      <FontSelect :model-value="effFont" @update:model-value="setFont" @preview="applyFontPreview" />
    </div>
    <RangeSlider
      :model-value="effSize"
      :min="r.fontSize.min"
      :max="r.fontSize.max"
      :step="r.fontSize.step"
      label="字号"
      @update:model-value="setSize"
    />
    <RangeSlider
      :model-value="effWeight"
      :min="r.textWeight.min"
      :max="r.textWeight.max"
      :step="r.textWeight.step"
      label="粗细"
      @update:model-value="setWeight"
    />
    <RangeSlider
      :model-value="effOpacity"
      :min="r.textOpacity.min"
      :max="r.textOpacity.max"
      :step="r.textOpacity.step"
      label="透明度"
      @update:model-value="setOpacity"
    />
  </div>
</template>

<style scoped>
.style-group {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-top: 10px;
  padding: 16px 8px 8px;
  border: 1px dashed var(--border);
  background: var(--panel);
}
.sg-head {
  position: absolute;
  top: -9px;
  left: 8px;
  right: 8px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  pointer-events: none;
}
.sg-label {
  padding: 0 4px;
  font-size: 12px;
  font-weight: 400;
  color: var(--text);
  background: var(--panel);
  pointer-events: auto;
}
.sg-tag {
  padding: 0 4px;
  font-size: 11px;
  color: var(--text-dim);
  background: var(--panel);
  pointer-events: auto;
}
.sg-reset {
  height: 18px;
  padding: 0 6px;
  border: 1px solid var(--border);
  background: var(--panel);
  color: var(--text-dim);
  cursor: pointer;
  font-size: 11px;
  line-height: 14px;
  border-radius: 0;
  pointer-events: auto;
}
.sg-reset:hover {
  background: var(--hover);
  color: var(--text-normal);
}
.style-group :deep(.field) {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 22px;
  line-height: 16px;
}
.style-group :deep(.field > label) {
  flex: none;
  width: 76px;
  font-size: 12px;
  font-weight: 400;
  color: var(--text-dim);
}
</style>
