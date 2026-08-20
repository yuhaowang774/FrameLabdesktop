<script setup lang="ts">
// 右侧分组：相框设置（对标 LrC 相框样式）。无背景模式下部分禁用。
import { computed } from 'vue'
import { useFrameConfig } from '../../composables/useFrameConfig'
import { editingPhoto } from '../../composables/useUi'
import { RANGES } from '../../core/constants'
import RangeSlider from '../common/RangeSlider.vue'

const { state, patch } = useFrameConfig()
const disabled = computed(() => state.bgMode === 'none')
const r = RANGES

function resetBg() {
  patch({ bgScale: 1, bgOffsetX: 0, bgOffsetY: 0 })
}
function openEditor() {
  editingPhoto.value = true
}
</script>

<template>
  <div class="block">
    <RangeSlider
      :model-value="state.blur"
      :min="r.blur.min"
      :max="r.blur.max"
      :step="r.blur.step"
      label="背景模糊"
      suffix="px"
      :disabled="disabled"
      @update:model-value="(v: number) => patch({ blur: v })"
    />
    <RangeSlider
      :model-value="state.radius"
      :min="r.radius.min"
      :max="r.radius.max"
      :step="r.radius.step"
      label="圆角"
      suffix="px"
      @update:model-value="(v: number) => patch({ radius: v })"
    />
    <RangeSlider
      :model-value="state.shadow"
      :min="r.shadow.min"
      :max="r.shadow.max"
      :step="r.shadow.step"
      label="立体阴影"
      @update:model-value="(v: number) => patch({ shadow: v })"
    />
    <div class="reset-row" :class="{ disabled }">
      <span class="reset-label">背景拖拽后重置</span>
      <button class="mini-btn" :disabled="disabled" @click="resetBg">背景位置</button>
    </div>
    <button class="edit-photo-btn" @click="openEditor">编辑照片（旋转 / 裁剪）</button>
  </div>
</template>

<style scoped>
.block {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.reset-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.reset-row.disabled {
  opacity: 0.4;
  pointer-events: none;
}
.reset-label {
  font-size: 12px;
  color: var(--text-dim);
}
.mini-btn {
  padding: 5px 9px;
  border-radius: 7px;
  border: 1px solid var(--border);
  background: var(--panel-2);
  color: var(--text);
  cursor: pointer;
  font-size: 12px;
}
.edit-photo-btn {
  margin-top: 4px;
  padding: 9px 12px;
  border-radius: 9px;
  border: 1px solid var(--accent);
  background: color-mix(in srgb, var(--accent) 16%, transparent);
  color: var(--text);
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
}
</style>
