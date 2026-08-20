<script setup lang="ts">
// 左侧"参数快照"面板：保存当前配置为快照、恢复、删除、清空；以及模板导入/导出。
import { ref } from 'vue'
import { useHistory } from '../../composables/useHistory'
import { useFrameConfig } from '../../composables/useFrameConfig'
import { useTemplates } from '../../composables/useTemplates'

const history = useHistory()
const { state } = useFrameConfig()
const templates = useTemplates()

const name = ref('')
const fileInput = ref<HTMLInputElement | null>(null)

function save() {
  if (!name.value.trim()) return
  history.saveHistory(name.value, JSON.parse(JSON.stringify(state)))
  name.value = ''
}
function onImport(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) {
    const reader = new FileReader()
    reader.onload = () => templates.importJson(String(reader.result))
    reader.readAsText(file)
  }
  input.value = ''
}
</script>

<template>
  <div class="snap">
    <div class="row">
      <input v-model="name" class="inp" placeholder="快照名称" @keyup.enter="save" />
      <button class="btn" @click="save">保存</button>
    </div>

    <p v-if="history.items.value.length === 0" class="hint">暂无快照。</p>
    <div v-else class="list">
      <div v-for="it in history.items.value" :key="it.ts" class="item" @click="history.restore(it)">
        <div class="info">
          <span class="tname">{{ it.name }}</span>
          <span class="ts">{{ new Date(it.ts).toLocaleString() }}</span>
        </div>
        <button class="del" @click.stop="history.removeHistory(it.ts)">✕</button>
      </div>
    </div>

    <div class="row tools">
      <button class="btn" :disabled="!history.items.value.length" @click="history.clearHistory()">清空快照</button>
      <span class="spacer" />
      <button class="btn" @click="fileInput?.click()">导入模板</button>
      <input ref="fileInput" type="file" accept=".json,application/json" hidden @change="onImport" />
    </div>
  </div>
</template>

<style scoped>
.snap {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.row {
  display: flex;
  gap: 6px;
}
.spacer {
  flex: 1;
}
.inp {
  flex: 1;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 6px;
  color: var(--text);
  padding: 6px 8px;
  font-size: 12px;
}
.btn {
  background: var(--panel-2);
  color: var(--text);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 6px 10px;
  font-size: 12px;
  cursor: pointer;
}
.btn:disabled {
  opacity: 0.4;
}
.hint {
  color: var(--text-dim);
  font-size: 12px;
}
.list {
  display: flex;
  flex-direction: column;
  gap: 5px;
  max-height: 220px;
  overflow: auto;
}
.item {
  display: flex;
  align-items: center;
  gap: 6px;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 6px 8px;
  cursor: pointer;
}
.item:hover {
  border-color: var(--accent);
}
.info {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}
.tname {
  font-size: 12px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ts {
  font-size: 10px;
  color: var(--text-dim);
}
.del {
  background: none;
  border: none;
  color: #ff8080;
  cursor: pointer;
  font-size: 12px;
}
.tools {
  margin-top: 4px;
}
</style>
