<script setup lang="ts">
// 右侧分组：附加效果（暗角/颗粒）+ 水印叠加。
import { useFrameConfig } from '../../composables/useFrameConfig'
import { RANGES } from '../../core/constants'
import RangeSlider from '../common/RangeSlider.vue'

const { state, patch } = useFrameConfig()
const r = RANGES

function onWmImage(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => patch({ watermarkImage: String(reader.result) })
  reader.readAsDataURL(file)
}
</script>

<template>
  <div class="block">
    <RangeSlider
      :model-value="state.vignette"
      :min="r.vignette.min"
      :max="r.vignette.max"
      :step="r.vignette.step"
      label="暗角"
      @update:model-value="(v: number) => patch({ vignette: v })"
    />
    <RangeSlider
      :model-value="state.grain"
      :min="r.grain.min"
      :max="r.grain.max"
      :step="r.grain.step"
      label="颗粒"
      @update:model-value="(v: number) => patch({ grain: v })"
    />

    <div class="wm-head">
      <label class="chk">
        <input
          type="checkbox"
          :checked="state.showWatermark"
          @change="(e: Event) => patch({ showWatermark: (e.target as HTMLInputElement).checked })"
        />
        水印叠加
      </label>
    </div>

    <div v-if="state.showWatermark" class="wm-body">
      <div class="row">
        <label>模式</label>
        <div class="seg">
          <button :class="{ on: !state.watermarkTile }" @click="patch({ watermarkTile: false })">单一</button>
          <button :class="{ on: state.watermarkTile }" @click="patch({ watermarkTile: true })">平铺</button>
        </div>
      </div>

      <div v-if="!state.watermarkTile" class="row">
        <label>位置</label>
        <select
          :value="state.watermarkAlign"
          @change="(e: Event) => patch({ watermarkAlign: (e.target as HTMLSelectElement).value as any })"
        >
          <option value="center">居中</option>
          <option value="left">左下</option>
          <option value="right">右下</option>
        </select>
      </div>
      <div v-if="!state.watermarkTile" class="row">
        <label>距底</label>
        <RangeSlider
          :model-value="state.watermarkBottom"
          :min="r.watermarkBottom.min"
          :max="r.watermarkBottom.max"
          :step="r.watermarkBottom.step"
          label=""
          unit="px"
          compact
          @update:model-value="(v: number) => patch({ watermarkBottom: v })"
        />
      </div>

      <div class="field">
        <label>文本水印</label>
        <input
          class="inp"
          type="text"
          :value="state.watermarkText"
          @input="(e: Event) => patch({ watermarkText: (e.target as HTMLInputElement).value })"
        />
      </div>

      <div class="field">
        <label>图片水印（可选）</label>
        <input type="file" accept="image/*" @change="onWmImage" />
      </div>

      <RangeSlider
        :model-value="state.watermarkOpacity"
        :min="r.watermarkOpacity.min"
        :max="r.watermarkOpacity.max"
        :step="r.watermarkOpacity.step"
        label="不透明度"
        @update:model-value="(v: number) => patch({ watermarkOpacity: v })"
      />
      <RangeSlider
        :model-value="state.watermarkSize"
        :min="r.watermarkSize.min"
        :max="r.watermarkSize.max"
        :step="r.watermarkSize.step"
        label="大小"
        suffix="%"
        @update:model-value="(v: number) => patch({ watermarkSize: v })"
      />
      <RangeSlider
        v-if="state.watermarkTile"
        :model-value="state.watermarkAngle"
        :min="r.watermarkAngle.min"
        :max="r.watermarkAngle.max"
        :step="r.watermarkAngle.step"
        label="倾斜"
        suffix="°"
        @update:model-value="(v: number) => patch({ watermarkAngle: v })"
      />
    </div>
  </div>
</template>

<style scoped>
.block {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.chk {
  display: flex;
  align-items: center;
  gap: 7px;
  font-size: 13px;
  font-weight: 600;
}
.wm-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--panel-2);
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
.seg {
  display: flex;
  border: 1px solid var(--border);
  border-radius: 6px;
  overflow: hidden;
}
.seg button {
  background: var(--panel-3);
  color: var(--text-dim);
  border: none;
  padding: 5px 12px;
  font-size: 12px;
  cursor: pointer;
}
.seg button.on {
  background: var(--accent);
  color: #fff;
}
select,
.inp {
  background: var(--panel-3);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 5px;
  padding: 5px 7px;
  font-size: 12px;
}
.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.field label {
  font-size: 12px;
  color: var(--text-dim);
}
</style>
