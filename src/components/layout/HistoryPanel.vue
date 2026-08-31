<script setup lang="ts">
// 左侧"修改历史记录"面板：
//  - 每张照片独立一条历史链表，底部固定 Import（"导入"）节点，顶部最新；
//  - 点击节点 → 跳转（参数替换为该节点完整快照）；悬浮节点 → 导航预览（不改实际参数）；
//  - 右键菜单：复制为 Before / 创建快照 / 重命名 / 清除以上历史（仅当前步骤可用）；
//  - 底部：Clear All（清空该照片历史，不改当前参数）+ 快照列表（恢复/删除）。
import { ref, computed, nextTick } from 'vue'
import { useHistory } from '../../composables/useHistory'
import { useLibrary } from '../../composables/useLibrary'

const history = useHistory()
const library = useLibrary()

const activePhoto = computed(() => library.items.find((i) => i.id === library.activeId.value))

// 链表 index 0 = Import（底部最早），末位 = 最新（顶部）。显示时反转：顶部最新在上。
const list = computed(() =>
  history.records.value
    .map((r, i) => ({ ...r, index: i }))
    .slice()
    .reverse(),
)

const snapshots = computed(() =>
  activePhoto.value ? history.listSnapshots(activePhoto.value.id) : [],
)

function onJump(r: { index: number }) {
  if (!activePhoto.value) return
  history.jumpTo(activePhoto.value.id, r.index)
}

// ===== 悬浮预览 =====
function onEnter(node: unknown) {
  history.setPreview(node as Parameters<typeof history.setPreview>[0])
}
function onLeave() {
  history.setPreview(null)
}

// ===== 右键菜单 =====
const menu = ref<{ x: number; y: number; index: number } | null>(null)
function openMenu(e: MouseEvent, index: number) {
  e.preventDefault()
  menu.value = { x: e.clientX, y: e.clientY, index }
}
function closeMenu() {
  menu.value = null
}
/** 仅当右键的是"当前步骤"时允许清除以上历史（保证不修改图片参数） */
const canClearAbove = computed(() =>
  menu.value != null && history.cursor.value === menu.value.index,
)

function menuCopyToBefore() {
  const rec = history.records.value[menu.value?.index ?? -1]
  if (rec) history.copyToBefore(rec.state)
  closeMenu()
}
function menuCreateSnapshot() {
  const rec = history.records.value[menu.value?.index ?? -1]
  if (rec && activePhoto.value) history.createSnapshot(activePhoto.value.id, rec.state)
  closeMenu()
}
function menuClearAbove() {
  if (menu.value && activePhoto.value) {
    history.clearAbove(activePhoto.value.id, menu.value.index)
  }
  closeMenu()
}
function menuRename() {
  const rec = history.records.value[menu.value?.index ?? -1]
  if (rec) {
    editingId.value = rec.id
    editName.value = rec.name
    nextTick(() => renameInput.value?.focus())
  }
  closeMenu()
}

// ===== 重命名 =====
const editingId = ref<string | null>(null)
const editName = ref('')
const renameInput = ref<HTMLInputElement | null>(null)
function commitRename(r: { id: string; index: number }) {
  if (editingId.value === r.id && activePhoto.value) {
    history.renameNode(activePhoto.value.id, r.index, editName.value)
  }
  editingId.value = null
}

// ===== Clear All（清空该照片全部历史，不修改当前参数） =====
function onClearAll() {
  if (!activePhoto.value) return
  history.clearAll(activePhoto.value.id)
}

// ===== 快照 =====
function restoreSnap(id: string) {
  if (!activePhoto.value) return
  history.restoreSnapshot(activePhoto.value.id, id)
}
function removeSnap(id: string) {
  if (!activePhoto.value) return
  history.removeSnapshot(activePhoto.value.id, id)
}
function clearSnaps() {
  if (!activePhoto.value) return
  history.clearSnapshots(activePhoto.value.id)
}

const beforeHint = computed(() => history.beforeState.value != null)
</script>

<template>
  <div class="hist">
    <p v-if="!activePhoto" class="hint">请先在图库或胶片条中选择一张照片。</p>

    <template v-else>
      <p class="photo-name" :title="activePhoto.name">{{ activePhoto.name }}</p>

      <p v-if="beforeHint" class="before-hint" title="右键历史节点可重新复制为 Before 对比状态">
        ✓ 已复制为 Before 对比状态
      </p>

      <p v-if="history.records.value.length === 0" class="hint">暂无记录。</p>
      <div v-else class="list">
        <div
          v-for="r in list"
          :key="r.id"
          class="item"
          :class="{ current: r.index === history.cursor.value, import: r.index === 0 }"
          :title="`${r.name} · ${new Date(r.ts).toLocaleString()}`"
          @click="onJump(r)"
          @mouseenter="onEnter(r)"
          @mouseleave="onLeave"
          @contextmenu="openMenu($event, r.index)"
        >
          <template v-if="editingId === r.id">
            <input
              ref="renameInput"
              v-model="editName"
              class="rename-inp"
              @click.stop
              @keyup.enter="commitRename(r)"
              @blur="commitRename(r)"
            />
          </template>
          <template v-else>
            <span class="tname">{{ r.name }}</span>
            <span v-if="r.index === 0" class="tag">导入</span>
            <span class="ts">{{ new Date(r.ts).toLocaleTimeString() }}</span>
          </template>
        </div>
      </div>

      <div class="row">
        <span class="count">共 {{ history.records.value.length }} 步</span>
        <span class="spacer" />
        <button class="btn" :disabled="!history.records.value.length" @click="onClearAll" title="清空该照片全部历史，不修改当前参数">
          Clear All
        </button>
      </div>

      <!-- 快照区 -->
      <div class="snaps">
        <div class="snap-head">
          <span class="snap-title">快照</span>
          <button
            v-if="snapshots.length"
            class="btn mini"
            @click="clearSnaps"
            title="删除该照片全部快照"
          >清空</button>
        </div>
        <p v-if="snapshots.length === 0" class="hint">右键历史节点可从此步骤创建快照。</p>
        <div v-else class="snap-list">
          <div v-for="s in snapshots" :key="s.id" class="snap-item" @click="restoreSnap(s.id)">
            <span class="tname" :title="new Date(s.ts).toLocaleString()">{{ s.name }}</span>
            <button class="del" title="删除快照" @click.stop="removeSnap(s.id)">✕</button>
          </div>
        </div>
      </div>
    </template>

    <!-- 右键菜单浮层 -->
    <div v-if="menu" class="menu-mask" @click="closeMenu" @contextmenu.prevent="closeMenu">
      <div class="ctx-menu" :style="{ left: menu.x + 'px', top: menu.y + 'px' }">
        <button class="mi" @click="menuCopyToBefore">复制此步骤参数为 Before</button>
        <button class="mi" @click="menuCreateSnapshot">从此步骤创建快照</button>
        <button class="mi" @click="menuRename">重命名此步骤</button>
        <div class="mi-sep" />
        <button class="mi danger" :disabled="!canClearAbove" @click="menuClearAbove">
          Clear History Above This Step
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.hist {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.hint {
  color: var(--text-dim);
  font-size: 12px;
  font-weight: 400;
  line-height: 16px;
  margin: 0;
}
.photo-name {
  font-size: 12px;
  font-weight: 400;
  line-height: 16px;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  margin: 0;
}
.before-hint {
  font-size: 11px;
  font-weight: 400;
  line-height: 16px;
  color: var(--accent);
  margin: 0;
}
.list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 260px;
  overflow: auto;
}
.item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 0;
  padding: 0 8px;
  height: 24px;
  cursor: pointer;
  color: var(--text);
  text-align: left;
  font-size: 12px;
  font-weight: 400;
  line-height: 16px;
}
.item:hover {
  background: var(--hover);
  border-color: var(--border);
}
.item:active { background: var(--pressed); }
.item.current {
  background: var(--accent);
  border-color: var(--accent);
}
.item.import .tname {
  font-style: italic;
  color: var(--text-dim);
}
.tname {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ts {
  font-size: 11px;
  font-weight: 400;
  color: var(--text-dim);
  line-height: 14px;
  flex: none;
}
.tag {
  font-size: 11px;
  font-weight: 400;
  color: var(--text-dim);
  background: var(--panel-3);
  border-radius: 0;
  padding: 0 6px;
  height: 16px;
  display: inline-flex;
  align-items: center;
  line-height: 1;
}
.rename-inp {
  flex: 1;
  min-width: 0;
  height: 18px;
  background: var(--panel);
  border: 1px solid var(--accent);
  border-radius: 0;
  color: var(--text);
  padding: 0 4px;
  font-size: 12px;
}
.row {
  display: flex;
  align-items: center;
  gap: 6px;
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
  padding: 0 10px;
  height: 22px;
  font-size: 12px;
  font-weight: 400;
  line-height: 16px;
  cursor: pointer;
}
.btn:hover { background: var(--hover); color: var(--text-normal); }
.btn:active { background: var(--pressed); }
.btn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.btn.mini {
  height: 18px;
  padding: 0 8px;
  font-size: 11px;
}
.snaps {
  border-top: 1px solid var(--border);
  padding-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.snap-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.snap-title {
  font-size: 12px;
  font-weight: 400;
  line-height: 16px;
  color: var(--text-dim);
  text-transform: uppercase;
}
.snap-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
  max-height: 140px;
  overflow: auto;
}
.snap-item {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 0;
  padding: 0 8px;
  height: 22px;
  cursor: pointer;
  color: var(--text);
  font-size: 12px;
  font-weight: 400;
  line-height: 16px;
}
.snap-item:hover {
  background: var(--hover);
  border-color: var(--border);
}
.del {
  background: none;
  border: 1px solid transparent;
  color: var(--text-dim);
  cursor: pointer;
  font-size: 12px;
  font-weight: 400;
  width: 18px;
  height: 18px;
  line-height: 1;
  padding: 0;
  flex: none;
}
.del:hover { background: var(--hover); color: var(--text); }

/* ===== 右键菜单浮层 ===== */
.menu-mask {
  position: fixed;
  inset: 0;
  z-index: 999;
}
.ctx-menu {
  position: fixed;
  min-width: 220px;
  display: flex;
  flex-direction: column;
  background: var(--panel);
  border: 1px solid var(--border);
  box-shadow: 0 6px 20px rgba(0, 0, 0, 0.45);
  padding: 4px 0;
}
.mi {
  display: block;
  width: 100%;
  text-align: left;
  background: none;
  border: none;
  color: var(--text);
  font-size: 12px;
  font-weight: 400;
  line-height: 16px;
  padding: 6px 12px;
  cursor: pointer;
}
.mi:hover { background: var(--hover); }
.mi:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.mi.danger { color: #e0745a; }
.mi-sep {
  height: 1px;
  margin: 4px 0;
  background: var(--border);
}
</style>
