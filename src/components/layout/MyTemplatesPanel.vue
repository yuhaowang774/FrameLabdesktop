<script setup lang="ts">
// 左栏「我的模板」面板：把当前编辑配置一键保存为自定义模板，并可应用 / 删除已存模板。
// 承接原导出页「批量同步 → 保存当前配置为模板」入口（0.1.29 起移入编辑页左栏）：
// 在编辑页调好样式随手保存，保存后的模板同时出现在「相框模板库 → 我的模板」分组。
import { ref, computed, onBeforeUnmount } from 'vue'
import { useTemplates, applyTemplateToState, type FrameTemplate } from '../../composables/useTemplates'
import { useFrameConfig } from '../../composables/useFrameConfig'
import { useAppState } from '../../composables/useAppState'
import { templateThumbDataUrl } from '../../core/templateThumb'
import GlassModal from '../common/GlassModal.vue'

const templates = useTemplates()
const { state } = useFrameConfig()
const app = useAppState()

const customList = computed(() => templates.templates.filter((t) => !t.builtin))
// 列表缩略图：程序化 SVG（画布几何与成片同源），同步渲染无闪烁
const thumbs = computed(() => {
  const m: Record<string, string> = {}
  for (const t of customList.value) m[t.id] = templateThumbDataUrl(t.config)
  return m
})

// ===== 保存当前配置为模板 =====
const name = ref('')
const savedTip = ref('')
let tipTimer: ReturnType<typeof setTimeout> | undefined
function onSave() {
  const now = new Date()
  // 留空自动命名「我的模板 M.D」，多次保存也可区分
  const trimmed = name.value.trim() || `我的模板 ${now.getMonth() + 1}.${now.getDate()}`
  templates.saveCurrent(trimmed, state, 'all')
  name.value = ''
  savedTip.value = `已保存「${trimmed}」`
  clearTimeout(tipTimer)
  tipTimer = setTimeout(() => (savedTip.value = ''), 2500)
}
onBeforeUnmount(() => clearTimeout(tipTimer))

// ===== 应用 / 删除（应用行为与相框模板库一致：缺 INFO 时弹占位提示） =====
const missingOpen = ref(false)
const missingMsg = ref('')
function onApply(t: FrameTemplate) {
  const missing = applyTemplateToState(t.config)
  app.state.rightOpen = true
  app.setPanel('right', 'background', true)
  app.setPanel('right', 'border', true)
  if (missing.length) {
    missingMsg.value = `当前照片未识别到以下 INFO 信息：${missing.join('、')}。已用「自定义」占位，可在右侧 INFO 面板手动填写。`
    missingOpen.value = true
  }
}
</script>

<template>
  <div class="my-templates">
    <!-- 保存当前配置 -->
    <div class="save-row">
      <input
        v-model="name"
        class="inp"
        placeholder="模板名称（留空自动命名）"
        maxlength="30"
        @keydown.enter="onSave"
      />
      <button class="btn" @click="onSave">保存当前配置</button>
    </div>
    <p class="tip" :class="{ ok: savedTip }">
      {{ savedTip || '把当前相框 / 背景 / INFO 样式保存为模板，一键复用到任意照片。' }}
    </p>

    <!-- 已保存模板列表 -->
    <p v-if="customList.length === 0" class="empty">还没有自定义模板。调好样式后点上方按钮保存。</p>
    <ul v-else class="tpl-list">
      <li v-for="t in customList" :key="t.id" class="tpl-item">
        <img class="tpl-thumb" :src="thumbs[t.id]" :alt="t.name" draggable="false" />
        <span class="tpl-name" :title="t.name">{{ t.name }}</span>
        <span class="tpl-ops">
          <button class="op" title="应用到当前照片" @click="onApply(t)">应用</button>
          <button class="op del" title="删除该模板" @click="templates.remove(t.id)">删除</button>
        </span>
      </li>
    </ul>
  </div>

  <GlassModal v-model="missingOpen" title="INFO 信息缺失提示" :message="missingMsg" confirm-text="知道了" />
</template>

<style scoped>
.my-templates {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
/* 保存表单 */
.save-row {
  display: flex;
  gap: 6px;
}
.inp {
  flex: 1;
  min-width: 0;
  height: 24px;
  padding: 0 8px;
  border: 1px solid var(--border);
  background: var(--panel-2);
  color: var(--text);
  font-size: 12px;
  font-family: inherit;
}
.inp:focus {
  outline: none;
  border-color: var(--accent);
}
.inp::placeholder {
  color: var(--text-dim);
}
.btn {
  flex: none;
  height: 24px;
  padding: 0 10px;
  border: 1px solid var(--accent);
  background: var(--accent);
  color: var(--text);
  font-size: 12px;
  line-height: 16px;
  cursor: pointer;
  font-family: inherit;
}
.btn:hover {
  filter: brightness(1.08);
}
.btn:active {
  background: var(--pressed);
}
/* 提示行：默认为说明文字，保存成功后短暂变为确认文案 */
.tip {
  font-size: 11px;
  line-height: 15px;
  color: var(--text-dim);
}
.tip.ok {
  color: var(--text);
}
.empty {
  font-size: 11px;
  line-height: 15px;
  color: var(--text-dim);
}
/* 模板列表：缩略图 + 名称 + 操作，单行紧凑排布 */
.tpl-list {
  list-style: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.tpl-item {
  display: flex;
  align-items: center;
  gap: 8px;
  border: 1px solid var(--border);
  background: var(--panel-2);
  padding: 4px 6px;
}
.tpl-item:hover {
  background: var(--hover);
}
.tpl-thumb {
  flex: none;
  height: 36px;
  max-width: 56px;
  object-fit: contain;
  background: var(--panel-3);
}
.tpl-name {
  flex: 1;
  min-width: 0;
  font-size: 12px;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.tpl-ops {
  flex: none;
  display: inline-flex;
  gap: 4px;
}
.op {
  height: 20px;
  padding: 0 7px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-dim);
  font-size: 11px;
  line-height: 16px;
  cursor: pointer;
  font-family: inherit;
}
.op:hover {
  background: var(--pressed);
  color: var(--text);
  border-color: var(--border);
}
.op.del:hover {
  border-color: var(--danger, #c0392b);
  color: var(--danger, #e74c3c);
}
</style>
