<script setup lang="ts">
// 底部信息预览：brand-container + model + exif，全部由 CSS 变量驱动
import { computed } from 'vue'
import { useFrameConfig } from '../../composables/useFrameConfig'
import { resolveLogoDataURL } from '../../composables/useLogoStore'

const { state } = useFrameConfig()

const brandName = computed(
  () => state.brand,
)

// 主题切换时 Logo 自动换色（暗白双版），由 useLogoStore 缓存保证性能
const logoSrc = computed(() =>
  state.showLogo ? resolveLogoDataURL(state.brand, state.theme) : '',
)
</script>

<template>
  <div
    class="footer-info"
    :class="{ overlay: state.bgMode === 'none' }"
    :style="state.bgMode === 'none'
      ? { justifyContent: state.overlayAlign === 'left' ? 'flex-start' : state.overlayAlign === 'center' ? 'center' : 'flex-end', bottom: state.overlayBottom + 'px' }
      : {}"
  >
    <div class="brand-container" :style="{ display: 'var(--logo-display)', gap: 'var(--dist-logo-text)' }">
      <!-- 阶段8：品牌 Logo 由 useLogoStore 矢量自绘（暗白双版），替代文字占位 -->
      <img
        v-if="state.showLogo && logoSrc"
        class="brand-logo"
        :src="logoSrc"
        :alt="brandName"
        :style="{ height: 'var(--logo-size)', opacity: 'var(--logo-opacity)' }"
      />
      <span
        class="camera-model"
        v-if="state.showCameraModel"
        :style="{
          display: 'var(--camera-model-display)',
          font: 'var(--camera-model-italic) var(--camera-model-weight) var(--camera-model-size)/1 var(--camera-model-font-family)',
          opacity: 'var(--camera-model-opacity)',
          marginLeft: 'var(--camera-model-gap)',
          transform: 'translate(var(--camera-model-offset-x), var(--camera-model-offset-y))',
        }"
        >{{ state.cameraModel }}</span
      >
    </div>
    <div
      class="exif-text"
      v-if="state.showExif"
      :style="{
        display: 'var(--exif-display)',
        font: 'var(--text-weight) var(--font-size)/1 var(--font-family)',
        opacity: 'var(--text-opacity)',
        marginLeft: 'var(--dist-photo-logo)',
        color: 'var(--footer-text-color)',
      }"
    >
      {{ state.exifText }}
    </div>
  </div>
</template>

<style scoped>
.footer-info {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--dist-photo-logo);
  margin-top: calc(var(--frame-padding) * 0.3);
  color: var(--footer-text-color);
  font-family: var(--font-family);
}
.footer-info.overlay {
  position: absolute;
  left: var(--frame-padding);
  right: var(--frame-padding);
  display: flex;
  flex-direction: row;
  align-items: flex-end;
}
.brand-container {
  display: flex;
  align-items: center;
}
.brand-logo {
  display: block;
  object-fit: contain;
  width: auto;
  filter: drop-shadow(0 1px 1px rgba(0, 0, 0, 0.25));
}
.exif-text {
  color: var(--footer-text-color);
}
</style>
