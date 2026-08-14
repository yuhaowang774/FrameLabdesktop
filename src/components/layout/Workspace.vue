<script setup lang="ts">
// 右栏工作区：承载预览容器，fitPreview 缩放（上限 1.0），棋盘格透明预览区
import { ref, onMounted, computed } from 'vue'
import FrameContainer from '../preview/FrameContainer.vue'
import { useFrameConfig } from '../../composables/useFrameConfig'

const props = defineProps<{
  photoSrc: string | null
  bgImage: HTMLImageElement | null
}>()

const { state } = useFrameConfig()
const stage = ref<HTMLElement | null>(null)
const fitScale = ref(1)

function fit() {
  const el = stage.value
  if (!el) return
  const avail = el.clientWidth - 48
  fitScale.value = Math.min(1, avail / 1200)
}
onMounted(() => {
  fit()
  window.addEventListener('resize', fit)
})

const bgImageForCanvas = computed(() =>
  state.bgMode === 'custom' ? props.bgImage : props.bgImage,
)
</script>

<template>
  <section class="workspace">
    <div class="stage" ref="stage">
      <div
        class="fit-wrap"
        :style="{ transform: `scale(${fitScale})`, transformOrigin: 'top center' }"
      >
        <FrameContainer :photo-src="photoSrc" :bg-image="bgImageForCanvas" />
      </div>
    </div>
  </section>
</template>

<style scoped>
.workspace {
  flex: 1;
  display: flex;
  min-width: 0;
  background: #050505;
}
body.theme-light .workspace {
  background: #d8d8dc;
}
.stage {
  flex: 1;
  overflow: auto;
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 24px;
  background-color: #1a1a1a;
  background-image: linear-gradient(45deg, #2a2a2a 25%, transparent 25%),
    linear-gradient(-45deg, #2a2a2a 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #2a2a2a 75%),
    linear-gradient(-45deg, transparent 75%, #2a2a2a 75%);
  background-size: 24px 24px;
  background-position: 0 0, 0 12px, 12px -12px, -12px 0;
}
body.theme-light .stage {
  background-color: #cfcfd4;
  background-image: linear-gradient(45deg, #bdbdc2 25%, transparent 25%),
    linear-gradient(-45deg, #bdbdc2 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #bdbdc2 75%),
    linear-gradient(-45deg, transparent 75%, #bdbdc2 75%);
}
.fit-wrap {
  width: 1200px;
}
</style>
