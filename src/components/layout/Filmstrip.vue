<script setup lang="ts">
// 底部胶片窗格 Filmstrip：跨模块缩略图，点击切换/进入编辑。
// 支持顶部拖拽调整高度（上推增高），高度/可见性由 useAppState 统一管理。
import { useLibrary } from '../../composables/useLibrary'
import { useAppState } from '../../composables/useAppState'

const library = useLibrary()
const app = useAppState()

// 点击交互：
//  - 普通点击：单选并切换主图（图库模块下进入编辑）
//  - Ctrl/⌘+点击：切换选中状态（不切换主图、不跳转模块）
//  - Shift+点击：从锚点到目标项范围多选
function onItem(id: string, e: MouseEvent) {
  if (e.metaKey || e.ctrlKey) {
    library.toggleSelect(id)
    return
  }
  if (e.shiftKey) {
    library.rangeSelect(id)
  } else {
    library.select(id)
  }
  if (app.activeModule.value === 'library') app.setModule('develop')
}

// ===== 顶部拖拽调整高度 =====
let startY = 0
let startH = 0
function onHandleDown(e: PointerEvent) {
  startY = e.clientY
  startH = app.state.filmstripHeight
  window.addEventListener('pointermove', onHandleMove)
  window.addEventListener('pointerup', onHandleUp)
  e.preventDefault()
}
function onHandleMove(e: PointerEvent) {
  // 向上拖拽（clientY 减小）→ 高度增加
  app.setFilmstripHeight(startH + (startY - e.clientY))
}
function onHandleUp() {
  window.removeEventListener('pointermove', onHandleMove)
  window.removeEventListener('pointerup', onHandleUp)
}
</script>

<template>
  <div class="filmstrip" :style="{ height: app.filmstripHeightPx.value }">
    <div class="resize-handle" title="拖拽调整胶片条高度" @pointerdown="onHandleDown" />
    <div v-if="library.items.length === 0" class="empty">导入照片后这里将显示胶片条</div>
    <div v-else class="track">
      <button
        v-for="item in library.items"
        :key="item.id"
        class="frame"
        :class="{ active: item.id === library.activeId.value, sel: item.selected }"
        :title="`${item.name}${item.selected ? '（已选中）' : ''}`"
        @click="onItem(item.id, $event)"
      >
        <img :src="item.thumbUrl || item.url" :alt="item.name" loading="lazy" />
        <span v-if="item.selected" class="sel-dot" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.filmstrip {
  position: relative;
  flex: none;
  background: var(--panel);
  border-top: 1px solid var(--border);
  display: flex;
  align-items: stretch;
  overflow: hidden;
}
.resize-handle {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 5px;
  cursor: ns-resize;
  z-index: 3;
  background: transparent;
}
.resize-handle:hover {
  background: var(--hover);
}
.empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-dim);
  font-size: 12px;
  font-weight: 400;
  line-height: 16px;
}
.track {
  display: flex;
  gap: 6px;
  padding: 0 12px;
  height: 100%;
  overflow-x: auto;
  overflow-y: hidden;
  align-items: center;
  width: 100%;
}
.frame {
  position: relative;
  flex: none;
  width: 72px;
  height: calc(100% - 12px);
  max-height: 60px;
  min-height: 28px;
  border-radius: 0;
  overflow: hidden;
  border: 1px solid var(--border);
  background: var(--canvas-empty);
  padding: 0;
  cursor: pointer;
}
.frame:hover { background: var(--hover); }
.frame.active {
  border-color: var(--text);
  background: var(--accent);
}
.frame.sel {
  border-color: var(--accent);
  box-shadow: inset 0 0 0 1px var(--accent);
}
.frame.sel.active {
  border-color: var(--text);
  box-shadow: inset 0 0 0 1px var(--accent);
}
.frame img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.sel-dot {
  position: absolute;
  top: 3px;
  right: 3px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--text);
}
</style>
