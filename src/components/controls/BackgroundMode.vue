<script setup lang="ts">
// 背景模式控件：原背景 / 自定义 / 无背景
// 阶段10：none 模式暴露"叠加位置"控件（居左/中/右 + 距底边）
import { ref } from 'vue'
import { useFrameConfig } from '../../composables/useFrameConfig'
import { BG_MODES, OVERLAY_ALIGNS, RANGES } from '../../core/constants'
import ToggleGroup from '../common/ToggleGroup.vue'
import RangeSlider from '../common/RangeSlider.vue'

const { state, patch } = useFrameConfig()
const customInput = ref<HTMLInputElement | null>(null)
const r = RANGES

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

const emit = defineEmits<{ 'custom-bg': [img: HTMLImageElement] }>()

async function onCustomBgChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  const url = URL.createObjectURL(file)
  try {
    const img = await loadImage(url)
    emit('custom-bg', img)
    // 同时持久化到 config（转 dataURL，便于导出与历史恢复）
    const dataUrl = await fileToDataURL(file)
    patch({ bgMode: 'custom', customBgImage: dataUrl })
  } catch {
    /* ignore */
  }
  input.value = ''
}

function fileToDataURL(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function pickCustom() {
  customInput.value?.click()
}
</script>

<template>
  <section class="control-block">
    <ToggleGroup
      v-model="state.bgMode"
      :options="BG_MODES"
      label="背景模式"
    />

    <!-- 无背景模式：footer 叠加位置可调 -->
    <template v-if="state.bgMode === 'none'">
      <ToggleGroup
        v-model="state.overlayAlign"
        :options="OVERLAY_ALIGNS"
        label="叠加位置"
      />
      <RangeSlider
        v-model="state.overlayBottom"
        :min="r.overlayBottom.min"
        :max="r.overlayBottom.max"
        :step="r.overlayBottom.step"
        label="距底边"
        suffix="px"
      />
      <p class="hint">无背景时主照片铺满，品牌/EXIF 以叠加层显示在照片上。</p>
    </template>

    <!-- 自定义背景：上传图作背景 -->
    <button v-else-if="state.bgMode === 'custom'" class="sub-btn" @click="pickCustom">
      选择背景图
    </button>
    <p v-else class="hint">原图模糊并变暗作为边框背景。</p>

    <input ref="customInput" type="file" accept="image/*" @change="onCustomBgChange" hidden />
  </section>
</template>

<style scoped>
.control-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.sub-btn {
  padding: 8px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
  cursor: pointer;
  font-size: 13px;
}
.sub-btn:hover {
  background: rgba(255, 255, 255, 0.12);
}
.hint {
  font-size: 11px;
  color: #888;
  margin: 0;
  line-height: 1.4;
}
</style>
