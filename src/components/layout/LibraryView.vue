<script setup lang="ts">
// 图库模块：网格缩略图管理素材，支持拖拽/点击上传、多选、删除，点击进编辑。
// 桌面端（Tauri）额外提供「打开本地文件夹」：扫描磁盘目录引用原图，不拷贝。
import { ref, computed } from 'vue'
import { useLibrary } from '../../composables/useLibrary'
import { useAppState } from '../../composables/useAppState'
import { isTauri } from '../../platform/env'

const library = useLibrary()
const app = useAppState()

const dragOver = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
/** 桌面端：当前打开的本地文件夹路径（展示用） */
const folderLabel = ref('')

const selectedCount = computed(() => library.items.filter((i) => i.selected).length)

function onPick(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files) {
    // addFiles 内部已完成 EXIF 识别与历史 Import 节点建立
    void library.addFiles(Array.from(input.files))
  }
  input.value = ''
}

function onDrop(e: DragEvent) {
  dragOver.value = false
  if (e.dataTransfer?.files) {
    void library.addFiles(Array.from(e.dataTransfer.files))
  }
}

/** 桌面端：选择本地文件夹 → 扫描图片 → 以磁盘路径引用加入图库 */
async function openFolder() {
  const { pickImageFolder, loadFolderIntoLibrary } = await import('../../platform/fs')
  const r = await pickImageFolder()
  if (!r || !r.images.length) return
  await loadFolderIntoLibrary(r)
  folderLabel.value = r.folder
}

function onItemClick(item: { id: string }, e: MouseEvent) {
  if (e.shiftKey || e.metaKey || e.ctrlKey) {
    library.toggleSelect(item.id)
  } else {
    library.items.forEach((i) => (i.selected = false))
    library.select(item.id)
  }
}

function enterDevelop(item: { id: string }) {
  library.select(item.id)
  app.setModule('develop')
}
</script>

<template>
  <div class="library-view">
    <div
      class="dropzone"
      :class="{ over: dragOver }"
      @dragover.prevent="dragOver = true"
      @dragleave.prevent="dragOver = false"
      @drop.prevent="onDrop"
    >
      <div v-if="library.items.length === 0" class="empty">
        <div class="empty-icon">🖼️</div>
        <h2>图库</h2>
        <p>拖拽照片到此处，或点击导入</p>
        <div class="empty-actions">
          <button class="btn-primary" @click="fileInput?.click()">导入照片</button>
          <button v-if="isTauri" class="btn-primary ghost" @click="openFolder">打开本地文件夹</button>
        </div>
        <input ref="fileInput" type="file" accept="image/*" multiple hidden @change="onPick" />
      </div>

      <template v-else>
        <div class="lib-toolbar">
          <button class="btn" @click="fileInput?.click()">＋ 导入</button>
          <button v-if="isTauri" class="btn" @click="openFolder">📂 打开文件夹</button>
          <span v-if="isTauri && folderLabel" class="folder" :title="folderLabel">{{ folderLabel }}</span>
          <span class="count">共 {{ library.items.length }} 张 · 已选 {{ selectedCount }}</span>
          <span class="spacer" />
          <button class="btn" :disabled="!selectedCount" @click="library.removeSelected()">删除选中</button>
          <button class="btn" @click="library.clearAll()">清空</button>
          <input ref="fileInput" type="file" accept="image/*" multiple hidden @change="onPick" />
        </div>

        <div class="grid">
          <div
            v-for="item in library.items"
            :key="item.id"
            class="cell"
            :class="{ selected: item.selected, active: item.id === library.activeId.value }"
            @click="onItemClick(item, $event)"
            @dblclick="enterDevelop(item)"
          >
            <img :src="item.thumbUrl || item.url" :alt="item.name" loading="lazy" />
            <div class="meta">
              <span class="name">{{ item.name }}</span>
              <span class="dim">{{ item.width }}×{{ item.height }}</span>
            </div>
            <button class="enter" title="进入编辑" @click.stop="enterDevelop(item)">编辑 ✎</button>
          </div>
        </div>
      </template>
    </div>
  </div>
</template>

<style scoped>
.library-view {
  height: 100%;
  /* 撑满父容器（.body 为 flex 行布局，flex item 默认宽度随内容收缩），
     否则空状态提示无法在整页居中 */
  flex: 1;
  width: 100%;
  display: flex;
  flex-direction: column;
}
.dropzone {
  flex: 1;
  overflow: auto;
  padding: 16px;
  border: 2px dashed transparent;
  transition: border-color 0.15s, background 0.15s;
}
.dropzone.over {
  border-color: var(--accent);
  background: color-mix(in srgb, var(--accent) 8%, transparent);
}
.empty {
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--text-dim);
}
.empty-icon {
  font-size: 56px;
}
.btn-primary {
  margin-top: 8px;
  background: var(--accent);
  color: #fff;
  border: none;
  border-radius: 8px;
  padding: 10px 20px;
  font-size: 14px;
  cursor: pointer;
}
.empty-actions {
  display: flex;
  gap: 10px;
  margin-top: 8px;
}
.btn-primary.ghost {
  background: transparent;
  color: var(--text);
  border: 1px solid var(--border);
}
.folder {
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  color: var(--text-dim);
  font-size: 11px;
  font-weight: 400;
  line-height: 16px;
}
.lib-toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 14px;
  flex-wrap: wrap;
}
.spacer {
  flex: 1;
}
.count {
  color: var(--text-dim);
  font-size: 12px;
  font-weight: 400;
  line-height: 16px;
}
.btn {
  background: var(--panel-2);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 0;
  padding: 0 14px;
  height: 22px;
  cursor: pointer;
  font-size: 12px;
  font-weight: 400;
  line-height: 16px;
}
.btn:hover { background: var(--hover); color: var(--text-normal); }
.btn:active { background: var(--pressed); }
.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 8px;
}
.cell {
  position: relative;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 0;
  overflow: hidden;
  cursor: pointer;
}
.cell:hover {
  background: var(--hover);
  border-color: var(--border);
}
.cell.selected {
  background: var(--accent);
  border-color: var(--accent);
}
.cell img {
  width: 100%;
  height: 110px;
  object-fit: cover;
  display: block;
  background: var(--canvas-empty);
}
.meta {
  display: flex;
  justify-content: space-between;
  padding: 0 8px;
  height: 22px;
  align-items: center;
  font-size: 12px;
  font-weight: 400;
  color: var(--text-dim);
  line-height: 16px;
}
.meta .name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 65%;
}
.enter {
  position: absolute;
  top: 4px;
  right: 4px;
  background: var(--shell);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 0;
  padding: 0 6px;
  height: 18px;
  font-size: 11px;
  font-weight: 400;
  line-height: 14px;
  cursor: pointer;
  opacity: 0;
}
.enter:hover { background: var(--hover); }
.cell:hover .enter {
  opacity: 1;
}
</style>
