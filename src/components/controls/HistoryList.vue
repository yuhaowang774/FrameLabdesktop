<script setup lang="ts">
// 历史记录控件：保存当前配置 / 恢复 / 删除 / 清空（复用阶段12抽离的 useHistory）
import { ref } from 'vue'
import { useFrameConfig } from '../../composables/useFrameConfig'
import { useHistory } from '../../composables/useHistory'
import GlassModal from '../common/GlassModal.vue'

const { state } = useFrameConfig()
const { items, saveHistory, removeHistory, clearHistory, restore } = useHistory()

const modalOpen = ref(false)
const newName = ref('')

function save() {
  if (!newName.value.trim()) return
  saveHistory(newName.value, state)
  modalOpen.value = false
  newName.value = ''
}

function clearAll() {
  if (items.value.length) clearHistory()
}
</script>

<template>
  <section class="control-block">
    <div class="head">
      <h4>历史记录</h4>
      <div class="head-ops">
        <button v-if="items.length" class="clear-btn" @click="clearAll">清空</button>
        <button class="save-btn" @click="modalOpen = true">保存当前</button>
      </div>
    </div>
    <ul v-if="items.length" class="list">
      <li v-for="it in items" :key="it.ts">
        <span class="name" :title="it.name">{{ it.name }}</span>
        <div class="ops">
          <button @click="restore(it)">恢复</button>
          <button @click="removeHistory(it.ts)">删</button>
        </div>
      </li>
    </ul>
    <p v-else class="empty">暂无记录</p>

    <GlassModal
      v-model="modalOpen"
      title="保存当前配置"
      input-mode
      :input-value="newName"
      input-placeholder="配置名称"
      confirm-text="保存"
      @confirm="save"
    />
  </section>
</template>

<style scoped>
.control-block {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.head-ops {
  display: flex;
  gap: 6px;
}
h4 {
  font-size: 13px;
  color: #aaa;
}
.save-btn,
.clear-btn {
  padding: 5px 10px;
  border-radius: 7px;
  border: 1px solid rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.06);
  color: #fff;
  cursor: pointer;
  font-size: 12px;
}
.clear-btn {
  border-color: rgba(255, 90, 90, 0.4);
  background: rgba(255, 90, 90, 0.14);
  color: #ff9a9a;
}
.list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.list li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 8px;
  border-radius: 7px;
  background: rgba(255, 255, 255, 0.04);
  font-size: 13px;
}
.name {
  color: #eee;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.ops button {
  margin-left: 6px;
  padding: 3px 8px;
  border-radius: 6px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  background: rgba(255, 255, 255, 0.06);
  color: #ddd;
  cursor: pointer;
  font-size: 12px;
}
.empty {
  font-size: 12px;
  color: #777;
}
</style>
