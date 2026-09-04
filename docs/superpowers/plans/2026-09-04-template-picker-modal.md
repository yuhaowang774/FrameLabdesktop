# 模板选择弹窗（TemplatePickerModal）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将左栏「相框模板库」从内嵌小卡片列表改为「点击弹出左右分栏大弹窗」，点卡即实时应用到当前照片、右栏显示当前照片+模板合成的大预览，支持批量应用与自定义模板管理。

**Architecture:** 新增 `TemplatePickerModal.vue`（Teleport 浮层，左右分栏：左模板网格 / 右大预览+批量按钮）；`CollapsiblePanel` 增加可选 `titleAction="popup"`，`LeftPanels` 中相框模板库标题点击直接弹窗；删除 `TemplatePanel.vue`（全部逻辑迁入弹窗）。缩略图复用 `core/templateThumb.ts`（SVG 占位 → 真实照片合成），应用/批量/删除/缺失提示全部复用 `useTemplates` / `useHistory` 既有函数，零新核心逻辑。

**Tech Stack:** Vue 3 `<script setup>` + TS、@vue/test-utils + vitest、Teleport、CSS 变量（磨砂暗色 token）

***

## 关键既有代码速查（实施前必读）

- `src/components/layout/TemplatePanel.vue` — 被删除，其 `apply` / `applyBatch` / `onRemove` / 缩略图 watch / missing 提示逻辑整体迁入弹窗

- `src/components/common/CollapsiblePanel.vue` — 标题点击 `emit('toggle')`，将加 `titleAction`

- `src/components/common/GlassModal.vue` — INFO 缺失提示复用，z-index 1000（弹窗设为 1100 以浮于其上）

- `src/composables/useTemplates.ts` — `FrameTemplate { id, name, category, config, builtin? }`，`templates` 为 `reactive` 数组，`remove(id)` 删除自定义；`applyTemplateToState(config)` 返回缺失字段名数组

- `src/composables/useAppState.ts` — `app.state.rightOpen`、`app.setPanel('right', 'background'|'border', true)`

- `src/composables/useLibrary.ts` — `library.items[]`（含 `id`/`selected`），`activeId`

- `src/composables/useHistory.ts` — `applyTemplateToPhotos(ids: string[], config, name): Promise<boolean>`（任一缺失返回 true）

- `src/core/templateThumb.ts` — `templateThumbDataUrl(config)` 同步 SVG；`renderTemplateThumbDataUrl(config, imageUrl?, maxLongEdge?)` 异步真实合成（失败回退 SVG）；`imageUrl` 传当前照片 src 即为「当前照片+模板」合成

- `src/core/colorUtils.ts` — `logoAutoColor` 等（模板应用已适配，勿动）

- 测试样板：`src/components/common/SelectableBox.test.ts`（@vue/test-utils + jsdom）

约束：`CollapsiblePanel` 默认行为必须不变（其余面板依赖 toggle）；项目 CSS 用变量 token（`--panel` / `--panel-2` / `--panel-3` / `--border` / `--text` / `--text-dim` / `--hover` / `--pressed` / `--accent` / `--btn-bg`），border-radius 全 0（项目风格无圆角）。

***

### Task 1: TemplatePickerModal 骨架（显隐 / 关闭 / 空库提示）

**Files:**

- Create: `src/components/controls/TemplatePickerModal.vue`

- Create: `src/components/controls/TemplatePickerModal.test.ts`

- [ ] **Step 1: 写失败测试（骨架行为）**

```ts
// src/components/controls/TemplatePickerModal.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import { reactive, nextTick } from 'vue'

// ---- composables mock ----
vi.mock('../../composables/useTemplates', () => ({
  frameTemplates: undefined, // 占位避免误用真实实现
  useTemplates: () => ({
    templates: reactive<Array<{ id: string; name: string; category: string; builtin?: boolean; desc?: string; config: Record<string, unknown> }>>([]),
    remove: vi.fn(),
  }),
  applyTemplateToState: vi.fn(() => []),
}))
vi.mock('../../composables/useAppState', () => ({
  useAppState: () => ({ state: { rightOpen: false }, setPanel: vi.fn() }),
}))
vi.mock('../../composables/useLibrary', () => ({
  useLibrary: () => ({ items: reactive([]), activeId: { value: null } }),
}))
vi.mock('../../composables/useFrameConfig', () => ({
  useFrameConfig: () => ({ state: reactive({ photoSrc: null }) }),
}))
vi.mock('../../composables/useHistory', () => ({
  applyTemplateToPhotos: vi.fn(async () => false),
}))
vi.mock('../../core/templateThumb', () => ({
  templateThumbDataUrl: () => 'data:image/svg+xml;utf8,%3Csvg%3E%3C/svg%3E',
  renderTemplateThumbDataUrl: vi.fn(async () => 'data:image/jpeg;base64,REAL'),
}))

import TemplatePickerModal from './TemplatePickerModal.vue'

const mountModal = (modelValue = true) =>
  mount(TemplatePickerModal, { props: { modelValue } })

describe('TemplatePickerModal 骨架', () => {
  it('modelValue=false 时不渲染，true 时渲染标题与关闭按钮', async () => {
    const closed = mountModal(false)
    expect(closed.find('.tp-modal').exists()).toBe(false)

    const w = mountModal(true)
    expect(w.find('.tp-modal').exists()).toBe(true)
    expect(w.find('.tp-head .tp-title').text()).toContain('相框模板库')
    expect(w.find('.tp-close').exists()).toBe(true)
  })

  it('空模板库显示提示文案', async () => {
    const w = mountModal(true)
    await nextTick()
    expect(w.find('.tp-empty').exists()).toBe(true)
    expect(w.find('.tp-empty').text()).toContain('暂无模板')
  })

  it('启动为空模板库时不选中任何模板，右栏显示占位', async () => {
    const w = mountModal(true)
    await nextTick()
    expect(w.find('.tp-preview-empty').exists()).toBe(true)
  })

  it('点击 × 与底部「完成」均触发 update:modelValue=false', async () => {
    const w = mountModal(true)
    await w.find('.tp-close').trigger('click')
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([false])
    w.setProps({ modelValue: true })
    await w.find('.tp-done').trigger('click')
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([false])
  })

  it('按 Esc 触发关闭（清空监听避免影响后续用例）', async () => {
    const w = mountModal(true)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([false])
    w.unmount()
  })
})
```

Run: `npx vitest run src/components/controls/TemplatePickerModal.test.ts`
Expected: FAIL（组件不存在）

- [ ] **Step 2: 实现骨架**

```vue
<!-- src/components/controls/TemplatePickerModal.vue -->
<script setup lang="ts">
// 模板选择弹窗：左＝模板网格（内置/自定义分组），右＝当前照片+模板实时合成预览。
// 点击卡片即应用（applyTemplateToState）并保持弹窗打开，便于连续对比；底部「完成」/×/Esc/遮罩关闭。
import { ref, computed, reactive, watch, onMounted, onBeforeUnmount } from 'vue'
import { useTemplates, applyTemplateToState } from '../../composables/useTemplates'
import { useAppState } from '../../composables/useAppState'
import { useLibrary } from '../../composables/useLibrary'
import { useFrameConfig } from '../../composables/useFrameConfig'
import { templateThumbDataUrl, renderTemplateThumbDataUrl } from '../../core/templateThumb'

const props = withDefaults(defineProps<{ modelValue: boolean; category?: 'frame' | 'all' }>(), {
  category: 'frame',
})
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const templates = useTemplates()
const app = useAppState()
const library = useLibrary()
const { state } = useFrameConfig()

const list = computed(() =>
  props.category === 'frame'
    ? templates.templates.filter((t) => t.category === 'frame' || t.category === 'all')
    : templates.templates.filter((t) => t.category === props.category),
)
const builtinList = computed(() => list.value.filter((t) => t.builtin))
const customList = computed(() => list.value.filter((t) => !t.builtin))

const selectedId = ref<string | null>(null)
const selected = computed(() => list.value.find((t) => t.id === selectedId.value) ?? builtinList.value[0] ?? null)

// 网格缩略图：SVG 即时占位 → 真实照片合成（复用 templateThumb 兜底）
const thumbs = reactive<Record<string, string>>({})
watch(
  () => list.value.map((t) => t.id).join(','),
  () => {
    for (const t of list.value) {
      if (thumbs[t.id] && !thumbs[t.id].startsWith('data:image/svg')) continue
      if (!thumbs[t.id]) thumbs[t.id] = templateThumbDataUrl(t.config)
      void (async () => {
        try {
          thumbs[t.id] = await renderTemplateThumbDataUrl(t.config)
        } catch {
          /* templateThumb 已内建 SVG 兜底 */
        }
      })()
    }
  },
  { immediate: true },
)

// 右栏大预览：选中模板 + 当前编辑照片合成（photoSrc 缺省时走内置示例图）
const previewId = ref<string | null>(null)
const previewUrl = ref('')
watch(
  () => selected.value?.id,
  (id, old) => {
    if (!id || !selected.value) return
    if (id === old && previewUrl.value) return
    previewId.value = id
    previewUrl.value = templateThumbDataUrl(selected.value.config)
    void (async () => {
      try {
        const photoSrc = state.photoSrc || undefined
        const url = await renderTemplateThumbDataUrl(selected.value?.config ?? {}, photoSrc, 960)
        if (previewId.value === id) previewUrl.value = url
      } catch {
        /* 回退 SVG */
      }
    })()
  },
)

// 关闭
function close() {
  emit('update:modelValue', false)
}
function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') close()
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <div v-if="modelValue" class="tp-mask" @click.self="close">
      <div class="tp-modal">
        <div class="tp-head">
          <span class="tp-title">相框模板库</span>
          <span class="tp-count" v-if="list.length">共 {{ list.length }} 套</span>
          <button class="tp-close" title="关闭 (Esc)" @click="close">✕</button>
        </div>

        <div class="tp-body">
          <!-- 左：模板网格 -->
          <div class="tp-col tp-grid-col">
            <p v-if="list.length === 0" class="tp-empty">暂无模板。</p>
            <template v-else>
              <h4 class="tp-group" v-if="builtinList.length">内置模板（{{ builtinList.length }}）</h4>
              <div class="tp-grid">
                <div
                  v-for="t in builtinList"
                  :key="t.id"
                  class="tp-card"
                  :class="{ active: selected?.id === t.id }"
                  @click="selectAndApply(t)"
                >
                  <img class="tp-card-thumb" :src="thumbs[t.id]" :alt="t.name" draggable="false" />
                  <div class="tp-card-meta">
                    <span class="tp-card-name">{{ t.name }}</span>
                    <span class="tp-card-batch" title="批量应用到选中照片（无选中=全部）" @click.stop="applyBatch(t)">⇉</span>
                  </div>
                </div>
              </div>
              <h4 class="tp-group" v-if="customList.length">我的模板（{{ customList.length }}）</h4>
              <div class="tp-grid">
                <div
                  v-for="t in customList"
                  :key="t.id"
                  class="tp-card"
                  :class="{ active: selected?.id === t.id }"
                  @click="selectAndApply(t)"
                >
                  <img class="tp-card-thumb" :src="thumbs[t.id]" :alt="t.name" draggable="false" />
                  <div class="tp-card-meta">
                    <span class="tp-card-name">{{ t.name }}</span>
                    <span class="tp-card-del" title="删除该模板" @click.stop="removeCustom(t)">✕</span>
                  </div>
                </div>
              </div>
            </template>
          </div>

          <!-- 右：大预览 -->
          <div class="tp-col tp-preview-col">
            <template v-if="selected">
              <div class="tp-preview-box">
                <img class="tp-preview-img" :src="previewUrl" :alt="selected.name" draggable="false" />
              </div>
              <div class="tp-preview-meta">
                <div class="tp-preview-name">{{ selected.name }}</div>
                <div class="tp-preview-desc">{{ selected.desc || '自定义模板（导出/导入保存的参数预设）' }}</div>
              </div>
              <button class="btn batch-main" :disabled="batchTargets.length === 0" @click="applyBatch(selected)">
                ⇉ 批量应用到 {{ batchTargets.length ? batchTargets.length : '全部' }} 张
              </button>
            </template>
            <p v-else class="tp-preview-empty">暂无模板可选</p>
          </div>
        </div>

        <div class="tp-foot">
          <span class="tp-hint">点击卡片即实时应用到当前照片，可对比挑选</span>
          <button class="btn tp-done" @click="close">完成</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.block-btn() { font-size: 12px; font-weight: 400; line-height: 16px; }
.tp-mask {
  position: fixed; inset: 0; z-index: 1100;
  background: rgba(0, 0, 0, 0.6);
  display: flex; align-items: center; justify-content: center;
}
.tp-modal {
  width: min(960px, 92vw); height: min(640px, 92vh);
  display: flex; flex-direction: column;
  background: var(--panel); border: 1px solid var(--border);
  box-shadow: 0 12px 48px rgba(0, 0, 0, 0.45);
  color: var(--text); border-radius: 0;
}
.tp-head {
  display: flex; align-items: center; gap: 10px;
  height: 40px; padding: 0 14px;
  border-bottom: 1px solid var(--border); flex: none;
}
.tp-title { flex: 1; font-size: 14px; font-weight: 500; }
.tp-count { font-size: 12px; color: var(--text-dim); }
.tp-close {
  width: 26px; height: 26px; cursor: pointer;
  background: transparent; border: 1px solid transparent;
  color: var(--text-dim); font-size: 13px; line-height: 24px;
}
.tp-close:hover { background: var(--hover); color: var(--text); }
.tp-body { flex: 1; display: grid; grid-template-columns: 5fr 4fr; min-height: 0; }
.tp-col { min-height: 0; overflow-y: auto; padding: 12px; }
.tp-grid-col { border-right: 1px solid var(--border); }
.tp-group {
  margin: 4px 0 8px; font-size: 12px; font-weight: 400;
  color: var(--text-dim); letter-spacing: 0;
}
.tp-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; margin-bottom: 14px; }
.tp-card {
  border: 1px solid var(--border); background: var(--panel-2);
  cursor: pointer; overflow: hidden;
}
.tp-card:hover { background: var(--hover); }
.tp-card.active { border-color: var(--accent); box-shadow: 0 0 0 1px var(--accent); }
.tp-card-thumb { display: block; width: 100%; height: 96px; object-fit: contain; background: var(--panel-3); }
.tp-card-meta {
  display: flex; align-items: center; gap: 4px;
  height: 26px; padding: 0 6px; border-top: 1px solid var(--border);
}
.tp-card-name { flex: 1; font-size: 12px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.tp-card-batch, .tp-card-del { cursor: pointer; color: var(--text-dim); padding: 0 4px; font-size: 13px; }
.tp-card-batch:hover, .tp-card-del:hover { color: var(--text); background: var(--hover); }
.tp-empty { color: var(--text-dim); font-size: 12px; }
.tp-preview-col { display: flex; flex-direction: column; align-items: stretch; gap: 10px; }
.tp-preview-box {
  flex: 1; display: flex; align-items: center; justify-content: center;
  background: var(--panel-3); border: 1px solid var(--border); min-height: 0;
}
.tp-preview-img { max-width: 100%; max-height: 100%; object-fit: contain; }
.tp-preview-empty { color: var(--text-dim); font-size: 12px; }
.tp-preview-name { font-size: 14px; font-weight: 500; }
.tp-preview-desc { font-size: 12px; color: var(--text-dim); }
.btn {
  height: 26px; padding: 0 14px; cursor: pointer;
  border: 1px solid var(--border); background: var(--btn-bg);
  color: var(--text); font-size: 12px; font-weight: 400; line-height: 16px;
}
.btn:hover { background: var(--hover); color: var(--text-normal); }
.btn:active { background: var(--pressed); }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.batch-main { align-self: flex-start; }
.tp-foot {
  flex: none; display: flex; align-items: center; gap: 10px;
  height: 42px; padding: 0 14px;
  border-top: 1px solid var(--border);
}
.tp-hint { flex: 1; font-size: 12px; color: var(--text-dim); }
.tp-done { min-width: 72px; background: var(--accent); border-color: var(--accent); }

@media (max-width: 768px) {
  .tp-body { grid-template-columns: 1fr; grid-template-rows: 1fr 1fr; }
  .tp-grid-col { border-right: none; border-bottom: 1px solid var(--border); }
  .tp-preview-box { min-height: 120px; }
}
</style>
```

注意：`selectAndApply` / `applyBatch` / `removeCustom` 为后续任务实现，当前此文件会报类型/运行时未定义——为让骨架先行可运行，Step 2 先给出**完整文件最终版**（含 Task 3/4/5 逻辑），避免反复改骨架。见下方 Step 2b 的补充块。

- [ ] **Step 2b: 补齐交互函数（应用/批量/删除）——本 Task 一次性落全，避免骨架重写**

在 `<script setup>` 内、`onKeydown` 之前插入：

```ts
// ===== 应用 / 批量 / 删除 =====
import { applyTemplateToPhotos } from '../../composables/useHistory'
import GlassModal from '../common/GlassModal.vue'

const missingOpen = ref(false)
const missingMsg = ref('')

const batchTargets = computed(() => {
  const sel = library.items.filter((i) => i.selected)
  return sel.length > 0 ? sel : library.items
})

function selectAndApply(t: { id: string }) {
  const found = templates.templates.find((x) => x.id === t.id)
  if (!found) return
  selectedId.value = t.id
  const missing = applyTemplateToState(found.config)
  app.state.rightOpen = true
  app.setPanel('right', 'background', true)
  app.setPanel('right', 'border', true)
  if (missing.length) {
    missingMsg.value = `当前照片未识别到以下 INFO 信息：${missing.join('、')}。已用「自定义」占位，可在右侧 INFO 面板手动填写。`
    missingOpen.value = true
  }
}

async function applyBatch(t: { id: string; name: string }) {
  const found = templates.templates.find((x) => x.id === t.id)
  if (!found) return
  const ids = batchTargets.value.map((i) => i.id)
  if (!ids.length) return
  const anyMissing = await applyTemplateToPhotos(ids, found.config, `应用模板「${found.name}」`)
  app.state.rightOpen = true
  app.setPanel('right', 'background', true)
  app.setPanel('right', 'border', true)
  if (anyMissing) {
    missingMsg.value = '部分照片未识别到 EXIF / 镜头 / 日期等信息，已用「自定义」占位，可在编辑页右侧 INFO 面板逐张手动填写。'
    missingOpen.value = true
  }
}

function removeCustom(t: { id: string }) {
  templates.remove(t.id)
  if (selectedId.value === t.id) selectedId.value = null
}
```

并在模板 `</style>` 前补 GlassModal 挂载（放 `.tp-foot` 之后、`</template>` 内）：

```html
  <GlassModal v-model="missingOpen" title="INFO 信息缺失提示" :message="missingMsg" confirm-text="知道了" />
```

import 语句需合并到文件顶部（`applyTemplateToPhotos`、`GlassModal`）。最终文件以「顶部集中 import + 上述全部逻辑」为准。

- [ ] **Step 3: 跑测试**

Run: `npx vitest run src/components/controls/TemplatePickerModal.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/controls/TemplatePickerModal.vue src/components/controls/TemplatePickerModal.test.ts
git -c user.name=yuhaowang774 -c user.email=yuhaowang774@users.noreply.github.com commit -m "feat: 模板选择弹窗 TemplatePickerModal 骨架（左右分栏 + 点卡即应用 + 批量/删除/缺失提示）"
```

***

### Task 2: 内置模板描述文案（FrameTemplate.desc）

**Files:**

- Modify: `src/composables/useTemplates.ts:21-28`（FrameTemplate 加 desc、BUILTIN 10 项补 desc）

- [ ] **Step 1: 修改 FrameTemplate 接口与内置模板数据**

`FrameTemplate` 增加可选字段：

```ts
export interface FrameTemplate {
  id: string
  name: string
  category: TemplateCategory
  /** 预设配置（不含 photoSrc） */
  config: Partial<FrameConfig>
  builtin?: boolean
  /** 一句话说明（模板选择弹窗右侧展示）；自定义模板缺省 */
  desc?: string
}
```

BUILTIN 中 10 个模板对象（`m_duo_card` / `m_float_round` / `m_white_mount` / `m_white_center` / `m_full_white_bar` / `m_silver_geo` / `m_film_darkroom` / `m_light_float` / `m_ccd_retro` / `m_magazine`）各加一行 `desc`（放在 `name` 之后）。文案示例（按模板实际风格逐一对应，不得照抄此列表外的措辞）：

```ts
desc: '经典白底等宽边框 + 左侧机型/右侧参数排布',
desc: '圆角悬浮照片 + 背景模糊向外延展',
desc: '白卡装裱 + 衬线字标 INFO 排版',
desc: '白底居中布局 + 机型参数居中排布',
desc: '全幅白条 + 底部铭牌式信息栏',
desc: '银灰测绘风格 + 等宽参数行',
desc: '胶片暗房 + 深色底黑框展示',
desc: '轻量悬浮 + 型号水印式标注',
desc: '复古 CCD + 日期戳点缀',
desc: '杂志双栏 + 标题与取色色卡',
```

- [ ] **Step 2: 验证 desc 生效**

Run: `npx vitest run src/components/controls/TemplatePickerModal.test.ts`
Expected: PASS —— desc 的渲染由 Task 3 组件测试（右栏展示 `白框参数卡` + `经典白底等宽边框`）回归覆盖；此处仅人工确认 10 条 desc 文案已落 BUILTIN（`rg -n "desc:" src/composables/useTemplates.ts` 应输出 10 处）。

- [ ] **Step 3: Commit**

```bash
git add src/composables/useTemplates.ts
git -c user.name=yuhaowang774 -c user.email=yuhaowang774@users.noreply.github.com commit -m "feat: 内置 10 套模板补充一句话说明 desc（模板选择弹窗右侧展示）"
```

***

### Task 3: 模板选择弹窗组件测试（分组渲染 / 选中 / 大预览 / 批量 / 删除）

**Files:**

- Modify: `src/components/controls/TemplatePickerModal.test.ts`（扩展现有 mock 为带数据）

- [ ] **Step 1: 扩展测试（覆盖分组、desc、选中、批量、删除）**

将 Task 1 测试文件中 `useTemplates` 的 mock 替换为带数据的版本，并追加用例：

```ts
const MOCK = {
  builtin: [
    { id: 'b1', name: '白框参数卡', category: 'frame', builtin: true, desc: '经典白底等宽边框', config: { bgMode: 'solid', bgColor: '#ffffff' } },
    { id: 'b2', name: '圆角悬浮·模糊延展', category: 'frame', builtin: true, desc: '圆角悬浮照片', config: { bgMode: 'blur' } },
  ],
  custom: [
    { id: 'c1', name: '我的预设', category: 'all', desc: undefined, config: { bgMode: 'photo' } },
  ],
}
vi.mock('../../composables/useTemplates', () => ({
  useTemplates: () => ({
    templates: reactive([...MOCK.builtin, ...MOCK.custom]),
    remove: vi.fn(() => {
      const t = templatesRef.value
      const removed = t[0]
      // 通过闭包读写 mock 数组（见下方替代实现）
    }),
  }),
  applyTemplateToState: vi.fn(() => []),
}))
```

（若闭包写法复杂，简化 remove：`vi.fn()`，测试只断言调用参数即可，删除后的列表更新由模板数组响应式自然生效——但 mock 数组固定时不会真的减少。为此在 beforeAll 中用 `reactive` 维护 `mockTemplates` 数组并在 remove 里 `splice`，测试间可重置。）

以下为最终测试文件骨架（替换 Task 1 整份文件内容）：

```ts
import { describe, it, expect, vi, beforeAll } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { reactive } from 'vue'

const mockTemplates = reactive<Array<{
  id: string; name: string; category: string; builtin?: boolean; desc?: string; config: Record<string, unknown>
}>>([])
const removeMock = vi.fn((id: string) => {
  const i = mockTemplates.findIndex((t) => t.id === id)
  if (i >= 0) mockTemplates.splice(i, 1)
})
const applyMock = vi.fn(() => [])
const applyBatchMock = vi.fn(async () => false)
const renderThumb = vi.fn(async () => 'data:image/jpeg;base64,BIG')
const setPanelMock = vi.fn()

vi.mock('../../composables/useTemplates', () => ({
  useTemplates: () => ({ templates: mockTemplates, remove: removeMock }),
  applyTemplateToState: applyMock,
}))
vi.mock('../../composables/useAppState', () => ({
  useAppState: () => ({ state: { rightOpen: false }, setPanel: setPanelMock }),
}))
vi.mock('../../composables/useLibrary', () => ({
  useLibrary: () => ({ items: mockItems, activeId: { value: null } }),
}))
vi.mock('../../composables/useFrameConfig', () => ({
  useFrameConfig: () => ({ state: { photoSrc: 'blob:photo-1' } }),
}))
vi.mock('../../composables/useHistory', () => ({
  applyTemplateToPhotos: applyBatchMock,
}))
vi.mock('../../core/templateThumb', () => ({
  templateThumbDataUrl: () => 'data:image/svg+xml;utf8,%3Csvg%3E%3C/svg%3E',
  renderTemplateThumbDataUrl: renderThumb,
}))

const mockItems = reactive([{ id: 'p1', selected: true }, { id: 'p2', selected: false }])

import TemplatePickerModal from './TemplatePickerModal.vue'

beforeAll(() => {
  mockTemplates.splice(0, mockTemplates.length,
    { id: 'b1', name: '白框参数卡', category: 'frame', builtin: true, desc: '经典白底等宽边框', config: { bgMode: 'solid' } },
    { id: 'b2', name: '圆角悬浮·模糊延展', category: 'frame', builtin: true, desc: '圆角悬浮照片', config: { bgMode: 'blur' } },
    { id: 'c1', name: '我的预设', category: 'all', desc: undefined, config: { bgMode: 'photo' } },
  )
})

const mountModal = () => mount(TemplatePickerModal, { props: { modelValue: true }, attachTo: document.body })

describe('分组与渲染', () => {
  it('内置/我的模板分组展示，自定义分组仅在有数据时出现', () => {
    const w = mountModal()
    const groups = w.findAll('.tp-group').map((g) => g.text())
    expect(groups.join(' ')).toContain('内置模板')
    expect(groups.join(' ')).toContain('我的模板')
    expect(w.findAll('.tp-card').length).toBe(3)
    w.unmount()
  })

  it('默认选中第一个内置模板，右栏显示其名称与 desc', async () => {
    const w = mountModal()
    await flushPromises()
    expect(w.find('.tp-preview-name').text()).toBe('白框参数卡')
    expect(w.find('.tp-preview-desc').text()).toBe('经典白底等宽边框')
    expect(w.find('.tp-card.active').text()).toContain('白框参数卡')
    w.unmount()
  })

  it('大预览使用当前照片合成（renderTemplateThumbDataUrl 收到 photoSrc 与 960 上限）', async () => {
    const w = mountModal()
    await flushPromises()
    const args = renderThumb.mock.calls[0]
    expect(args[1]).toBe('blob:photo-1')
    expect(args[2]).toBe(960)
    expect(w.find('.tp-preview-img').attributes('src')).toBe('data:image/jpeg;base64,BIG')
    w.unmount()
  })
})

describe('点卡即应用', () => {
  it('点击卡片：应用模板 + 选中高亮 + 展开右栏，弹窗不关闭', async () => {
    const w = mountModal()
    const card = w.findAll('.tp-card')[1]
    await card.trigger('click')
    await flushPromises()
    expect(applyMock).toHaveBeenCalledWith({ bgMode: 'blur' })
    expect(setPanelMock).toHaveBeenCalledWith('right', 'background', true)
    expect(w.find('.tp-card.active').text()).toContain('圆角悬浮·模糊延展')
    expect(w.find('.tp-modal').exists()).toBe(true)
    w.unmount()
  })
})

describe('批量与删除', () => {
  it('右栏批量按钮按选中照片数显示目标（选中1张）', async () => {
    const w = mountModal()
    expect(w.find('.batch-main').text()).toContain('1 张')
    w.unmount()
  })

  it('点击批量按钮：applyTemplateToPhotos 收到选中照片 ids 与模板名', async () => {
    const w = mountModal()
    await w.find('.batch-main').trigger('click')
    await flushPromises()
    expect(applyBatchMock).toHaveBeenCalledWith(['p1'], expect.anything(), '应用模板「白框参数卡」')
    w.unmount()
  })

  it('自定义模板悬停区删除：调用 remove 并清空选中态', async () => {
    const w = mountModal()
    const customCard = w.findAll('.tp-card')[2]
    await customCard.find('.tp-card-del').trigger('click')
    expect(removeMock).toHaveBeenCalledWith('c1')
    w.unmount()
  })
})
```

（`mockItems` 需在 `useLibrary` mock 之前定义且使用 `reactive`；`attachTo: document.body` 保证 Teleport 内容可查。）

Run: `npx vitest run src/components/controls/TemplatePickerModal.test.ts`
Expected: FAIL（先补测试）→ 实现已在 Task 1 Step 2/2b 就位 → PASS

- [ ] **Step 2: 补齐组件实现使其满足（若 Task 1 已全量实现则直接验证）**

确保组件满足上述全部断言（分组标题、默认选中第一项、右栏 desc 显示、批量文案、applyMock 参数形状）。若 `applyMock` 收到的参数是模板 config 对象而非模板对象，以 `applyTemplateToState(found.config)` 为准（断言匹配 config）。

- [ ] **Step 3: 跑测试**

Run: `npx vitest run src/components/controls/TemplatePickerModal.test.ts`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add src/components/controls/TemplatePickerModal.test.ts
git -c user.name=yuhaowang774 -c user.email=yuhaowang774@users.noreply.github.com commit -m "test: 模板选择弹窗组件测试（分组渲染/默认选中/当前照片大预览/批量/删除）"
```

***

### Task 4: CollapsiblePanel 标题点击弹出 + LeftPanels 接入

**Files:**

- Modify: `src/components/common/CollapsiblePanel.vue`（titleAction、emit popup，默认行为不变）

- Create: `src/components/common/CollapsiblePanel.test.ts`

- Modify: `src/components/layout/LeftPanels.vue`（相框模板库面板 titleAction=popup，挂载 TemplatePickerModal，删除 TemplatePanel 引用）

- Delete: `src/components/layout/TemplatePanel.vue`

- [ ] **Step 1: 写 CollapsiblePanel 失败测试**

```ts
// src/components/common/CollapsiblePanel.test.ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import CollapsiblePanel from './CollapsiblePanel.vue'

describe('CollapsiblePanel titleAction', () => {
  it('默认（toggle）：点击标题 emit toggle', async () => {
    const w = mount(CollapsiblePanel, { props: { title: '面板', open: true } })
    await w.find('.panel-head').trigger('click')
    expect(w.emitted('toggle')).toBeTruthy()
  })

  it('titleAction=popup：点击标题 emit popup 且不 emit toggle', async () => {
    const w = mount(CollapsiblePanel, { props: { title: '相框模板库', open: false, titleAction: 'popup' } })
    await w.find('.panel-head').trigger('click')
    expect(w.emitted('popup')).toHaveLength(1)
    expect(w.emitted('toggle')).toBeUndefined()
  })
})
```

Run: `npx vitest run src/components/common/CollapsiblePanel.test.ts`
Expected: FAIL（titleAction 未实现）

- [ ] **Step 2: 实现 CollapsiblePanel**

```vue
<script setup lang="ts">
import { ref } from 'vue'

const props = withDefaults(
  defineProps<{
    title: string
    open: boolean
    badge?: string | number
    /** popup：点击标题改为 emit popup（供弹窗式入口），默认 toggle 保持折叠语义 */
    titleAction?: 'toggle' | 'popup'
  }>(),
  { badge: undefined, titleAction: 'toggle' },
)
const emit = defineEmits<{ toggle: []; popup: [] }>()

const hover = ref(false)

function onHeadClick() {
  if (props.titleAction === 'popup') emit('popup')
  else emit('toggle')
}
</script>

<template>
  <section class="panel" :class="{ open: props.open }">
    <header
      class="panel-head"
      :class="{ hover }"
      @click="onHeadClick"
      @mouseenter="hover = true"
      @mouseleave="hover = false"
    >
      <span v-if="$slots.icon" class="icon"><slot name="icon" /></span>
      <span class="title">{{ props.title }}</span>
      <span v-if="props.badge != null && props.badge !== ''" class="badge">{{ props.badge }}</span>
      <span v-if="$slots.actions" class="actions" @click.stop><slot name="actions" /></span>
      <span class="twisty">{{ props.open ? '▾' : '▸' }}</span>
    </header>
    <div v-show="props.open" class="panel-body">
      <slot />
    </div>
  </section>
</template>

<style scoped>
/* 样式与现文件 Panel 1:1 保留，仅 header @click 换为 onHeadClick */
</style>
```

（样式块保持现文件内容不变，仅脚本与模板头两行变化。）

Run: `npx vitest run src/components/common/CollapsiblePanel.test.ts`
Expected: PASS

- [ ] **Step 3: LeftPanels 接入弹窗**

```vue
<!-- LeftPanels.vue 变更点 -->
<script setup lang="ts">
// 移除：import TemplatePanel from './TemplatePanel.vue'
import { ref } from 'vue'
import TemplatePickerModal from '../controls/TemplatePickerModal.vue'
const pickerOpen = ref(false)
// …其余保持
</script>

<template>
  <aside class="left-panels" :style="{ width: app.leftWidthPx.value }">
    <!-- 其余面板保持不变 -->

    <CollapsiblePanel
      title="相框模板库"
      :open="P.frameTemplates"
      :title-action="'popup'"
      @popup="pickerOpen = true"
      @toggle="app.togglePanel('left', 'frameTemplates')"
    >
      <p class="tpl-hint">点击上方标题打开模板选择器</p>
    </CollapsiblePanel>

    <!-- 其余面板保持不变 -->
  </aside>
  <TemplatePickerModal v-model="pickerOpen" category="frame" />
</template>
```

样式：`.tpl-hint { font-size: 12px; color: var(--text-dim); }` 加入 `<style scoped>`。

`title-action` 的 TS 传递：`titleAction="popup"` 映射字符串 prop，需用 `:title-action="'popup'"` 或直接 `title-action="popup"`（v-bind 布尔陷阱：字符串常量在运行时是字符串，`think="popup"` 会原样传。为稳妥用 `:title-action="'popup'"`）。

- [ ] **Step 4: 删除 TemplatePanel.vue**

```bash
git rm src/components/layout/TemplatePanel.vue
```

同时确认无其它文件 import 它：`rg -n "TemplatePanel" src` 应仅剩 LeftPanels 的删除痕迹（清理干净）。

- [ ] **Step 5: 类型检查 + 全量测试**

Run: `npx vue-tsc -b && npx vitest run`
Expected: 0 error；全部 PASS（含新增 CollapsiblePanel 与 TemplatePickerModal 测试）

- [ ] **Step 6: Commit**

```bash
git add src/components/common/CollapsiblePanel.vue src/components/common/CollapsiblePanel.test.ts src/components/layout/LeftPanels.vue
git -c user.name=yuhaowang774 -c user.email=yuhaowang774@users.noreply.github.com commit -m "feat: 左栏「相框模板库」标题点击弹出模板选择器；CollapsiblePanel 支持 titleAction=popup；删除 TemplatePanel"
```

***

### Task 5: 双端同步与构建验证

**Files:**

- Copy: `src/components/controls/TemplatePickerModal.vue`、`src/components/controls/TemplatePickerModal.test.ts`、`src/components/common/CollapsiblePanel.vue`、`src/components/common/CollapsiblePanel.test.ts`、`src/components/layout/LeftPanels.vue`、`src/composables/useTemplates.ts` → `d:\A\frame\src\` 对应路径

- Delete: `d:\A\frame\src\components\layout\TemplatePanel.vue`

- [ ] **Step 1: 同步到 frame 仓库**

```powershell
Copy-Item d:\A\FrameLab\src\components\controls\TemplatePickerModal.vue d:\A\frame\src\components\controls\ -Force
Copy-Item d:\A\FrameLab\src\components\controls\TemplatePickerModal.test.ts d:\A\frame\src\components\controls\ -Force
Copy-Item d:\A\FrameLab\src\components\common\CollapsiblePanel.vue d:\A\frame\src\components\common\ -Force
Copy-Item d:\A\FrameLab\src\components\common\CollapsiblePanel.test.ts d:\A\frame\src\components\common\ -Force
Copy-Item d:\A\FrameLab\src\components\layout\LeftPanels.vue d:\A\frame\src\components\layout\ -Force
Copy-Item d:\A\FrameLab\src\composables\useTemplates.ts d:\A\frame\src\composables\ -Force
Remove-Item d:\A\frame\src\components\layout\TemplatePanel.vue -Force
```

- [ ] **Step 2: frame 端验证**

```powershell
cd d:\A\frame
npm run build
npm test
```

Expected: build 成功；176+ 用例（新增 CollapsiblePanel 4 条 + TemplatePickerModal N 条）全 PASS

- [ ] **Step 3: 双端 git 提交**

```bash
git -C d:\A\FrameLab -c user.name=yuhaowang774 -c user.email=yuhaowang774@users.noreply.github.com commit -am "chore: 模板选择弹窗双端同步" # 或按实际改动文件 add
git -C d:\A\frame -c user.name=yuhaowang774 -c user.email=yuhaowang774@users.noreply.github.com add -A
git -C d:\A\frame -c user.name=yuhaowang774 -c user.email=yuhaowang774@users.noreply.github.com commit -m "feat: 同步模板选择弹窗"
```

- [ ] **Step 4: DEV 版人工验收**

确认 tauri dev 进程在跑（PID 有 framelab）；浏览器打开 `http://localhost:5180`：

1. 左栏点「相框模板库」标题 → 弹出弹窗
2. 网格展示内置+自定义；点卡片 → 画布立即变化、右栏大预览为"当前照片+模板"合成、卡片高亮、弹窗不关
3. 「⇉ 批量应用到 N 张」、自定义删除、INFO 缺失提示可用
4. × / 完成 / Esc / 遮罩点击均关闭

***

## Self-Review

- **Spec 覆盖**：入口弹窗（Task 4）✅；左右分栏+点卡即应用（Task 1）✅；大预览当前照片合成（Task 1/3）✅；批量+删除+缺失提示（Task 1/3）✅；空库提示（Task 1）✅；窄视口堆叠（Task 1 @media）✅；内置描述（Task 2）✅；测试计划（Task 1/3/4）✅；双端同步（Task 5）✅

- **占位符**：无 TBD/TODO；Task 2 的"文案示例"明确按模板逐一对应，未留空洞

- **类型一致性**：`selectAndApply`/`applyBatch`/`removeCustom` 在 Step 2b 定义并被模板引用；`titleAction` prop 在 CollapsiblePanel 定义并在 LeftPanels 使用；`renderThumb` mock 断言第 3 参 960 与实现一致；`applyTemplateToPhotos` 签名与 useHistory 一致

- **注意**：Task 1 Step 3 的运行期未定义风险已通过 Step 2b 一次性补齐消除；`titleAction` 传值采用绑定写法避免布尔/字符串陷阱

