<script setup lang="ts">
// 左侧模板库面板：按类别展示内置/自定义模板，点击应用，支持删除自定义模板。
// 自定义模板支持导出 JSON（桌面端另存对话框 / 网页端下载）。
import { computed } from 'vue'
import { useTemplates, type TemplateCategory } from '../../composables/useTemplates'
import { useFrameConfig } from '../../composables/useFrameConfig'
import { isTauri } from '../../platform/env'
import { saveTextAs } from '../../platform/fs'
import { downloadBlob } from '../../core/exporter'

const props = defineProps<{ category: TemplateCategory }>()
const templates = useTemplates()
const { loadConfig } = useFrameConfig()

const list = computed(() =>
  templates.templates.filter((t) => t.category === props.category || t.category === 'all'),
)

function apply(t: { id: string }) {
  const found = templates.templates.find((x) => x.id === t.id)
  if (found) loadConfig(found.config)
}
function onRemove(e: Event, id: string) {
  e.stopPropagation()
  templates.remove(id)
}
async function onExport(e: Event, id: string, name: string) {
  e.stopPropagation()
  const json = templates.exportJson(id)
  if (!json) return
  const filename = `${name.replace(/[\\/:*?"<>|]/g, '_')}.json`
  if (isTauri) {
    await saveTextAs(filename, json)
  } else {
    downloadBlob(new Blob([json], { type: 'application/json' }), filename)
  }
}
</script>

<template>
  <div class="tpl-list">
    <p v-if="list.length === 0" class="hint">暂无模板。</p>
    <button v-for="t in list" :key="t.id" class="tpl" @click="apply(t)">
      <span class="tname">{{ t.name }}</span>
      <span v-if="t.builtin" class="tag">内置</span>
      <template v-else>
        <span class="tag custom" title="导出 JSON" @click="(e) => onExport(e, t.id, t.name)">⬇</span>
        <span class="tag custom" title="删除" @click="(e) => onRemove(e, t.id)">✕</span>
      </template>
    </button>
  </div>
</template>

<style scoped>
.tpl-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.hint {
  color: var(--text-dim);
  font-size: 12px;
}
.tpl {
  display: flex;
  align-items: center;
  gap: 8px;
  background: var(--panel-2);
  border: 1px solid var(--border);
  border-radius: 7px;
  padding: 8px 10px;
  cursor: pointer;
  color: var(--text);
  font-size: 13px;
  text-align: left;
}
.tpl:hover {
  border-color: var(--accent);
}
.tname {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tag {
  font-size: 10px;
  color: var(--text-dim);
  background: var(--panel-3);
  border-radius: 8px;
  padding: 1px 6px;
}
.tag.custom {
  cursor: pointer;
  color: #ff8080;
}
</style>
