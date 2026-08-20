<script setup lang="ts">
// 右侧分组：图片布局（对标 LrC 变换/布局）。缩放 + 照片位置 + 旋转 + 裁剪入口。
import { useFrameConfig } from '../../composables/useFrameConfig'
import { editingPhoto } from '../../composables/useUi'
import { RANGES } from '../../core/constants'
import RangeSlider from '../common/RangeSlider.vue'

const { state, patch } = useFrameConfig()

function resetPhoto() {
  patch({ photoX: null, photoY: null })
}
function rotate() {
  const next = ((state.photoRotation + 90) % 360) as 0 | 90 | 180 | 270
  patch({ photoRotation: next })
}
function openEditor() {
  editingPhoto.value = true
}
</script>

<template>
  <div class="block">
    <RangeSlider
      :model-value="state.scale"
      :min="RANGES.scale.min"
      :max="RANGES.scale.max"
      :step="RANGES.scale.step"
      label="原图缩放"
      suffix="%"
      :disabled="state.bgMode === 'none'"
      @update:model-value="(v: number) => patch({ scale: v })"
    />
    <div class="row">
      <span class="lbl">旋转</span>
      <div class="btns">
        <button class="mini-btn" @click="rotate">↻ 90°</button>
      </div>
    </div>
    <div class="reset-row">
      <span class="reset-label">照片拖拽后重置</span>
      <button class="mini-btn" @click="resetPhoto">照片位置</button>
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
.row {
  display: flex;
  align-items: center;
  gap: 8px;
}
.lbl {
  flex: 1;
  font-size: 12px;
  color: var(--text-dim);
}
.btns {
  display: flex;
  gap: 6px;
}
.reset-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
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
