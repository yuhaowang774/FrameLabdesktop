<script setup lang="ts">
// PS 式图层面板：自顶向下列出图层（顶层在上），支持选中与可见性开关。
import { useLayers } from '../../composables/useLayers'

const { panelLayers, selectedLayer, isVisible, toggleVisible, select } = useLayers()
</script>

<template>
  <section class="control-block layer-panel">
    <h4>图层</h4>
    <ul class="layer-list">
      <li
        v-for="layer in panelLayers"
        :key="layer.id"
        class="layer-row"
        :class="{ active: selectedLayer === layer.id }"
        @click="select(layer.id)"
      >
        <button
          class="eye"
          type="button"
          :disabled="!layer.hideable"
          :title="layer.hideable ? (isVisible(layer.id) ? '隐藏图层' : '显示图层') : '画板不可隐藏'"
          @click.stop="toggleVisible(layer.id)"
        >
          <span v-if="!layer.hideable">▣</span>
          <span v-else>{{ isVisible(layer.id) ? '👁' : '🚫' }}</span>
        </button>
        <span class="layer-name">{{ layer.label }}</span>
        <span class="layer-z">z{{ layer.z }}</span>
      </li>
    </ul>
    <p class="hint">点击图层可在画布中选中并编辑；眼睛图标控制显示/隐藏。</p>
  </section>
</template>

<style scoped>
.layer-panel {
  margin: 0;
}
.layer-list {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.layer-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid transparent;
  cursor: pointer;
  user-select: none;
  transition: background 0.12s, border-color 0.12s;
}
.layer-row:hover {
  background: var(--panel-hover);
}
.layer-row.active {
  background: var(--accent-bg);
  border-color: var(--accent-border);
}
.eye {
  flex: none;
  width: 24px;
  height: 24px;
  display: grid;
  place-items: center;
  font-size: 13px;
  border-radius: 6px;
  border: 1px solid var(--panel-border);
  background: rgba(0, 0, 0, 0.2);
  color: var(--text-normal);
  cursor: pointer;
}
.eye:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}
.eye:not(:disabled):hover {
  background: var(--accent-bg);
  border-color: var(--accent-border);
}
.layer-name {
  flex: 1;
  font-size: 13px;
  color: var(--text-normal);
}
.layer-z {
  font-size: 11px;
  color: var(--text-muted);
  font-variant-numeric: tabular-nums;
}
.hint {
  margin: 10px 0 0;
  font-size: 11px;
  line-height: 1.5;
  color: var(--text-muted);
}
</style>
