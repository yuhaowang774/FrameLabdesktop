<script setup lang="ts">
// 顶层 INFO 信息设置面板（对标 LrC 折叠分组）
// ----------------------------------------------------------------------------
// 结构：
//   1. INFO 全局：绑定目标切换（canvas/photo）、总开关
//   2. 元素列表：选中、显隐、删除、层级
//   3. 动态表单：按元素 type 渲染不同配置项（文字/EXIF/Logo/分割线）
//   4. 多选工具栏：对齐、分布、智能吸附开关
import { computed } from 'vue'
import { useInfoLayer } from '../../composables/useInfoLayer'
import { useLogoStore } from '../../composables/useLogoStore'
import { BRANDS } from '../../core/constants'
import type { InfoElement, LogoInfoElement, TextInfoElement, ExifInfoElement, DividerInfoElement } from '../../core/types'

const { layer, elements, selected, selectedIds, selectedCount, snapEnabled, selectOnly, selectAll, clearSelection, addElement, deleteElements, updateElement, bringToFront, sendToBack, align, distribute, setBindTarget, setEnabled } = useInfoLayer()
const { listCustomLogos } = useLogoStore()

const customLogos = computed(() => listCustomLogos())

function typeLabel(t: InfoElement['type']): string {
  return { text: '文字', exif: 'EXIF', logo: 'Logo', divider: '分割线' }[t]
}

// 动态表单绑定辅助
function setField(el: InfoElement, key: string, val: any) {
  updateElement(el.id, { [key]: val } as any)
}

const brandOptions = computed(() => [
  { id: 'none', label: '无' },
  ...BRANDS.map((b) => ({ id: b.id, label: b.name })),
  ...customLogos.value.map((c) => ({ id: `custom:${c.id}`, label: c.name })),
])
</script>

<template>
  <div class="info-panel">
    <!-- 1. INFO 全局 -->
    <div class="group">
      <div class="group-title">INFO 全局</div>
      <label class="row">
        <span>总开关</span>
        <input type="checkbox" :checked="layer.enabled" @change="setEnabled(($event.target as HTMLInputElement).checked)" />
      </label>
      <div class="row">
        <span>绑定目标</span>
        <div class="seg">
          <button :class="{ active: layer.bindTarget === 'canvas' }" @click="setBindTarget('canvas')">画布</button>
          <button :class="{ active: layer.bindTarget === 'photo' }" @click="setBindTarget('photo')">主照片</button>
        </div>
      </div>
      <p class="hint">画布：元素基于画布坐标；主照片：整体继承照片变换，坐标为照片局部。</p>
    </div>

    <!-- 添加元素 -->
    <div class="group">
      <div class="group-title">添加元素</div>
      <div class="add-row">
        <button @click="addElement('text')">+ 文字</button>
        <button @click="addElement('exif')">+ EXIF</button>
        <button @click="addElement('logo')">+ Logo</button>
        <button @click="addElement('divider')">+ 分割线</button>
      </div>
    </div>

    <!-- 多选工具栏 -->
    <div v-if="selectedCount >= 2" class="group">
      <div class="group-title">多选排版（{{ selectedCount }} 个）</div>
      <div class="toolbar">
        <button title="左对齐" @click="align('left')">⬅</button>
        <button title="水平居中" @click="align('hcenter')">⬌</button>
        <button title="右对齐" @click="align('right')">➡</button>
        <button title="顶对齐" @click="align('top')">⬆</button>
        <button title="垂直居中" @click="align('vcenter')">⬍</button>
        <button title="底对齐" @click="align('bottom')">⬇</button>
        <span class="sep"></span>
        <button title="水平分布" @click="distribute('h')">⇿</button>
        <button title="垂直分布" @click="distribute('v')">⇳</button>
        <span class="sep"></span>
        <button title="置顶" @click="bringToFront()">⤒</button>
        <button title="置底" @click="sendToBack()">⤓</button>
      </div>
      <label class="row">
        <span>智能吸附</span>
        <input type="checkbox" v-model="snapEnabled" />
      </label>
    </div>

    <!-- 元素列表 -->
    <div class="group">
      <div class="group-title">元素列表</div>
      <div v-if="elements.length === 0" class="empty">暂无元素，请先添加。</div>
      <ul class="el-list">
        <li
          v-for="el in [...elements].sort((a, b) => a.zIndex - b.zIndex)"
          :key="el.id"
          :class="{ active: selectedIds.has(el.id) }"
          @click="selectOnly(el.id)"
        >
          <input
            type="checkbox"
            :checked="el.enable"
            @click.stop
            @change="setField(el, 'enable', ($event.target as HTMLInputElement).checked)"
          />
          <span class="el-type">{{ typeLabel(el.type) }}</span>
          <span class="el-name">{{ el.type === 'text' ? (el as TextInfoElement).text.slice(0, 8) : el.type === 'logo' ? (el as LogoInfoElement).logoId : el.type === 'exif' ? 'EXIF' : '分割线' }}</span>
          <span class="el-actions">
            <button title="置顶" @click.stop="bringToFront([el.id])">⤒</button>
            <button title="置底" @click.stop="sendToBack([el.id])">⤓</button>
            <button title="删除" @click.stop="deleteElements([el.id])">✕</button>
          </span>
        </li>
      </ul>
      <div v-if="elements.length" class="list-ops">
        <button @click="selectAll">全选</button>
        <button @click="clearSelection">取消</button>
        <button class="danger" @click="deleteElements()">删除选中</button>
      </div>
    </div>

    <!-- 3. 动态表单 -->
    <div v-if="selectedCount === 1 && selected[0]" class="group">
      <div class="group-title">元素属性 · {{ typeLabel(selected[0].type) }}</div>
      <div class="form">
        <!-- 位置 / 缩放 / 旋转 / 通用 -->
        <label class="row"><span>X</span><input type="number" :value="round2(selected[0].x)" @change="setField(selected[0], 'x', +($event.target as HTMLInputElement).value)" /></label>
        <label class="row"><span>Y</span><input type="number" :value="round2(selected[0].y)" @change="setField(selected[0], 'y', +($event.target as HTMLInputElement).value)" /></label>
        <label class="row"><span>缩放</span><input type="number" step="0.05" :value="selected[0].scale" @change="setField(selected[0], 'scale', +($event.target as HTMLInputElement).value)" /></label>
        <label class="row"><span>旋转°</span><input type="number" :value="selected[0].rotate" @change="setField(selected[0], 'rotate', +($event.target as HTMLInputElement).value)" /></label>
        <label class="row"><span>层级</span><input type="number" :value="selected[0].zIndex" @change="setField(selected[0], 'zIndex', +($event.target as HTMLInputElement).value)" /></label>
        <label class="row"><span>不透明</span><input type="range" min="0" max="1" step="0.05" :value="selected[0].opacity" @input="setField(selected[0], 'opacity', +($event.target as HTMLInputElement).value)" /></label>
        <label class="row"><span>导出</span><input type="checkbox" :checked="selected[0].exportable" @change="setField(selected[0], 'exportable', ($event.target as HTMLInputElement).checked)" /></label>

        <!-- 文字 -->
        <template v-if="selected[0].type === 'text'">
          <label class="row col"><span>内容</span><textarea :value="(selected[0] as TextInfoElement).text" @change="setField(selected[0], 'text', ($event.target as HTMLTextAreaElement).value)"></textarea></label>
          <label class="row"><span>字号</span><input type="number" :value="(selected[0] as TextInfoElement).fontSize" @change="setField(selected[0], 'fontSize', +($event.target as HTMLInputElement).value)" /></label>
          <label class="row"><span>字重</span><input type="number" :value="(selected[0] as TextInfoElement).fontWeight" @change="setField(selected[0], 'fontWeight', +($event.target as HTMLInputElement).value)" /></label>
          <label class="row"><span>颜色</span><input type="color" :value="(selected[0] as TextInfoElement).color" @input="setField(selected[0], 'color', ($event.target as HTMLInputElement).value)" /></label>
          <label class="row"><span>对齐</span>
            <select :value="(selected[0] as TextInfoElement).align" @change="setField(selected[0], 'align', ($event.target as HTMLSelectElement).value)">
              <option value="left">左</option><option value="center">中</option><option value="right">右</option>
            </select>
          </label>
          <label class="row"><span>字距</span><input type="number" step="0.5" :value="(selected[0] as TextInfoElement).letterSpacing" @change="setField(selected[0], 'letterSpacing', +($event.target as HTMLInputElement).value)" /></label>
          <label class="row"><span>行高</span><input type="number" step="0.1" :value="(selected[0] as TextInfoElement).lineHeight" @change="setField(selected[0], 'lineHeight', +($event.target as HTMLInputElement).value)" /></label>
        </template>

        <!-- EXIF -->
        <template v-else-if="selected[0].type === 'exif'">
          <label class="row col"><span>模板</span><input :value="(selected[0] as ExifInfoElement).template" @change="setField(selected[0], 'template', ($event.target as HTMLInputElement).value)" /><small>可用 {model}{focal}{aperture}{shutter}{iso}</small></label>
          <label class="row"><span>字号</span><input type="number" :value="(selected[0] as ExifInfoElement).fontSize" @change="setField(selected[0], 'fontSize', +($event.target as HTMLInputElement).value)" /></label>
          <label class="row"><span>字重</span><input type="number" :value="(selected[0] as ExifInfoElement).fontWeight" @change="setField(selected[0], 'fontWeight', +($event.target as HTMLInputElement).value)" /></label>
          <label class="row"><span>颜色</span><input type="color" :value="(selected[0] as ExifInfoElement).color" @input="setField(selected[0], 'color', ($event.target as HTMLInputElement).value)" /></label>
          <label class="row"><span>对齐</span>
            <select :value="(selected[0] as ExifInfoElement).align" @change="setField(selected[0], 'align', ($event.target as HTMLSelectElement).value)">
              <option value="left">左</option><option value="center">中</option><option value="right">右</option>
            </select>
          </label>
          <label class="row"><span>字距</span><input type="number" step="0.5" :value="(selected[0] as ExifInfoElement).letterSpacing" @change="setField(selected[0], 'letterSpacing', +($event.target as HTMLInputElement).value)" /></label>
        </template>

        <!-- Logo -->
        <template v-else-if="selected[0].type === 'logo'">
          <label class="row"><span>来源</span>
            <select :value="(selected[0] as LogoInfoElement).logoId" @change="setField(selected[0], 'logoId', ($event.target as HTMLSelectElement).value)">
              <option v-for="o in brandOptions" :key="o.id" :value="o.id">{{ o.label }}</option>
            </select>
          </label>
          <label class="row"><span>宽度</span><input type="number" :value="(selected[0] as LogoInfoElement).baseWidth" @change="setField(selected[0], 'baseWidth', +($event.target as HTMLInputElement).value)" /></label>
        </template>

        <!-- 分割线 -->
        <template v-else-if="selected[0].type === 'divider'">
          <label class="row"><span>长度</span><input type="number" :value="(selected[0] as DividerInfoElement).width" @change="setField(selected[0], 'width', +($event.target as HTMLInputElement).value)" /></label>
          <label class="row"><span>线宽</span><input type="number" :value="(selected[0] as DividerInfoElement).thickness" @change="setField(selected[0], 'thickness', +($event.target as HTMLInputElement).value)" /></label>
          <label class="row"><span>颜色</span><input type="color" :value="(selected[0] as DividerInfoElement).color" @input="setField(selected[0], 'color', ($event.target as HTMLInputElement).value)" /></label>
        </template>
      </div>
    </div>

    <div v-else-if="selectedCount === 0" class="group">
      <p class="hint">点击画布或列表中的元素进行编辑、拖拽、缩放与旋转。</p>
    </div>
  </div>
</template>

<script lang="ts">
function round2(n: number): number {
  return Math.round(n * 100) / 100
}
export default { methods: { round2 } }
</script>

<style scoped>
.info-panel { padding: 4px 0; }
.group { padding: 8px 10px; border-bottom: 1px solid var(--c-border, #2a2a2a); }
.group-title { font-size: 11px; font-weight: 600; color: #9aa0a6; text-transform: uppercase; letter-spacing: .04em; margin-bottom: 6px; }
.row { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin: 4px 0; font-size: 12px; color: #cfd3d8; }
.row.col { flex-direction: column; align-items: stretch; }
.row.col small { color: #777; font-size: 10px; margin-top: 2px; }
.row input[type='number'], .row select, .row textarea { width: 120px; background: #1d1f22; color: #e8eaed; border: 1px solid #333; border-radius: 4px; padding: 3px 5px; font-size: 12px; }
.row textarea { width: 100%; min-height: 48px; resize: vertical; }
.row input[type='range'] { width: 120px; }
.seg { display: inline-flex; border: 1px solid #333; border-radius: 4px; overflow: hidden; }
.seg button { background: #1d1f22; color: #cfd3d8; border: none; padding: 3px 10px; font-size: 12px; cursor: pointer; }
.seg button.active { background: #4da3ff; color: #fff; }
.add-row { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.add-row button { background: #23262b; color: #e8eaed; border: 1px solid #333; border-radius: 4px; padding: 6px; cursor: pointer; font-size: 12px; }
.add-row button:hover { border-color: #4da3ff; }
.hint { font-size: 11px; color: #888; line-height: 1.5; margin: 4px 0 0; }
.empty { font-size: 12px; color: #777; padding: 6px 0; }
.toolbar { display: flex; flex-wrap: wrap; gap: 4px; align-items: center; }
.toolbar button { background: #23262b; border: 1px solid #333; color: #e8eaed; border-radius: 4px; width: 28px; height: 26px; cursor: pointer; font-size: 13px; }
.toolbar button:hover { border-color: #4da3ff; }
.toolbar .sep { width: 1px; height: 20px; background: #333; margin: 0 2px; }
.el-list { list-style: none; margin: 0; padding: 0; max-height: 220px; overflow: auto; }
.el-list li { display: flex; align-items: center; gap: 6px; padding: 4px 6px; border-radius: 4px; cursor: pointer; font-size: 12px; color: #cfd3d8; }
.el-list li.active { background: #2b3a4d; }
.el-list li:hover { background: #23262b; }
.el-type { background: #333; color: #ccc; border-radius: 3px; padding: 0 5px; font-size: 10px; }
.el-name { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.el-actions { display: flex; gap: 2px; }
.el-actions button { background: transparent; border: none; color: #aaa; cursor: pointer; font-size: 12px; padding: 0 2px; }
.el-actions button:hover { color: #4da3ff; }
.list-ops { display: flex; gap: 6px; margin-top: 6px; }
.list-ops button { flex: 1; background: #23262b; border: 1px solid #333; color: #cfd3d8; border-radius: 4px; padding: 4px; font-size: 11px; cursor: pointer; }
.list-ops button.danger { color: #ff6b6b; }
.list-ops button:hover { border-color: #4da3ff; }
.form { display: flex; flex-direction: column; gap: 2px; }
</style>
