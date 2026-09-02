<script setup lang="ts">
// 边框设置模块：编辑模式（简易/自由拖拽）、边框宽度、下边比例（连续+快捷预设）、
// 边框颜色、边框圆角、边框比例（仅自由拖拽模式）。
import { computed } from 'vue'
import { useFrameConfig } from '../../composables/useFrameConfig'
import { useAppState } from '../../composables/useAppState'
import { FRAME_RATIOS, frameRatioOf, frameRatioKey, RANGES } from '../../core/constants'
import RangeSlider from '../common/RangeSlider.vue'
import ToggleGroup from '../common/ToggleGroup.vue'
import ControlGroup from '../common/ControlGroup.vue'
import ColorField from '../common/ColorField.vue'

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
    <!-- 主开关：编辑模式（简易 / 自由拖拽，互斥） -->
    <ToggleGroup
      :model-value="freeDrag ? 'free' : 'simple'"
      :options="MODES"
      label="编辑模式"
      @update:model-value="onMode"
    />

    <!-- 边框样式：宽度 / 下边 / 颜色 / 圆角 -->
    <ControlGroup title="边框样式">
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

      <!-- 边框颜色：与其他颜色项统一的控件形式 -->
      <div class="color-row">
        <span class="lbl">边框颜色</span>
        <ColorField
          :model-value="state.borderColor"
          :auto="false"
          @update:model-value="(v: string | null) => patch({ borderColor: v ?? '#ffffff' })"
        />
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
    </ControlGroup>

    <!-- 自由拖拽模式专属：边框比例（画面宽高比） -->
    <ControlGroup v-if="freeDrag" title="画面比例">
      <ToggleGroup
        :model-value="frameRatioKey(state.frameRatio)"
        :options="FRAME_RATIOS"
        @update:model-value="(v: string) => patch({ frameRatio: frameRatioOf(v) })"
      />
    </ControlGroup>
  </div>
</template>

<style scoped>
.block {
  display: flex;
  flex-direction: column;
  gap: 8px; /* 紧凑密度；分组间距由 ControlGroup 自带 padding-top 拉开 */
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
</style>
