<script setup lang="ts">
// 边框设置模块：编辑模式（简易/自由拖拽）、边框宽度、下边比例（连续+快捷预设）、
// 边框颜色、边框圆角、边框比例（仅自由拖拽模式）。
import { computed } from 'vue'
import { useFrameConfig } from '../../composables/useFrameConfig'
import { useAppState } from '../../composables/useAppState'
import { BORDER_COLORS, FRAME_RATIOS, frameRatioOf, frameRatioKey, RANGES } from '../../core/constants'
import RangeSlider from '../common/RangeSlider.vue'
import ToggleGroup from '../common/ToggleGroup.vue'

const { state, patch } = useFrameConfig()
const app = useAppState()
const r = RANGES

// 编辑模式：简易 / 自由拖拽（二者互斥）。
// 优化：模式切换不再清空边框样式，仅影响画布交互行为。
const freeDrag = computed(() => app.editMode.value === 'free')
const MODES = [
  { value: 'simple', label: '简易' },
  { value: 'free', label: '自由拖拽' },
]
function onMode(v: string) {
  app.setEditMode(v === 'free' ? 'free' : 'simple')
}
</script>

<template>
  <div class="block">
    <!-- 编辑模式：简易 / 自由拖拽，互斥 -->
    <ToggleGroup
      :model-value="freeDrag ? 'free' : 'simple'"
      :options="MODES"
      label="编辑模式"
      @update:model-value="onMode"
    />

    <!-- 边框宽度：两种模式均可调；滑到 0 即无边框 -->
    <RangeSlider
      label="边框宽度"
      :min="r.padding.min"
      :max="r.padding.max"
      :step="r.padding.step"
      :model-value="state.padding"
      unit="px"
      @update:model-value="(v: number) => patch({ padding: v })"
    />

    <!-- 下边宽度：绝对像素，仅在照片下边额外延长留白 -->
    <RangeSlider
      label="下边宽度"
      :min="r.borderRatio.min"
      :max="r.borderRatio.max"
      :step="r.borderRatio.step"
      :model-value="state.borderRatio"
      unit="px"
      @update:model-value="(v: number) => patch({ borderRatio: v })"
    />

    <!-- 边框颜色：预设 + 取色器 -->
    <div class="color-row">
      <span class="lbl">边框颜色</span>
      <div class="color-presets">
        <button
          v-for="o in BORDER_COLORS"
          :key="o.value"
          class="swatch"
          :class="{ on: o.value === state.borderColor }"
          :style="{ background: o.value }"
          :title="o.label"
          @click="patch({ borderColor: o.value })"
        />
        <label class="picker">
          <input
            type="color"
            :value="state.borderColor"
            @input="(e: Event) => patch({ borderColor: (e.target as HTMLInputElement).value })"
          />
          <span class="picker-box" :style="{ background: state.borderColor }" />
        </label>
      </div>
    </div>

    <!-- 边框圆角 -->
    <RangeSlider
      label="边框圆角"
      :min="r.borderRadius.min"
      :max="r.borderRadius.max"
      :step="r.borderRadius.step"
      :model-value="state.borderRadius"
      unit="px"
      @update:model-value="(v: number) => patch({ borderRadius: v })"
    />

    <!-- 自由拖拽模式专属：边框比例（画面宽高比） -->
    <template v-if="freeDrag">
      <ToggleGroup
        :model-value="frameRatioKey(state.frameRatio)"
        :options="FRAME_RATIOS"
        label="边框比例"
        @update:model-value="(v: string) => patch({ frameRatio: frameRatioOf(v) })"
      />
    </template>
  </div>
</template>

<style scoped>
.block {
  display: flex;
  flex-direction: column;
  gap: 10px; /* 紧凑密度 */
}
.color-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 22px;
  line-height: 16px;
}
.lbl {
  flex: none;
  width: 72px;
  font-size: 12px;
  font-weight: 400;
  color: var(--text-dim);
}
.color-presets {
  display: flex;
  align-items: center;
  gap: 4px;
}
.swatch {
  width: 20px;
  height: 20px;
  border: 1px solid var(--border);
  border-radius: 0;
  cursor: pointer;
  padding: 0;
}
.swatch.on {
  outline: 1px solid var(--text);
  outline-offset: 1px;
}
.picker {
  position: relative;
  width: 20px;
  height: 20px;
  cursor: pointer;
}
.picker input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}
.picker-box {
  position: absolute;
  inset: 0;
  border: 1px solid var(--border);
  border-radius: 0;
  background-image: conic-gradient(#555 25%, #333 25% 50%, #555 50% 75%, #333 75%);
  background-size: 6px 6px;
}
</style>
