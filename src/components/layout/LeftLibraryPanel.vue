<script setup lang="ts">
// 左侧面板："我的素材"。从素材库选取/进入编辑。
import { useLibrary } from '../../composables/useLibrary'
import { useAppState } from '../../composables/useAppState'

const library = useLibrary()
const app = useAppState()

function enter(item: { id: string }) {
  library.select(item.id)
  app.setModule('develop')
}
</script>

<template>
  <div class="left-lib">
    <p v-if="library.items.length === 0" class="hint">图库为空，请到「图库」模块导入照片。</p>
    <div class="thumbs">
      <button
        v-for="item in library.items"
        :key="item.id"
        class="thumb"
        :class="{ active: item.id === library.activeId.value }"
        :title="item.name"
        @click="enter(item)"
      >
        <img :src="item.thumbUrl || item.url" :alt="item.name" loading="lazy" />
        <span class="tname">{{ item.name }}</span>
      </button>
    </div>
    <button
      v-if="library.items.length"
      class="link"
      @click="app.setModule('library')"
    >管理全部素材 →</button>
  </div>
</template>

<style scoped>
.left-lib {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.hint {
  color: var(--text-dim);
  font-size: 12px;
  line-height: 1.5;
}
.thumbs {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}
.thumb {
  border: 2px solid transparent;
  border-radius: 8px;
  overflow: hidden;
  background: var(--panel-2);
  padding: 0;
  cursor: pointer;
  text-align: left;
}
.thumb.active {
  border-color: var(--accent);
}
.thumb img {
  width: 100%;
  height: 64px;
  object-fit: cover;
  display: block;
  background: var(--checker);
}
.tname {
  display: block;
  font-size: 10px;
  color: var(--text-dim);
  padding: 3px 5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.link {
  background: none;
  border: none;
  color: var(--accent);
  cursor: pointer;
  font-size: 12px;
  text-align: left;
  padding: 2px 0;
}
</style>
