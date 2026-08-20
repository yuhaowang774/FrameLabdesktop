<script setup lang="ts">
// 导出控件：格式 / 质量 / 超采样快捷设置 + PNG/JPG 输出
// 桌面端：保存对话框写盘；网页端：浏览器下载。
import { ref, computed } from 'vue'
import { useFrameConfig } from '../../composables/useFrameConfig'
import { useExportOptions } from '../../composables/useExportOptions'
import { exportFrame, makeExportFilename } from '../../core/exporter'
import { saveBlobAs } from '../../platform/fs'
import GlassModal from '../common/GlassModal.vue'
import ToggleGroup from '../common/ToggleGroup.vue'
import RangeSlider from '../common/RangeSlider.vue'

const props = defineProps<{ sourceImg: HTMLImageElement | null }>()

const { state } = useFrameConfig()
const { options } = useExportOptions()
const exporting = ref(false)
const status = ref('')

const errOpen = ref(false)
const errTitle = ref('')
const errMsg = ref('')

function showError(title: string, msg: string) {
  errTitle.value = title
  errMsg.value = msg
  errOpen.value = true
}

// JPG 质量以百分比展示（0~100 <-> 0~1）
const jpgQualityPct = computed({
  get: () => Math.round(options.jpgQuality * 100),
  set: (v: number) => (options.jpgQuality = v / 100),
})

const formatOptions = [
  { value: 'png', label: 'PNG 无损' },
  { value: 'jpg', label: 'JPG' },
]
const scaleOptions = [
  { value: '1', label: '1x' },
  { value: '2', label: '2x' },
  { value: '3', label: '3x' },
]
const qualityPresetOptions = [
  { value: 'high', label: '高' },
  { value: 'mid', label: '中' },
  { value: 'low', label: '低' },
]

// 当前质量所属预设档（与手动滑块联动）：>=0.9 高，>=0.7 中，否则低
const qualityPreset = computed(() => {
  if (options.jpgQuality >= 0.9) return 'high'
  if (options.jpgQuality >= 0.7) return 'mid'
  return 'low'
})
function applyQualityPreset(v: string) {
  options.jpgQuality = v === 'high' ? 0.95 : v === 'mid' ? 0.8 : 0.6
}

async function onExport() {
  if (!props.sourceImg) {
    showError('无法导出', '请先上传照片')
    return
  }
  exporting.value = true
  status.value = '导出中…'
  try {
    const result = await exportFrame(props.sourceImg, state, {
      format: options.format,
      jpgQuality: options.jpgQuality,
      scale: options.scale,
    })
    const saved = await saveBlobAs(result.blob, makeExportFilename(result.format))
    status.value = saved ? '已导出' : '已取消'
  } catch (err) {
    const msg = (err as Error).message || '未知错误'
    status.value = '导出失败'
    showError('导出失败', msg)
  } finally {
    exporting.value = false
  }
}
</script>

<template>
  <section class="control-block">
    <h4>导出</h4>

    <ToggleGroup v-model="options.format" :options="formatOptions" label="格式" />

    <ToggleGroup
      :model-value="qualityPreset"
      :options="qualityPresetOptions"
      label="JPG 质量预设"
      :disabled="options.format !== 'jpg'"
      @update:model-value="(v: string) => applyQualityPreset(v)"
    />
    <RangeSlider
      v-model="jpgQualityPct"
      :min="10"
      :max="100"
      :step="1"
      suffix="%"
      label="JPG 质量"
      :disabled="options.format !== 'jpg'"
    />

    <ToggleGroup
      :model-value="String(options.scale)"
      :options="scaleOptions"
      label="超采样（清晰度）"
      @update:model-value="(v: string) => (options.scale = Number(v))"
    />

    <div class="export-row">
      <button class="export-btn" :disabled="exporting" @click="onExport">
        {{ exporting ? '导出中…' : '导出' }}
      </button>
    </div>
    <p class="status" v-if="status">{{ status }}</p>

    <GlassModal
      v-model="errOpen"
      :title="errTitle"
      :message="errMsg"
      :show-cancel="false"
      confirm-text="知道了"
    />
  </section>
</template>

<style scoped>
.control-block {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
h4 {
  font-size: 13px;
  color: #aaa;
  margin-bottom: 2px;
}
.export-row {
  display: flex;
  gap: 8px;
}
.export-btn {
  flex: 1;
  padding: 9px;
  border-radius: 8px;
  border: 1px solid rgba(120, 170, 255, 0.4);
  background: rgba(120, 170, 255, 0.18);
  color: #fff;
  cursor: pointer;
  font-size: 13px;
}
.export-btn:hover:not(:disabled) {
  background: rgba(120, 170, 255, 0.3);
}
.export-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.status {
  font-size: 12px;
  color: #9ad;
  min-height: 14px;
}
</style>
