<script setup lang="ts">
// 背景模式控件：背景模糊 / 纯色 / 照片填充
// 各模式专属控件集中在此，操作逻辑简洁
// 桌面端（Tauri）：选择背景图走系统对话框 + Rust 读盘转 dataURL
import { ref } from 'vue'
import { useFrameConfig } from '../../composables/useFrameConfig'
import { BG_MODES, RANGES } from '../../core/constants'
import ToggleGroup from '../common/ToggleGroup.vue'
import RangeSlider from '../common/RangeSlider.vue'
import { isTauri } from '../../platform/env'

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

/** 统一入口：拿到 dataURL 后校验可解码并写入配置 */
async function applyCustomBg(dataUrl: string) {
  try {
    const img = await loadImage(dataUrl)
    emit('custom-bg', img)
    patch({ bgMode: 'photo', customBgImage: dataUrl })
  } catch {
    /* ignore */
  }
}

async function onCustomBgChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    const dataUrl = await fileToDataURL(file)
    await applyCustomBg(dataUrl)
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
  if (isTauri) {
    void (async () => {
      const { pickImageFiles, readLocalDataURL } = await import('../../platform/fs')
      const list = await pickImageFiles()
      if (!list.length) return
      const dataUrl = await readLocalDataURL(list[0].path)
      await applyCustomBg(dataUrl)
    })()
    return
  }
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

    <!-- 通用（所有模式）：背景宽度 + 下边比例 -->
    <RangeSlider
      :model-value="state.bgExpand"
      :min="r.bgExpand.min"
      :max="r.bgExpand.max"
      :step="r.bgExpand.step"
      label="背景宽度"
      unit="px"
      @update:model-value="(v: number) => patch({ bgExpand: v })"
    />
    <RangeSlider
      :model-value="state.bgBottomRatio"
      :min="r.bgBottomRatio.min"
      :max="r.bgBottomRatio.max"
      :step="r.bgBottomRatio.step"
      label="下边宽度"
      unit="px"
      @update:model-value="(v: number) => patch({ bgBottomRatio: v })"
    />

    <!-- 背景模糊：原图模糊+变暗 -->
    <template v-if="state.bgMode === 'blur'">
      <RangeSlider
        :model-value="state.blur"
        :min="r.blur.min"
        :max="r.blur.max"
        :step="r.blur.step"
        label="模糊强度"
        suffix="px"
        @update:model-value="(v: number) => patch({ blur: v })"
      />
    </template>

    <!-- 纯色：颜色选择器 -->
    <template v-else-if="state.bgMode === 'solid'">
      <div class="color-row">
        <label>背景颜色</label>
        <input
          type="color"
          :value="state.bgColor"
          @input="(e: Event) => patch({ bgColor: (e.target as HTMLInputElement).value })"
        />
      </div>
    </template>

    <!-- 照片填充：上传背景图 + 模糊 -->
    <template v-else-if="state.bgMode === 'photo'">
      <button class="sub-btn" @click="pickCustom">选择背景图</button>
      <RangeSlider
        :model-value="state.blur"
        :min="r.blur.min"
        :max="r.blur.max"
        :step="r.blur.step"
        label="模糊强度"
        suffix="px"
        @update:model-value="(v: number) => patch({ blur: v })"
      />
    </template>

    <input ref="customInput" type="file" accept="image/*" @change="onCustomBgChange" hidden />
  </section>
</template>

<style scoped>
.control-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.color-row {
  display: flex;
  align-items: center;
  gap: 12px;
  min-height: 22px;
  line-height: 16px;
}
.color-row label {
  flex: none;
  width: 72px;
  font-size: 12px;
  font-weight: 400;
  color: var(--text-dim);
}
.color-row input[type='color'] {
  width: 32px;
  height: 22px;
  border: 1px solid var(--border);
  border-radius: 0;
  background: none;
  padding: 0;
  cursor: pointer;
}
.sub-btn {
  height: 24px;
  padding: 0 12px;
  border: 1px solid var(--border);
  background: var(--panel-2);
  color: var(--text);
  cursor: pointer;
  font-size: 12px;
  font-weight: 400;
  line-height: 16px;
  border-radius: 0;
}
.sub-btn:hover {
  background: var(--hover);
  color: var(--text-normal);
}
.sub-btn:active {
  background: var(--pressed);
}
</style>
