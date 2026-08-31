<script setup lang="ts">
// 自定义字体下拉：原生 <select> 的选项无法可靠捕获 mouseover（原生下拉控件不冒泡），
// 故自实现下拉。鼠标经过某选项时 emit('preview', 字体栈) 让画板 INFO 实时预览，
// 移出面板 emit('preview', null) 恢复；点击选项 emit('update:modelValue') 正式选中。
import { ref, computed } from 'vue'
import { FONT_OPTIONS } from '../../core/constants'

const props = defineProps<{ modelValue: string }>()
const emit = defineEmits<{
  (e: 'update:modelValue', v: string): void
  (e: 'preview', v: string | null): void
}>()

const open = ref(false)

// 按 group 分组（与 FONT_OPTIONS 顺序一致）
const groups = computed(() => {
  const map = new Map<string, { value: string; label: string }[]>()
  for (const f of FONT_OPTIONS) {
    if (!map.has(f.group)) map.set(f.group, [])
    map.get(f.group)!.push({ value: f.value, label: f.label })
  }
  return [...map.entries()].map(([label, options]) => ({ label, options }))
})

const currentLabel = computed(() => {
  const f = FONT_OPTIONS.find((f) => f.value === props.modelValue)
  return f ? f.label : '—'
})

function toggle() {
  open.value = !open.value
}
function onEnter(v: string) {
  emit('preview', v)
}
function clearPreview() {
  emit('preview', null)
}
function select(v: string) {
  emit('update:modelValue', v)
  clearPreview()
  open.value = false
}
function close() {
  open.value = false
  clearPreview()
}
</script>

<template>
  <div class="font-select" :class="{ open }">
    <button type="button" class="trigger select" @click="toggle">
      <span class="cur" :style="{ fontFamily: modelValue }">{{ currentLabel }}</span>
      <span class="caret" aria-hidden="true">▾</span>
    </button>

    <!-- 展开时全屏遮罩：点击空白处关闭并恢复预览 -->
    <div v-if="open" class="mask" @mousedown="close" />
    <div v-if="open" class="pop" @mouseleave="clearPreview">
      <div v-for="g in groups" :key="g.label" class="grp">
        <div class="grp-label">{{ g.label }}</div>
        <button
          v-for="o in g.options"
          :key="o.value"
          type="button"
          class="opt"
          :class="{ active: o.value === modelValue }"
          :style="{ fontFamily: o.value }"
          @mouseenter="onEnter(o.value)"
          @click="select(o.value)"
        >
          {{ o.label }}
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.font-select {
  position: relative;
  flex: 1;
  min-width: 0;
}
.trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
  width: 100%;
  height: 24px;
  padding: 0 8px;
  border-radius: 0;
  border: 1px solid var(--border);
  background: var(--panel-2);
  color: var(--text);
  font-size: 12px;
  font-weight: 400;
  line-height: 16px;
  text-align: left;
  cursor: pointer;
}
.trigger:hover {
  background: var(--hover);
}
.trigger .cur {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.caret {
  flex: none;
  font-size: 10px;
  color: var(--text-dim);
  transform: translateY(1px);
}
.mask {
  position: fixed;
  inset: 0;
  z-index: 40;
}
.pop {
  position: absolute;
  z-index: 50;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  max-height: 260px;
  overflow-y: auto;
  padding: 4px;
  background: var(--panel-2);
  border: 1px solid var(--border);
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.35);
}
.grp {
  padding: 2px 0;
}
.grp + .grp {
  border-top: 1px solid var(--border);
}
.grp-label {
  font-size: 10px;
  color: var(--text-dim);
  padding: 4px 6px 2px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.opt {
  display: block;
  width: 100%;
  text-align: left;
  padding: 4px 6px;
  border: none;
  background: transparent;
  color: var(--text);
  font-size: 13px;
  line-height: 18px;
  cursor: pointer;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.opt:hover {
  background: var(--hover);
}
.opt.active {
  background: var(--accent);
  color: var(--text-on-accent, var(--text));
}
</style>
