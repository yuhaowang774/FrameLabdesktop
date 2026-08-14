<script setup lang="ts">
// 品牌与参数控件：品牌 + 显示开关 + EXIF + 相机型号 + 间距 + 自定义 Logo
import { computed, ref } from 'vue'
import { useFrameConfig } from '../../composables/useFrameConfig'
import { parseExif } from '../../composables/useExif'
import { BRANDS, FONT_OPTIONS, RANGES, MAX_CUSTOM_LOGOS } from '../../core/constants'
import { useLogoStore, CUSTOM_PREFIX } from '../../composables/useLogoStore'
import RangeSlider from '../common/RangeSlider.vue'
import ToggleGroup from '../common/ToggleGroup.vue'
import GlassModal from '../common/GlassModal.vue'

const { state, patch } = useFrameConfig()
const r = RANGES
const { listCustomLogos, uploadCustomLogo, removeCustomLogo } = useLogoStore()

// 品牌选项（value=id, label=名称）；Logo 图在阶段8 useLogoStore 接入
const brandOptions = BRANDS.map((b) => ({ value: b.id, label: b.name }))
// 自定义 Logo 选项（value=`custom:<id>`）
const customLogos = ref(listCustomLogos())
const customBrandOptions = computed(() =>
  customLogos.value.map((c) => ({ value: `${CUSTOM_PREFIX}${c.id}`, label: c.name })),
)
function refreshCustom() {
  customLogos.value = listCustomLogos()
}

const fontOptions = FONT_OPTIONS.map((f) => ({ value: f.value, label: f.label }))
const showLogoOptions = [
  { value: 'true', label: '显示' },
  { value: 'false', label: '隐藏' },
]
const showExifOptions = [
  { value: 'true', label: '显示' },
  { value: 'false', label: '隐藏' },
]
const showModelOptions = [
  { value: 'true', label: '显示' },
  { value: 'false', label: '隐藏' },
]

const showLogo = computed({
  get: () => (state.showLogo ? 'true' : 'false'),
  set: (v) => patch({ showLogo: v === 'true' }),
})
const showExif = computed({
  get: () => (state.showExif ? 'true' : 'false'),
  set: (v) => patch({ showExif: v === 'true' }),
})
const showModel = computed({
  get: () => (state.showCameraModel ? 'true' : 'false'),
  set: (v) => patch({ showCameraModel: v === 'true' }),
})

// ===== 自定义 Logo 管理 =====
const logoInput = ref<HTMLInputElement | null>(null)
const uploading = ref(false)
const failOpen = ref(false)
const failMsg = ref('')
const atLimit = computed(() => customLogos.value.length >= MAX_CUSTOM_LOGOS)

function pickLogo() {
  if (atLimit.value) {
    failMsg.value = `自定义 Logo 已达上限（${MAX_CUSTOM_LOGOS} 个）`
    failOpen.value = true
    return
  }
  logoInput.value?.click()
}

async function onLogoFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  uploading.value = true
  try {
    const id = await uploadCustomLogo(file)
    refreshCustom()
    patch({ brand: `${CUSTOM_PREFIX}${id}`, showLogo: true })
  } catch (err) {
    failMsg.value = (err as Error).message || '上传失败'
    failOpen.value = true
  } finally {
    uploading.value = false
    input.value = ''
  }
}

async function onDeleteCustom(id: string) {
  await removeCustomLogo(id)
  if (state.brand === `${CUSTOM_PREFIX}${id}`) {
    patch({ brand: BRANDS[0].id })
  }
  refreshCustom()
}

// EXIF 识别
const exifInput = ref<HTMLInputElement | null>(null)
const recognizing = ref(false)
const exifFailOpen = ref(false)
const exifFailMsg = ref('')

function pickExifImage() {
  exifInput.value?.click()
}

async function onExifFile(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  recognizing.value = true
  try {
    const res = await parseExif(file)
    patch({ exifText: res.text, showExif: true })
  } catch (err) {
    exifFailMsg.value = (err as Error).message || 'EXIF 读取失败'
    exifFailOpen.value = true
  } finally {
    recognizing.value = false
    input.value = ''
  }
}
</script>

<template>
  <section class="control-block">
    <h4>品牌与参数</h4>

    <div class="field">
      <label>品牌</label>
      <select v-model="state.brand" class="select">
        <option v-for="o in brandOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
        <optgroup v-if="customBrandOptions.length" label="自定义">
          <option v-for="o in customBrandOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
        </optgroup>
      </select>
    </div>

    <ToggleGroup v-model="showLogo" :options="showLogoOptions" label="Logo" />
    <RangeSlider v-model="state.logoSize" :min="r.logoSize.min" :max="r.logoSize.max" :step="r.logoSize.step" label="Logo 大小" suffix="px" />
    <RangeSlider v-model="state.logoOpacity" :min="r.logoOpacity.min" :max="r.logoOpacity.max" :step="r.logoOpacity.step" label="Logo 透明度" />

    <!-- 自定义 Logo：上传 + 列表（缩略图 / 选择 / 删除） -->
    <div class="custom-logo">
      <button class="logo-btn" :disabled="uploading || atLimit" @click="pickLogo">
        {{ uploading ? '上传中…' : atLimit ? `已达上限 ${MAX_CUSTOM_LOGOS}` : '+ 上传自定义 Logo' }}
      </button>
      <ul v-if="customLogos.length" class="logo-list">
        <li v-for="c in customLogos" :key="c.id" :class="{ active: state.brand === CUSTOM_PREFIX + c.id }">
          <button class="logo-thumb" :title="c.name" @click="patch({ brand: CUSTOM_PREFIX + c.id, showLogo: true })">
            <img :src="c.dataURL" :alt="c.name" />
          </button>
          <span class="logo-name" :title="c.name">{{ c.name }}</span>
          <button class="logo-del" title="删除" @click="onDeleteCustom(c.id)">×</button>
        </li>
      </ul>
      <p v-else class="logo-hint">暂无自定义 Logo，上传后可用作品牌标识（上限 {{ MAX_CUSTOM_LOGOS }} 个）。</p>
    </div>

    <ToggleGroup v-model="showModel" :options="showModelOptions" label="相机型号" />
    <input v-model="state.cameraModel" class="text-input" placeholder="相机型号，如 A7R V" />
    <RangeSlider v-model="state.cameraModelSize" :min="r.cameraModelSize.min" :max="r.cameraModelSize.max" :step="r.cameraModelSize.step" label="型号字号" suffix="px" />
    <RangeSlider v-model="state.cameraModelGap" :min="r.cameraModelGap.min" :max="r.cameraModelGap.max" :step="r.cameraModelGap.step" label="型号距 Logo" suffix="px" />

    <div class="exif-head">
      <ToggleGroup v-model="showExif" :options="showExifOptions" label="EXIF 参数" />
      <button class="exif-btn" :disabled="recognizing" @click="pickExifImage">
        {{ recognizing ? '识别中…' : '识别 Exif' }}
      </button>
    </div>
    <input v-model="state.exifText" class="text-input" placeholder="如 200mm f/4 1/800s ISO400" />
    <div class="field">
      <label>字体</label>
      <select v-model="state.fontFamily" class="select">
        <option v-for="o in fontOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
      </select>
    </div>
    <RangeSlider v-model="state.fontSize" :min="r.fontSize.min" :max="r.fontSize.max" :step="r.fontSize.step" label="EXIF 字号" suffix="px" />
    <RangeSlider v-model="state.textWeight" :min="r.textWeight.min" :max="r.textWeight.max" :step="r.textWeight.step" label="EXIF 粗细" />
    <RangeSlider v-model="state.textOpacity" :min="r.textOpacity.min" :max="r.textOpacity.max" :step="r.textOpacity.step" label="EXIF 透明度" />

    <h4>间距</h4>
    <RangeSlider v-model="state.distPhotoLogo" :min="r.distPhotoLogo.min" :max="r.distPhotoLogo.max" :step="r.distPhotoLogo.step" label="Logo 距原图" suffix="px" />
    <RangeSlider v-model="state.distLogoText" :min="r.distLogoText.min" :max="r.distLogoText.max" :step="r.distLogoText.step" label="参数距 Logo" suffix="px" />
    <RangeSlider v-model="state.distBottom" :min="r.distBottom.min" :max="r.distBottom.max" :step="r.distBottom.step" label="参数距底边" suffix="px" />

    <input ref="logoInput" type="file" accept="image/*" @change="onLogoFile" hidden />
    <input ref="exifInput" type="file" accept="image/*" @change="onExifFile" hidden />
    <GlassModal
      v-model="failOpen"
      title="自定义 Logo"
      :message="failMsg"
      :show-cancel="false"
      confirm-text="知道了"
    />
    <GlassModal
      v-model="exifFailOpen"
      title="EXIF 识别失败"
      :message="exifFailMsg + '，可手动填写 EXIF 文本。'"
      :show-cancel="false"
      confirm-text="知道了"
    />
  </section>
</template>

<style scoped>
.control-block {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
h4 {
  font-size: 13px;
  color: #aaa;
  margin: 4px 0 2px;
}
.field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  font-size: 13px;
  color: #ccc;
}
.select,
.text-input {
  width: 100%;
  padding: 7px 9px;
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(0, 0, 0, 0.3);
  color: #fff;
  font-size: 13px;
}
.select {
  width: 60%;
}
.custom-logo {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
  border-radius: 10px;
  border: 1px dashed rgba(255, 255, 255, 0.2);
}
.logo-btn {
  padding: 7px 10px;
  border-radius: 8px;
  border: 1px solid rgba(120, 170, 255, 0.4);
  background: rgba(120, 170, 255, 0.18);
  color: #fff;
  cursor: pointer;
  font-size: 12px;
}
.logo-btn:disabled {
  opacity: 0.5;
  cursor: default;
}
.logo-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin: 0;
  padding: 0;
}
.logo-list li {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  padding: 4px 6px;
}
.logo-list li.active {
  outline: 1px solid rgba(120, 170, 255, 0.9);
  background: rgba(120, 170, 255, 0.14);
}
.logo-thumb {
  flex-shrink: 0;
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.1);
  cursor: pointer;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}
.logo-thumb img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}
.logo-name {
  flex: 1;
  font-size: 12px;
  color: #ddd;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.logo-del {
  flex-shrink: 0;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 6px;
  background: rgba(255, 90, 90, 0.2);
  color: #ff9a9a;
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
}
.logo-hint {
  font-size: 11px;
  color: #888;
  margin: 0;
  line-height: 1.4;
}
.exif-head {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 8px;
}
.exif-btn {
  flex-shrink: 0;
  padding: 7px 12px;
  border-radius: 8px;
  border: 1px solid rgba(120, 170, 255, 0.4);
  background: rgba(120, 170, 255, 0.18);
  color: #fff;
  cursor: pointer;
  font-size: 12px;
  margin-bottom: 6px;
}
.exif-btn:disabled {
  opacity: 0.5;
  cursor: default;
}
</style>
