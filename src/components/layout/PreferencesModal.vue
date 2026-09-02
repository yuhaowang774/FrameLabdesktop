<script setup lang="ts">
// 首选项弹窗：分组设置（性能 / 导出 / 编辑 / 数据 / 关于）。
// 布局参考主流桌面应用（VS Code / Figma）的设置页：标题+描述左置、控件右置、分组卡片分隔；
// 视觉沿用 FrameLab 的方正极简语言（细边框、直角、小字号），开关控件用圆角胶囊以提升可辨识度。
// 桌面端由原生菜单「文件 → 首选项…」/ Ctrl+, 触发；网页端通过顶栏 ⚙ 打开，两侧均可访问。
import { ref, computed, onMounted } from 'vue'
import { isTauri } from '../../platform/env'
import {
  listGpus,
  getGpuSelection,
  setGpuSelection,
  openGraphicsSettings,
  type GpuInfo,
} from '../../platform/gpu'
import {
  getExportFormatPref,
  setExportFormatPref,
  getExportQualityPref,
  setExportQualityPref,
  HISTORY_LIMIT_OPTIONS,
  getHistoryLimitPref,
  setHistoryLimitPref,
  getStartupTemplatePref,
  setStartupTemplatePref,
  type ExportFormatPref,
} from '../../composables/usePrefs'
import { useLibrary } from '../../composables/useLibrary'
import { useTemplates } from '../../composables/useTemplates'
import { clearAllHistoryNodes } from '../../composables/useHistoryDB'
import { listCustomLogos, removeCustomLogo } from '../../composables/useLogoStore'

const emit = defineEmits<{ (e: 'close'): void }>()
const library = useLibrary()
const templates = useTemplates()

// ===== 性能（显卡检测 + 下拉选择，仅桌面端）=====
const gpus = ref<GpuInfo[]>([])
const gpuSel = ref('auto')
const gpuSaving = ref(false)
const gpuLoading = ref(false)
async function refreshGpuStatus() {
  if (!isTauri) return
  gpuLoading.value = true
  gpuSel.value = getGpuSelection()
  try {
    gpus.value = await listGpus()
  } catch {
    gpus.value = []
  } finally {
    gpuLoading.value = false
  }
}
function onGpuSel(e: Event) {
  const sel = (e.target as HTMLSelectElement).value
  if (gpuSaving.value || sel === gpuSel.value) return
  gpuSaving.value = true
  const prev = gpuSel.value
  gpuSel.value = sel
  void setGpuSelection(sel)
    .catch(() => {
      gpuSel.value = prev
      window.alert('设置 GPU 首选项失败，可尝试在 Windows 图形设置中手动指定。')
    })
    .finally(() => {
      gpuSaving.value = false
    })
}
function onOpenGraphicsSettings() {
  void openGraphicsSettings().catch(() => window.alert('打开系统设置失败'))
}

// ===== 导出 =====
const exportFormat = ref<ExportFormatPref>(getExportFormatPref())
const exportQuality = ref(Math.round(getExportQualityPref() * 100))
function onFormat(v: ExportFormatPref) {
  exportFormat.value = v
  setExportFormatPref(v)
}
function onQuality() {
  setExportQualityPref(exportQuality.value / 100)
}

// ===== 编辑 =====
const historyLimit = ref(getHistoryLimitPref())
function onHistoryLimit(v: string) {
  historyLimit.value = Number(v)
  setHistoryLimitPref(historyLimit.value)
}
const startupTemplate = ref(getStartupTemplatePref())
const tplOptions = computed(() => [
  { value: '', label: '无（使用上次状态）' },
  ...templates.templates.filter((t) => t.builtin).map((t) => ({ value: t.id, label: t.name })),
])
function onStartupTemplate(v: string) {
  startupTemplate.value = v
  setStartupTemplatePref(v)
}

// ===== 数据（二次确认后执行）=====
const clearing = ref<string | null>(null)
async function runClear(kind: string) {
  if (clearing.value !== kind) {
    clearing.value = kind
    return
  }
  clearing.value = null
  if (kind === 'library') {
    library.clearAll()
    try {
      localStorage.removeItem('frame-active-photo')
    } catch {
      /* ignore */
    }
    await clearAllHistoryNodes()
  } else if (kind === 'logos') {
    for (const c of listCustomLogos()) await removeCustomLogo(c.id)
  } else if (kind === 'templates') {
    templates.clearCustom()
  }
}

// ===== 重启应用（仅桌面端）：退出并拉起新进程，让性能/数据类设置彻底生效 =====
const restarting = ref(false)
async function onRestart() {
  if (restarting.value) return
  restarting.value = true
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('restart_app')
  } catch {
    restarting.value = false
    window.alert('重启失败，请手动关闭应用后重新打开。')
  }
}

// ===== 软件更新（仅桌面端）：检查 → 下载（进度）→ 静默安装 → 自动重启 =====
// 更新源与签名公钥见 src-tauri/tauri.conf.json plugins.updater（GitHub Releases latest.json）。
type UpdState = 'idle' | 'checking' | 'downloading' | 'installing' | 'restarting' | 'latest' | 'error'
const updState = ref<UpdState>('idle')
const updVersion = ref('')
const updProgress = ref<number | null>(null)
const updError = ref('')
const updBusy = computed(
  () =>
    updState.value === 'checking' ||
    updState.value === 'downloading' ||
    updState.value === 'installing' ||
    updState.value === 'restarting',
)
const updDesc = computed(() => {
  switch (updState.value) {
    case 'checking':
      return '正在检查更新…'
    case 'downloading':
      return updProgress.value === null
        ? `发现新版本 v${updVersion.value}，正在下载…`
        : `发现新版本 v${updVersion.value}，正在下载 ${updProgress.value}%`
    case 'installing':
      return '下载完成，正在静默安装…'
    case 'restarting':
      return '安装完成，正在重启应用…'
    case 'latest':
      return '当前已是最新版本。'
    case 'error':
      return updError.value
    default:
      return '检查 GitHub Releases 上的新版本；发现后自动下载、静默安装并重启。'
  }
})
async function onCheckUpdate() {
  if (updBusy.value) return
  updState.value = 'checking'
  updProgress.value = null
  updError.value = ''
  try {
    const { check } = await import('@tauri-apps/plugin-updater')
    const update = await check()
    if (!update) {
      updState.value = 'latest'
      return
    }
    updVersion.value = update.version
    updState.value = 'downloading'
    let total = 0
    let received = 0
    await update.downloadAndInstall((event) => {
      if (event.event === 'Started') {
        total = event.data.contentLength ?? 0
      } else if (event.event === 'Progress') {
        received += event.data.chunkLength
        if (total > 0) updProgress.value = Math.min(99, Math.round((received / total) * 100))
      } else if (event.event === 'Finished') {
        updState.value = 'installing'
      }
    })
    // Windows passive 静默安装：downloadAndInstall 返回即安装完成，复用既有 restart_app 拉起新版本
    updState.value = 'restarting'
    const { invoke } = await import('@tauri-apps/api/core')
    await invoke('restart_app')
  } catch (err) {
    updState.value = 'error'
    updError.value = `更新失败：${(err as Error)?.message ?? err}（可到 GitHub Releases 页手动下载安装包）`
  }
}

// 应用版本：桌面端运行时读取 tauri.conf.json（与安装包严格一致）；Web 端用构建时注入的 package.json 版本
const APP_VERSION = ref(isTauri ? '' : __APP_VERSION__)
if (isTauri) {
  import('@tauri-apps/api/app')
    .then((m) => m.getVersion())
    .then((v) => {
      APP_VERSION.value = v
    })
    .catch(() => {
      APP_VERSION.value = __APP_VERSION__
    })
}

onMounted(() => {
  if (isTauri) void refreshGpuStatus()
})
</script>

<template>
  <div class="pref-mask" @click.self="emit('close')">
    <div class="pref-box">
      <div class="pref-head">
        <div class="pref-title-wrap">
          <span class="pref-title">首选项</span>
          <span class="pref-sub">调整应用行为与性能</span>
        </div>
        <button class="pref-close" title="关闭 (Esc)" @click="emit('close')">×</button>
      </div>

      <div class="pref-body">
        <!-- 性能 -->
        <section class="pf-sec">
          <h3 class="pf-sec-title">性能</h3>
          <div class="pf-row" v-if="isTauri">
            <div class="pf-text">
              <span class="pf-label">显卡选择</span>
              <span class="pf-desc">
                检测到的显示适配器如下（括号内为判定类型）；选择后立即写入系统首选项，重启应用生效。
              </span>
            </div>
            <select class="pf-select" :value="gpuSel" :disabled="gpuLoading || gpuSaving" @change="onGpuSel">
              <option v-if="gpuLoading" value="auto">正在检测显卡…</option>
              <template v-else>
                <option value="auto">自动（由系统决定）</option>
                <option v-for="g in gpus" :key="g.name" :value="g.name">
                  {{ g.name }}（{{ g.discrete ? '独显' : '核显' }}）
                </option>
              </template>
            </select>
          </div>
          <div class="pf-row" v-if="isTauri">
            <div class="pf-text">
              <span class="pf-label">Windows 图形设置</span>
              <span class="pf-desc">实际显卡由系统/驱动分配，可在此手动为 FrameLab 指定高性能。</span>
            </div>
            <button class="pf-btn" @click="onOpenGraphicsSettings">打开设置</button>
          </div>
        </section>

        <!-- 导出 -->
        <section class="pf-sec">
          <h3 class="pf-sec-title">导出</h3>
          <div class="pf-row">
            <div class="pf-text">
              <span class="pf-label">默认导出格式</span>
              <span class="pf-desc">打开导出页时默认选中的格式，导出时可临时切换。</span>
            </div>
            <div class="pf-seg">
              <button :class="{ on: exportFormat === 'png' }" @click="onFormat('png')">PNG 无损</button>
              <button :class="{ on: exportFormat === 'jpg' }" @click="onFormat('jpg')">JPG 高画质</button>
            </div>
          </div>
          <div v-if="exportFormat === 'jpg'" class="pf-row">
            <div class="pf-text">
              <span class="pf-label">默认 JPG 画质</span>
              <span class="pf-desc">数值越高文件越大、画质越好。</span>
            </div>
            <div class="pf-slider">
              <input type="range" min="50" max="100" step="1" v-model.number="exportQuality" @input="onQuality" />
              <span class="pf-val">{{ exportQuality }}%</span>
            </div>
          </div>
        </section>

        <!-- 编辑 -->
        <section class="pf-sec">
          <h3 class="pf-sec-title">编辑</h3>
          <div class="pf-row">
            <div class="pf-text">
              <span class="pf-label">历史记录上限</span>
              <span class="pf-desc">每张照片保留的撤销步数；超出后自动裁剪最早的步骤。</span>
            </div>
            <select class="pf-select" :value="historyLimit" @change="onHistoryLimit(($event.target as HTMLSelectElement).value)">
              <option v-for="n in HISTORY_LIMIT_OPTIONS" :key="n" :value="n">{{ n }} 步</option>
            </select>
          </div>
          <div class="pf-row">
            <div class="pf-text">
              <span class="pf-label">启动默认模板</span>
              <span class="pf-desc">打开应用时自动套用的相框模板（不覆盖照片本身）。</span>
            </div>
            <select class="pf-select" :value="startupTemplate" @change="onStartupTemplate(($event.target as HTMLSelectElement).value)">
              <option v-for="o in tplOptions" :key="o.value" :value="o.value">{{ o.label }}</option>
            </select>
          </div>
        </section>

        <!-- 数据 -->
        <section class="pf-sec">
          <h3 class="pf-sec-title">数据</h3>
          <div class="pf-row">
            <div class="pf-text">
              <span class="pf-label">图库与编辑历史</span>
              <span class="pf-desc">移除全部导入的照片记录与撤销历史，不影响当前画布。</span>
            </div>
            <button
              class="pf-btn danger"
              :class="{ armed: clearing === 'library' }"
              @click="runClear('library')"
            >
              {{ clearing === 'library' ? '确认清除？' : '清除' }}
            </button>
          </div>
          <div class="pf-row">
            <div class="pf-text">
              <span class="pf-label">自定义 Logo</span>
              <span class="pf-desc">删除上传的全部自定义品牌 Logo。</span>
            </div>
            <button
              class="pf-btn danger"
              :class="{ armed: clearing === 'logos' }"
              @click="runClear('logos')"
            >
              {{ clearing === 'logos' ? '确认清除？' : '清除' }}
            </button>
          </div>
          <div class="pf-row">
            <div class="pf-text">
              <span class="pf-label">自定义模板</span>
              <span class="pf-desc">删除保存的自定义相框模板，内置模板不受影响。</span>
            </div>
            <button
              class="pf-btn danger"
              :class="{ armed: clearing === 'templates' }"
              @click="runClear('templates')"
            >
              {{ clearing === 'templates' ? '确认清除？' : '清除' }}
            </button>
          </div>
        </section>

        <!-- 关于 -->
        <section class="pf-sec">
          <h3 class="pf-sec-title">关于</h3>
          <div class="pf-row" v-if="isTauri">
            <div class="pf-text">
              <span class="pf-label">软件更新</span>
              <span class="pf-desc">{{ updDesc }}</span>
            </div>
            <button class="pf-btn" :disabled="updBusy" @click="onCheckUpdate">
              {{ updState === 'checking' ? '检查中…' : updBusy ? '更新中…' : '检查更新' }}
            </button>
          </div>
          <div class="pf-row" v-if="isTauri">
            <div class="pf-text">
              <span class="pf-label">重启应用</span>
              <span class="pf-desc">退出并重新启动 FrameLab，用于让性能、数据类设置彻底生效。</span>
            </div>
            <button class="pf-btn" :disabled="restarting" @click="onRestart">
              {{ restarting ? '正在重启…' : '重启' }}
            </button>
          </div>
          <div class="pf-about">
            <span class="pf-about-logo">◎ FrameLab</span>
            <span class="pf-about-ver">版本 {{ APP_VERSION }}</span>
            <span class="pf-about-desc">照片相框 &amp; 背景合成工具。所有处理均在本地完成，照片与参数不会上传。</span>
          </div>
        </section>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pref-mask {
  position: fixed;
  inset: 0;
  background: rgba(8, 8, 10, 0.55);
  backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}
.pref-box {
  width: min(580px, 92vw);
  max-height: 84vh;
  display: flex;
  flex-direction: column;
  background: var(--panel);
  border: 1px solid var(--border);
  box-shadow: 0 24px 60px rgba(0, 0, 0, 0.5);
}
/* 头部 */
.pref-head {
  flex: none;
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 44px;
  padding: 0 8px 0 16px;
  border-bottom: 1px solid var(--border);
}
.pref-title-wrap {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.pref-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
  line-height: 18px;
}
.pref-sub {
  font-size: 11px;
  color: var(--text-dim);
}
.pref-close {
  width: 26px;
  height: 26px;
  border: none;
  background: transparent;
  color: var(--text-dim);
  font-size: 17px;
  line-height: 1;
  cursor: pointer;
}
.pref-close:hover {
  background: var(--hover);
  color: var(--text);
}
/* 滚动主体 */
.pref-body {
  overflow: auto;
  padding: 6px 16px 16px;
}
/* 分组 */
.pf-sec + .pf-sec {
  margin-top: 8px;
  border-top: 1px solid var(--border);
  padding-top: 12px;
}
.pf-sec-title {
  margin: 0 0 4px;
  font-size: 11px;
  font-weight: 600;
  color: var(--text-dim);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  line-height: 16px;
}
/* 设置行：标题+描述 左、控件 右 */
.pf-row {
  display: grid;
  grid-template-columns: 1fr auto;
  align-items: center;
  gap: 16px;
  padding: 9px 0;
  border-bottom: 1px solid var(--border);
}
.pf-row:last-child {
  border-bottom: none;
}
.pf-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}
.pf-label {
  font-size: 13px;
  color: var(--text);
  line-height: 18px;
}
.pf-desc {
  font-size: 11px;
  color: var(--text-dim);
  line-height: 15px;
}
/* 开关（圆角胶囊，现代软件风格） */
.pf-toggle {
  position: relative;
  flex: none;
  width: 38px;
  height: 20px;
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--panel-3);
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
}
.pf-toggle:disabled {
  opacity: 0.5;
  cursor: default;
}
.pf-knob {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: var(--text-dim);
  transition: left 0.15s, background 0.15s;
}
.pf-toggle.on {
  background: var(--accent);
  border-color: var(--accent);
}
.pf-toggle.on .pf-knob {
  left: 20px;
  background: #fff;
}
/* GPU 状态提示 */
.pf-gpu-status {
  font-size: 11px;
  color: var(--text-dim);
  padding: 2px 0 6px;
  border-bottom: 1px solid var(--border);
}
/* 分段按钮（格式） */
.pf-seg {
  display: flex;
  border: 1px solid var(--border);
  height: 26px;
}
.pf-seg button {
  background: var(--panel-2);
  border: none;
  color: var(--text-dim);
  font-size: 12px;
  padding: 0 12px;
  cursor: pointer;
  line-height: 16px;
}
.pf-seg button + button {
  border-left: 1px solid var(--border);
}
.pf-seg button:hover {
  background: var(--hover);
  color: var(--text);
}
.pf-seg button.on {
  background: var(--accent);
  color: var(--text);
}
/* 滑块 */
.pf-slider {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 200px;
}
.pf-slider input[type='range'] {
  flex: 1;
  min-width: 0;
  margin: 0;
  accent-color: var(--slider-thumb);
}
.pf-val {
  flex: none;
  width: 44px;
  text-align: right;
  font-size: 11px;
  font-variant-numeric: tabular-nums;
  color: var(--text-dim);
}
/* 下拉 */
.pf-select {
  height: 26px;
  padding: 0 8px;
  border: 1px solid var(--border);
  background: var(--panel-2);
  color: var(--text);
  font-size: 12px;
  min-width: 150px;
}
/* 普通/危险按钮 */
.pf-btn {
  height: 26px;
  padding: 0 12px;
  border: 1px solid var(--border);
  background: var(--panel-2);
  color: var(--text);
  font-size: 12px;
  line-height: 16px;
  cursor: pointer;
}
.pf-btn:hover {
  background: var(--hover);
}
.pf-btn.danger {
  border-color: var(--danger, #c0392b);
  color: var(--danger, #e74c3c);
  background: transparent;
}
.pf-btn.danger.armed {
  background: var(--danger, #c0392b);
  border-color: var(--danger, #c0392b);
  color: #fff;
}
/* 关于 */
.pf-about {
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 0 4px;
}
.pf-about-logo {
  font-size: 14px;
  font-weight: 600;
  color: var(--text);
}
.pf-about-ver {
  font-size: 11px;
  color: var(--text-dim);
}
.pf-about-desc {
  font-size: 12px;
  color: var(--text);
  line-height: 18px;
}
</style>
