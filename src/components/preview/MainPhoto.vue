<script setup lang="ts">
// 主照片容器：宽高由 CSS 变量驱动（scale%），圆角/阴影由 CSS 变量驱动
import { ref, watch } from 'vue'

const props = defineProps<{
  src: string | null
}>()

const failed = ref(false)

// 阶段 15：主图加载失败时显示占位提示，并随 src 变化重置
watch(
  () => props.src,
  () => {
    failed.value = false
  }
)
</script>

<template>
  <div class="main-photo" :class="{ hidden: !src }">
    <img
      v-if="src"
      :src="src"
      alt="主照片"
      @error="failed = true"
    />
    <div v-if="src && failed" class="img-error">图片加载失败，请重新上传</div>
  </div>
</template>

<style scoped>
.main-photo {
  position: relative;
  width: var(--img-scale);
  margin: 0 auto;
  border-radius: var(--border-radius);
  overflow: hidden;
  box-shadow: 0 calc(10px * var(--shadow-opacity)) calc(40px * var(--shadow-opacity))
    rgba(0, 0, 0, calc(0.5 * var(--shadow-opacity)));
  background: #111;
}
.main-photo.hidden {
  display: none;
}
.main-photo img {
  display: block;
  width: 100%;
  height: auto;
  border-radius: var(--border-radius);
}
.img-error {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #ff8a8a;
  font-size: 14px;
  background: rgba(40, 0, 0, 0.4);
  border-radius: var(--border-radius);
}
</style>
