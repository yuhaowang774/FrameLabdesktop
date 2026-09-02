<script setup lang="ts">
// FrameLab 线性图标：12×12 viewBox / 1.4 描边 / currentColor / 无填充
// 通过 name 选择预设图标，颜色随父元素 color 变化
defineProps<{ name: string }>()
</script>

<template>
  <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <!-- photo: 照片（山形 + 圆日） -->
    <g v-if="name === 'photo'">
      <rect x="2" y="3.5" width="12" height="9" rx="0.5" />
      <path d="M2 10l3-2.5 3 2 2-1.5 4 3" />
      <circle cx="11" cy="6.5" r="1" />
    </g>
    <!-- background: 棋盘格 + 纯色叠加（背景模式） -->
    <g v-else-if="name === 'background'">
      <rect x="2" y="2" width="12" height="12" />
      <path d="M2 6h4v4H2zM10 2v4h4M2 14v-4h4M14 6v4h-4M10 14v-4h-4" />
    </g>
    <!-- border: 内嵌矩形表示相框 -->
    <g v-else-if="name === 'border'">
      <rect x="2" y="2" width="12" height="12" />
      <rect x="5" y="5" width="6" height="6" />
    </g>
    <!-- info: i 字符 -->
    <g v-else-if="name === 'info'">
      <circle cx="8" cy="8" r="6" />
      <circle cx="8" cy="5.4" r="0.6" fill="currentColor" stroke="none" />
      <path d="M8 7.2v4.3" />
    </g>
    <!-- camera-brand: 相机机身 -->
    <g v-else-if="name === 'brand'">
      <rect x="2" y="5" width="12" height="8" rx="0.5" />
      <path d="M6 5l1-1.5h2L10 5" />
      <circle cx="8" cy="9" r="1.6" />
    </g>
    <!-- camera-model: T 字徽标 -->
    <g v-else-if="name === 'model'">
      <rect x="2.5" y="3" width="11" height="10" rx="0.5" />
      <path d="M5 6h6M8 6v5" />
    </g>
    <!-- exif: 数值/刻度 -->
    <g v-else-if="name === 'exif'">
      <path d="M3 4v8M7 4v8M11 4v8" />
      <path d="M3 4h1M7 4h1M11 4h1M3 12h1M7 12h1M11 12h1" />
    </g>
    <!-- reset: 环形箭头 -->
    <g v-else-if="name === 'reset'">
      <path d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9" />
      <path d="M13.5 2v2.5H11" />
    </g>
    <!-- collapse-all: 双上箭头 -->
    <g v-else-if="name === 'collapse'">
      <path d="M3 10l5-5 5 5" />
      <path d="M3 13l5-5 5 5" />
    </g>
    <!-- expand-all: 双下箭头 -->
    <g v-else-if="name === 'expand'">
      <path d="M3 6l5 5 5-5" />
      <path d="M3 3l5 5 5-5" />
    </g>
    <!-- folder: 文件夹 -->
    <g v-else-if="name === 'folder'">
      <path d="M2 12.5v-8a.5.5 0 0 1 .5-.5H6l1.2 1.5h6.3a.5.5 0 0 1 .5.5v6.5a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5z" />
    </g>
  </svg>
</template>
