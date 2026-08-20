<script setup lang="ts">
// 图库模块（对标 LrC Library）：网格缩略图管理素材，支持拖拽/点击上传、多选、删除，点击进编辑。
// 桌面端（Tauri）：支持直接浏览本地磁盘文件夹（只引用路径，不拷贝原图）。
import { ref, computed } from 'vue'
import { useLibrary } from '../../composables/useLibrary'
import { useAppState } from '../../composables/useAppState'
import { isTauri } from '../../platform/env'
import { pickImageFolder, loadFolderIntoLibrary } from '../../platform/fs'

const library = useLibrary()
const app = useAppState()

const dragOver = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const openingFolder = ref(false)
const folderLabel = ref('')

const selectedCount = computed(() => library.items.filter((i) => i.selected).length)

function onPick(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files) library.addFiles(Array.from(input.files))
  input.value = ''
}

function onDrop(e: DragEvent) {
  dragOver.value = false
  if (e.dataTransfer?.files) library.addFiles(Array.from(e.dataTransfer.files))
}

/** 桌面端：选择本地文件夹 → 递归扫描图片加入图库 */
async function openLocalFolder() {
  if (openingFolder.value) return
  openingFolder.value = true
  try {
    const result = await pickImageFolder()
    if (result && result.images.length) {
      await loadFolderIntoLibrary(result)
      folderLabel.value = `${result.folder}（${result.images.length} 张）`
    }
  } finally {
    openingFolder.value = false
  }
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
        <p>{{ isTauri ? '打开本地图片文件夹，或拖拽照片到此处' : '拖拽照片到此处，或点击导入' }}</p>
        <div class="empty-actions">
          <button v-if="isTauri" class="btn-primary" :disabled="openingFolder" @click="openLocalFolder">
            {{ openingFolder ? '扫描中…' : '打开本地文件夹' }}
          </button>
          <button class="btn-primary" @click="fileInput?.click()">导入照片</button>
        </div>
        <input ref="fileInput" type="file" accept="image/*" multiple hidden @change="onPick" />
      </div>

      <template v-else>
        <div class="lib-toolbar">
          <button v-if="isTauri" class="btn" :disabled="openingFolder" @click="openLocalFolder">
            {{ openingFolder ? '扫描中…' : '📂 打开文件夹' }}
          </button>
          <button class="btn" @click="fileInput?.click()">＋ 导入</button>
          <span class="count">共 {{ library.items.length }} 张 · 已选 {{ selectedCount }}</span>
          <span v-if="isTauri && folderLabel" class="count folder-label" :title="folderLabel">{{ folderLabel }}</span>
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
            <img :src="item.url" :alt="item.name" loading="lazy" />
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
.btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.empty-actions {
  display: flex;
  gap: 10px;
}
.folder-label {
  max-width: 240px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
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
  font-size: 13px;
}
.btn {
  background: var(--panel-2);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 7px;
  padding: 7px 14px;
  cursor: pointer;
  font-size: 13px;
}
.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 14px;
}
.cell {
  position: relative;
  background: var(--panel-2);
  border: 2px solid transparent;
  border-radius: 10px;
  overflow: hidden;
  cursor: pointer;
  transition: border-color 0.12s, transform 0.12s;
}
.cell:hover {
  transform: translateY(-2px);
}
.cell.selected {
  border-color: var(--accent);
}
.cell.active {
  box-shadow: 0 0 0 2px var(--accent) inset;
}
.cell img {
  width: 100%;
  height: 150px;
  object-fit: cover;
  display: block;
  background: var(--checker);
}
.meta {
  display: flex;
  justify-content: space-between;
  padding: 8px 10px;
  font-size: 12px;
  color: var(--text-dim);
}
.meta .name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  max-width: 65%;
}
.enter {
  position: absolute;
  top: 8px;
  right: 8px;
  background: rgba(0, 0, 0, 0.6);
  color: #fff;
  border: none;
  border-radius: 6px;
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
  opacity: 0;
  transition: opacity 0.12s;
}
.cell:hover .enter {
  opacity: 1;
}
</style>
