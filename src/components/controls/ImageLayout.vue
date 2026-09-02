<script setup lang="ts">
// 右侧分组：图片布局。照片位置 + 旋转 + 裁剪入口 + 立体阴影。
import { useFrameConfig } from '../../composables/useFrameConfig'
import { editingPhoto } from '../../composables/useUi'
import { RANGES } from '../../core/constants'
import RangeSlider from '../common/RangeSlider.vue'
import ControlGroup from '../common/ControlGroup.vue'

const { state, patch } = useFrameConfig()
const r = RANGES

function rotate() {
  const next = ((state.photoRotation + 90) % 360) as 0 | 90 | 180 | 270
  // photoCrop 是「相对旋转后图像」的归一化矩形，旋转角度改变后旧 crop 会取到错误区域，
  // 故旋转时重置为满框（与 PhotoEditor 行为一致）；同时恢复自动居中/贴顶布局，避免宽高交换错位。
  patch({
    photoRotation: next,
    photoCrop: { x: 0, y: 0, w: 1, h: 1 },
    photoX: null,
    photoY: null,
  })
}
function openEditor() {
  editingPhoto.value = true
}
</script>

<template>
  <div class="block">
    <!-- 变换：旋转 + 裁剪编辑入口 -->
    <ControlGroup title="变换">
      <div class="row">
        <span class="lbl">旋转</span>
        <div class="btns">
          <button class="mini-btn" @click="rotate">↻ 90°</button>
        </div>
      </div>
      <button class="edit-photo-btn" @click="openEditor">编辑照片（旋转 / 裁剪）</button>
    </ControlGroup>
    <!-- 效果：立体阴影 + 照片圆角 -->
    <ControlGroup title="效果">
      <RangeSlider
        :model-value="state.shadow"
        :min="r.shadow.min"
        :max="r.shadow.max"
        :step="r.shadow.step"
        label="立体阴影"
        @update:model-value="(v: number) => patch({ shadow: v })"
      />
      <!-- 照片圆角：现代极简风 -->
      <RangeSlider
        :model-value="state.photoRadius"
        :min="r.photoRadius.min"
        :max="r.photoRadius.max"
        :step="r.photoRadius.step"
        label="照片圆角"
        unit="px"
        @update:model-value="(v: number) => patch({ photoRadius: v })"
      />
    </ControlGroup>
  </div>
</template>

<style scoped>
.block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.row {
  display: flex;
  align-items: center;
  gap: 8px;
  line-height: 16px;
}
.lbl {
  flex: 1;
  font-size: 12px;
  font-weight: 400;
  color: var(--text-dim);
}
.btns {
  display: flex;
  gap: 4px;
}
.mini-btn {
  height: 22px;
  padding: 0 9px;
  border-radius: 0;
  border: 1px solid var(--border);
  background: var(--panel-2);
  color: var(--text);
  cursor: pointer;
  font-size: 12px;
  font-weight: 400;
  line-height: 16px;
}
.mini-btn:hover {
  background: var(--hover);
  color: var(--text-normal);
}
.mini-btn:active {
  background: var(--pressed);
}
.edit-photo-btn {
  height: 24px;
  padding: 0 12px;
  border-radius: 0;
  border: 1px solid var(--border);
  background: var(--panel-2);
  color: var(--text);
  cursor: pointer;
  font-size: 12px;
  font-weight: 400;
  line-height: 16px;
}
.edit-photo-btn:hover {
  background: var(--hover);
  color: var(--text-normal);
}
.edit-photo-btn:active {
  background: var(--pressed);
}
</style>
