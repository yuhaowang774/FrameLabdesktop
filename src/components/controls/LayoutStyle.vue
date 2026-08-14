<script setup lang="ts">
// 布局与质感控件：模糊/边框/缩放/圆角/阴影；无背景模式下整体 disabled
import { computed } from 'vue'
import { useFrameConfig } from '../../composables/useFrameConfig'
import { RANGES } from '../../core/constants'
import RangeSlider from '../common/RangeSlider.vue'

const { state, patch } = useFrameConfig()
const disabled = computed(() => state.bgMode === 'none')

const r = RANGES
</script>

<template>
  <section class="control-block" :class="{ disabled }">
    <h4>布局与质感</h4>
    <RangeSlider
      v-model="state.blur"
      :min="r.blur.min"
      :max="r.blur.max"
      :step="r.blur.step"
      label="背景模糊"
      suffix="px"
      :disabled="disabled"
    />
    <RangeSlider
      v-model="state.padding"
      :min="r.padding.min"
      :max="r.padding.max"
      :step="r.padding.step"
      label="边框宽度"
      suffix="px"
      :disabled="disabled"
    />
    <RangeSlider
      v-model="state.scale"
      :min="r.scale.min"
      :max="r.scale.max"
      :step="r.scale.step"
      label="原图缩放"
      suffix="%"
      :disabled="disabled"
    />
    <RangeSlider
      v-model="state.radius"
      :min="r.radius.min"
      :max="r.radius.max"
      :step="r.radius.step"
      label="圆角"
      suffix="px"
      :disabled="disabled"
    />
    <RangeSlider
      v-model="state.shadow"
      :min="r.shadow.min"
      :max="r.shadow.max"
      :step="r.shadow.step"
      label="立体阴影"
      :disabled="disabled"
    />
  </section>
</template>

<style scoped>
.control-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.control-block.disabled {
  opacity: 0.4;
  pointer-events: none;
}
h4 {
  font-size: 13px;
  color: #aaa;
  margin-bottom: 2px;
}
</style>
