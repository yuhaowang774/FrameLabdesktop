<script setup lang="ts">
// 「发现新版本」提醒卡片（右下角浮层）：启动自动检查命中新版本后主动提示。
// 动作：立即更新（下载 / 静默安装 / 自动重启）｜稍后（本次会话不再提示）｜跳过此版本（该版本不再提示）。
// 启动调度放在本组件（App 根级常驻挂载点）：onMounted 触发一次延迟静默检查，幂等无副作用。
import { computed, onMounted } from 'vue'
import { isTauri } from '../../platform/env'
import { useUpdater, scheduleStartupUpdateCheck } from '../../composables/useUpdater'

const {
  available,
  installState,
  installProgress,
  installError,
  installUpdate,
  dismissUpdate,
  skipUpdateVersion,
} = useUpdater()

onMounted(() => scheduleStartupUpdateCheck())

const RELEASES_URL = 'https://github.com/yuhaowang774/FrameLabdesktop/releases/latest'

const busy = computed(
  () =>
    installState.value === 'downloading' ||
    installState.value === 'installing' ||
    installState.value === 'restarting',
)

const statusText = computed(() => {
  switch (installState.value) {
    case 'downloading':
      return installProgress.value === null ? '正在下载…' : `正在下载 ${installProgress.value}%`
    case 'installing':
      return '正在静默安装…'
    case 'restarting':
      return '安装完成，正在重启应用…'
    default:
      return ''
  }
})

async function openReleases() {
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('open_external', { url: RELEASES_URL })
  } catch {
    window.open(RELEASES_URL, '_blank')
  }
}
</script>

<template>
  <Teleport to="body">
    <div v-if="isTauri && available" class="un-box">
      <div class="un-head">
        <span class="un-title">发现新版本</span>
        <button v-if="!busy" class="un-close" title="稍后" @click="dismissUpdate">×</button>
      </div>

      <div class="un-body">
        <div class="un-ver">
          <span class="ver-new">v{{ available.version }}</span>
          <span v-if="available.date" class="ver-date">{{ available.date.slice(0, 10) }}</span>
        </div>
        <p v-if="available.notes" class="un-notes">{{ available.notes }}</p>
        <p v-if="busy" class="un-status">{{ statusText }}</p>
        <p v-else-if="installState === 'error'" class="un-error">
          更新失败：{{ installError }}<br />
          可重试，或到 GitHub Releases 手动下载安装包。
        </p>
      </div>

      <div class="un-foot">
        <template v-if="busy">
          <div class="un-progress"><div class="un-bar" :style="{ width: (installProgress ?? 0) + '%' }" /></div>
        </template>
        <template v-else-if="installState === 'error'">
          <button class="un-btn" @click="dismissUpdate">关闭</button>
          <button class="un-btn" @click="openReleases">手动下载</button>
          <button class="un-btn primary" @click="installUpdate">重试</button>
        </template>
        <template v-else>
          <button class="un-btn" @click="skipUpdateVersion">跳过此版本</button>
          <button class="un-btn" @click="dismissUpdate">稍后</button>
          <button class="un-btn primary" @click="installUpdate">立即更新</button>
        </template>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.un-box {
  position: fixed;
  right: 16px;
  bottom: 16px;
  width: min(340px, calc(100vw - 32px));
  z-index: 990; /* 低于弹窗层（1000+）：首选项/更新记录打开时不被遮挡其上 */
  display: flex;
  flex-direction: column;
  background: var(--panel);
  border: 1px solid var(--border);
  box-shadow: 0 16px 44px rgba(0, 0, 0, 0.45);
}
.un-head {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 34px;
  padding: 0 6px 0 12px;
  border-bottom: 1px solid var(--border);
}
.un-title {
  font-size: 12px;
  color: var(--text);
}
.un-close {
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  color: var(--text-dim);
  font-size: 14px;
  cursor: pointer;
}
.un-close:hover {
  background: var(--hover);
  color: var(--text-normal);
}
.un-body {
  padding: 10px 12px;
}
.un-ver {
  display: flex;
  align-items: baseline;
  gap: 8px;
}
.ver-new {
  font-size: 15px;
  font-weight: 600;
  color: var(--text);
}
.ver-date {
  font-size: 11px;
  color: var(--text-dim);
}
.un-notes {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 17px;
  color: var(--text-dim);
  white-space: pre-line;
  max-height: 68px; /* 约 4 行，超出滚动 */
  overflow-y: auto;
  overflow-wrap: anywhere;
}
.un-status {
  margin: 8px 0 0;
  font-size: 12px;
  color: var(--text-normal);
}
.un-error {
  margin: 8px 0 0;
  font-size: 12px;
  line-height: 17px;
  color: var(--text-dim);
  overflow-wrap: anywhere;
}
.un-foot {
  flex: none;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px 10px;
  border-top: 1px solid var(--border);
}
.un-foot > .un-btn:first-child {
  margin-right: auto; /* 文字按钮左置（跳过此版本 / 关闭），动作按钮右置 */
}
.un-btn {
  height: 26px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 0;
  background: transparent;
  color: var(--text-dim);
  font-size: 12px;
  cursor: pointer;
}
.un-btn:hover {
  background: var(--hover);
  color: var(--text-normal);
}
.un-btn.primary {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--text);
  padding: 0 14px;
}
.un-btn.primary:hover {
  filter: brightness(1.1);
}
.un-btn.primary:active {
  filter: brightness(0.95);
}
.un-progress {
  flex: 1;
  height: 4px;
  background: var(--panel-3);
  overflow: hidden;
}
.un-bar {
  height: 100%;
  background: var(--accent);
  transition: width 0.15s ease;
}
</style>
