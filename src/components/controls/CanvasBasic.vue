<script setup lang="ts">
// 右侧分组：画布基础设置（对标 LrC 画布/边框基础）
import { useFrameConfig } from '../../composables/useFrameConfig'
import { RANGES } from '../../core/constants'
import RangeSlider from '../common/RangeSlider.vue'

const { state, patch } = useFrameConfig()
</script>

<template>
  <div class="block">
    <RangeSlider
      label="边框宽度"
      :min="RANGES.padding.min"
      :max="RANGES.padding.max"
      :step="RANGES.padding.step"
      :model-value="state.padding"
      :disabled="state.bgMode === 'none'"
      unit="px"
      @update:model-value="(v: number) => patch({ padding: v })"
    />
    <div class="row">
      <label>画板底色</label>
      <input
        type="color"
        :value="state.artboardColor === 'transparent' ? '#000000' : state.artboardColor"
        @input="(e: Event) => patch({ artboardColor: (e.target as HTMLInputElement).value })"
      />
      <button class="mini" @click="patch({ artboardColor: 'transparent' })">透明</button>
    </div>
    <label class="chk">
      <input type="checkbox" :checked="state.layerVisible.bg" @change="(e: Event) => patch({ layerVisible: { ...state.layerVisible, bg: (e.target as HTMLInputElement).checked } })" />
      显示背景层
    </label>
    <label class="chk">
      <input type="checkbox" :checked="state.layerVisible.photo" @change="(e: Event) => patch({ layerVisible: { ...state.layerVisible, photo: (e.target as HTMLInputElement).checked } })" />
      显示照片层
    </label>
    <label class="chk">
      <input type="checkbox" :checked="state.layerVisible.info" @change="(e: Event) => patch({ layerVisible: { ...state.layerVisible, info: (e.target as HTMLInputElement).checked } })" />
      显示信息层(Logo/EXIF)
    </label>
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
.row label {
  flex: 1;
  font-size: 12px;
  color: var(--text-dim);
}
.row input[type='color'] {
  width: 36px;
  height: 26px;
  border: 1px solid var(--border);
  border-radius: 5px;
  background: none;
}
.mini {
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 5px;
  color: var(--text);
  font-size: 11px;
  padding: 4px 8px;
  cursor: pointer;
}
.chk {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 12px;
  color: var(--text);
}
</style>
