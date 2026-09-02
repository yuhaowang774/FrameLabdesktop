<script setup lang="ts">
// 更新记录弹窗：更新完成后自动弹出本次详情；也可从首选项「关于 → 更新记录」打开查看全部历史。
// 风格沿用 FrameLab 方正极简语言（细边框、直角、小字号、主题变量）。
import { computed } from 'vue'
import {
  UPDATE_LOG,
  UPDATE_GROUP_LABELS,
  IMPORTANCE_LABELS,
  compareVersions,
  type UpdateImportance,
} from '../../core/updateLog'
import type { UpdateHit } from '../../composables/useUpdateLog'

const props = withDefaults(
  defineProps<{
    modelValue: boolean
    /** 刚完成升级时传入（自动弹窗模式：顶部显示升级横幅并高亮本次版本）；null = 纯历史查看 */
    update?: UpdateHit | null
  }>(),
  { update: null },
)

const emit = defineEmits<{ (e: 'update:modelValue', v: boolean): void }>()

function close() {
  emit('update:modelValue', false)
}

/** 列表条目：按版本号数值化倒序（最新在上，不能用字典序——0.1.10 会被排到 0.1.2 后）；本次更新置顶 */
const entries = computed(() => {
  const list = [...UPDATE_LOG].sort((a, b) => compareVersions(b.version, a.version))
  if (!props.update) return list
  const rest = list.filter((e) => e.version !== props.update!.entry.version)
  return [props.update.entry, ...rest]
})

const importanceClass = (i: UpdateImportance) => `imp-${i}`
</script>

<template>
  <Teleport to="body">
    <div v-if="modelValue" class="upd-mask" @click.self="close">
      <div class="upd-box">
        <div class="upd-head">
          <span class="upd-title">{{ update ? '更新完成' : '更新记录' }}</span>
          <button class="upd-close" title="关闭 (Esc)" @click="close">×</button>
        </div>

        <!-- 升级横幅：仅自动弹窗模式显示 -->
        <div v-if="update" class="upd-banner">
          <span class="banner-ver">已成功更新到 v{{ update.entry.version }}</span>
          <span class="banner-from">（上次 v{{ update.from }}）</span>
          <span class="imp" :class="importanceClass(update.entry.importance)">
            {{ IMPORTANCE_LABELS[update.entry.importance] }}
          </span>
        </div>

        <div class="upd-list">
          <section
            v-for="e in entries"
            :key="e.version"
            class="upd-item"
            :class="{ current: update?.entry.version === e.version }"
          >
            <header class="item-head">
              <span class="item-ver">v{{ e.version }}</span>
              <span class="item-date">{{ e.date }}</span>
              <span class="imp" :class="importanceClass(e.importance)">
                {{ IMPORTANCE_LABELS[e.importance] }}
              </span>
              <span v-if="update?.entry.version === e.version" class="item-new">本次更新</span>
            </header>
            <div class="item-groups">
              <template v-for="g in UPDATE_GROUP_LABELS" :key="g.key">
                <div v-if="e.groups[g.key]?.length" class="group">
                  <span class="group-label" :class="`gl-${g.key}`">{{ g.label }}</span>
                  <ul class="group-list">
                    <li v-for="line in e.groups[g.key]" :key="line">{{ line }}</li>
                  </ul>
                </div>
              </template>
            </div>
          </section>
        </div>

        <div class="upd-foot">
          <button class="btn-confirm" @click="close">我知道了</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.upd-mask {
  position: fixed;
  inset: 0;
  background: rgba(8, 8, 10, 0.55);
  backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1010; /* 高于首选项弹窗（1000）：历史入口打开时盖在其上 */
}
.upd-box {
  width: min(480px, 92vw);
  max-height: 84vh;
  display: flex;
  flex-direction: column;
  background: var(--panel);
  border: 1px solid var(--border);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
}
.upd-head {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 42px;
  padding: 0 8px 0 16px;
  border-bottom: 1px solid var(--border);
}
.upd-title {
  font-size: 13px;
  font-weight: 400;
  color: var(--text);
}
.upd-close {
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--text-dim);
  font-size: 16px;
  cursor: pointer;
}
.upd-close:hover { background: var(--hover); color: var(--text-normal); }

/* 升级横幅 */
.upd-banner {
  flex: none;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--panel-2);
}
.banner-ver {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}
.banner-from {
  font-size: 12px;
  color: var(--text-dim);
}

/* 版本列表 */
.upd-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 8px 12px;
}
.upd-item {
  padding: 10px 12px;
  border: 1px solid transparent;
  border-bottom: 1px solid var(--border);
}
.upd-item:last-child { border-bottom: none; }
.upd-item.current {
  border: 1px solid var(--accent);
  background: var(--panel-2);
  margin: 2px 0;
}
.item-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}
.item-ver {
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
}
.item-date {
  font-size: 11px;
  color: var(--text-dim);
}
.item-new {
  margin-left: auto;
  font-size: 11px;
  color: var(--accent);
}

/* 重要程度徽标 */
.imp {
  font-size: 10px;
  line-height: 16px;
  padding: 0 6px;
  border: 1px solid var(--border);
  color: var(--text-dim);
  white-space: nowrap;
}
.imp.imp-major {
  color: #ff8a5c;
  border-color: #ff8a5c;
}
.imp.imp-normal {
  color: #7fb2ff;
  border-color: #7fb2ff;
}

/* 内容分组 */
.item-groups {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.group { display: flex; gap: 8px; }
.group-label {
  flex: none;
  width: 56px;
  font-size: 11px;
  line-height: 17px;
  text-align: right;
}
.group-label.gl-added { color: #7fd08a; }
.group-label.gl-improved { color: #7fb2ff; }
.group-label.gl-fixed { color: #ffb361; }
.group-label.gl-known { color: var(--text-dim); }
.group-list {
  flex: 1;
  min-width: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}
.group-list li {
  font-size: 12px;
  line-height: 17px;
  color: var(--text);
}
.group-list li::before {
  content: '·';
  margin-right: 4px;
  color: var(--text-dim);
}

/* 底部按钮 */
.upd-foot {
  flex: none;
  display: flex;
  justify-content: flex-end;
  padding: 10px 16px;
  border-top: 1px solid var(--border);
}
.btn-confirm {
  height: 28px;
  padding: 0 20px;
  border-radius: 0;
  border: 1px solid var(--accent);
  background: var(--accent);
  color: var(--text);
  font-size: 12px;
  cursor: pointer;
}
.btn-confirm:hover { filter: brightness(1.1); }
.btn-confirm:active { filter: brightness(0.95); }
</style>
