<script setup lang="ts">
// 1200px 边框容器：CSS 变量驱动布局，组合背景/主照片/底部信息
import { computed } from 'vue'
import BgCanvas from './BgCanvas.vue'
import MainPhoto from './MainPhoto.vue'
import FooterInfo from './FooterInfo.vue'
import { useFrameConfig } from '../../composables/useFrameConfig'

const props = defineProps<{
  /** 主照片 src（dataURL 或 objectURL） */
  photoSrc: string | null
  /** 背景图元素（原图或自定义图），供 BgCanvas 绘制 */
  bgImage: HTMLImageElement | HTMLCanvasElement | null
}>()

const { state } = useFrameConfig()
const bgBlur = computed(() => state.blur)
</script>

<template>
  <div class="frame-container">
    <BgCanvas :image="bgImage" :blur="bgBlur" class="bg-layer" />
    <div class="content">
      <MainPhoto :src="photoSrc" />
      <FooterInfo />
    </div>
  </div>
</template>

<style scoped>
.frame-container {
  position: relative;
  width: 1200px;
  max-width: 100%;
  padding: var(--frame-padding);
  border-radius: calc(var(--border-radius) + 8px);
  overflow: hidden;
  background: #0a0a0a;
}
.bg-layer {
  z-index: 0;
}
.content {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
}
</style>
