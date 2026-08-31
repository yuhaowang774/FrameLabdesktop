<script setup lang="ts">
// 左栏「基础信息」面板：展示当前选中照片的文件信息与 EXIF 元数据（只读）。
// 数据来自 LibraryItem 上保存的解析结果（导入时读取），切换照片自动跟随。
import { computed } from 'vue'
import { useLibrary } from '../../composables/useLibrary'
import { cleanLens } from '../../composables/useExif'
import { modelAlias } from '../../core/modelAlias'

const library = useLibrary()

const activeItem = computed(() =>
  library.items.find((i) => i.id === library.activeId.value) ?? null,
)

// ===== 文件信息 =====
const fileName = computed(() => activeItem.value?.name ?? '')
const format = computed(() => {
  const n = fileName.value
  const dot = n.lastIndexOf('.')
  return dot >= 0 ? n.slice(dot + 1).toUpperCase() : '未知'
})
const dimension = computed(() => {
  const it = activeItem.value
  return it && it.width > 0 ? `${it.width} × ${it.height} px` : '—'
})
const fileSize = computed(() => {
  const s = activeItem.value?.size ?? 0
  if (s <= 0) return '—'
  if (s < 1024) return `${s} B`
  if (s < 1024 * 1024) return `${(s / 1024).toFixed(1)} KB`
  return `${(s / (1024 * 1024)).toFixed(2)} MB`
})

/** 镜头信息（EXIF LensMake+LensModel，清洗掉品牌前缀等冗余，如 "FE 50mm F1.8"；缺失则空） */
const lens = computed(() => {
  const r = exif.value?.raw
  if (!r) return ''
  return cleanLens(r.lensMake, r.lensModel) ?? ''
})

// ===== EXIF 元数据 =====
const exif = computed(() => activeItem.value?.exif ?? null)
const hasExif = computed(() => !!exif.value)
const focal = computed(() => (exif.value?.raw.focalLength != null ? `${exif.value.raw.focalLength} mm` : ''))
/** 35mm 等效焦距（EXIF FocalLengthIn35mmFilm，相机直出常自带） */
const focal35 = computed(() =>
  exif.value?.raw.focalLength35 != null ? `${exif.value.raw.focalLength35} mm` : '',
)
const aperture = computed(() => exif.value?.raw.fNumber != null ? `f/${exif.value.raw.fNumber}` : '')
const shutter = computed(() => {
  const t = exif.value?.raw.exposureTime
  if (t == null) return ''
  return t >= 1 ? `${t.toFixed(0)}s` : `1/${Math.round(1 / t)}s`
})
const iso = computed(() => exif.value?.raw.iso != null ? `ISO ${exif.value.raw.iso}` : '')

// 组装「焦距/光圈/快门/ISO」一行的可用片段
const paramsLine = computed(() => [focal.value, aperture.value, shutter.value, iso.value].filter(Boolean).join(' · '))

// ===== 分组展示模型：label + value（value 为空则整行隐藏） =====
const fileRows = computed(() => [
  { label: '文件名', value: fileName.value },
  { label: '格式', value: format.value },
  { label: '尺寸', value: dimension.value },
  { label: '文件大小', value: fileSize.value },
  { label: '镜头', value: lens.value },
])
const exifExplicit = computed(() => [
  { label: '相机品牌', value: exif.value?.make ?? '' },
  // 型号显示营销名（ILCE-6000 → α6000、FC3682 → DJI Mini 3）；已是营销名的原样显示
  { label: '相机型号', value: exif.value?.model ? modelAlias(exif.value.model) : '' },
  { label: '焦距', value: focal.value },
  { label: '等效焦距', value: focal35.value },
  { label: '光圈', value: aperture.value },
  { label: '快门', value: shutter.value },
  { label: 'ISO', value: iso.value },
  { label: '拍摄日期', value: exif.value?.raw.dateTimeOriginal ?? '' },
])
</script>

<template>
  <div class="media-info">
    <p v-if="!activeItem" class="hint">未选中照片</p>

    <template v-else>
      <h4 class="group">文件信息</h4>
      <dl class="info">
        <template v-for="row in fileRows" :key="row.label">
          <dt>{{ row.label }}</dt>
          <dd :title="row.value">{{ row.value || '—' }}</dd>
        </template>
      </dl>

      <h4 class="group">EXIF 元数据</h4>
      <template v-if="hasExif">
        <p v-if="paramsLine" class="params">{{ paramsLine }}</p>
        <dl class="info">
          <template v-for="row in exifExplicit" :key="row.label">
            <template v-if="row.value">
              <dt>{{ row.label }}</dt>
              <dd :title="row.value">{{ row.value }}</dd>
            </template>
          </template>
        </dl>
      </template>
      <p v-else class="hint">未识别到 EXIF 数据</p>
    </template>
  </div>
</template>

<style scoped>
.media-info {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.hint {
  color: var(--text-dim);
  font-size: 12px;
  font-weight: 400;
  line-height: 16px;
  margin: 0;
}
.group {
  margin: 2px 0 0;
  font-size: 11px;
  font-weight: 400;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0;
  line-height: 16px;
}
.info {
  display: grid;
  grid-template-columns: 74px 1fr;
  gap: 3px 8px;
  margin: 0;
  padding: 0;
}
.info dt {
  font-size: 11px;
  font-weight: 400;
  color: var(--text-dim);
  line-height: 16px;
}
.info dd {
  margin: 0;
  font-size: 12px;
  font-weight: 400;
  color: var(--text);
  line-height: 16px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.params {
  margin: 0;
  font-size: 12px;
  font-weight: 600;
  color: var(--text);
  line-height: 16px;
  word-break: break-all;
}
</style>