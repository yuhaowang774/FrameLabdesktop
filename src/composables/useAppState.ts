// 全局 UI 状态：工作流模块（图库/编辑/导出）、左右面板折叠/独奏/宽度、全局任务进度。
// 对标 Lightroom Classic 五区布局与顶栏模块选择器。
import { reactive, ref, computed, watch } from 'vue'
import { storageGet, storageSet } from '../platform/storage'

export type ModuleTab = 'library' | 'develop' | 'export'

export interface PanelState {
  id: string
  open: boolean
}

const STORAGE_KEY = 'frame-ui-layout'

interface LayoutState {
  leftOpen: boolean
  rightOpen: boolean
  leftWidth: number
  rightWidth: number
  // 左侧面板组：我的素材 / 相框模板库 / 背景模板库 / 参数快照
  leftPanels: Record<string, boolean>
  // 右侧面板组：画布基础 / 相框 / 图片布局 / 背景 / 附加效果
  rightPanels: Record<string, boolean>
  soloMode: 'left' | 'right' | null
  // 底部胶片窗格 Filmstrip：可见性 + 高度（可拖拽调整）
  filmstripVisible: boolean
  filmstripHeight: number
}

const defaults: LayoutState = {
  leftOpen: true,
  rightOpen: true,
  leftWidth: 260,
  rightWidth: 300,
  leftPanels: {
    library: true,
    frameTemplates: false,
    bgTemplates: false,
    snapshots: false,
  },
  rightPanels: {
    canvas: true,
    frame: false,
    layout: false,
    background: false,
    effects: false,
    info: false,
  },
  soloMode: null,
  filmstripVisible: true,
  filmstripHeight: 78,
}

function load(): LayoutState {
  try {
    const raw = storageGet(STORAGE_KEY)
    if (raw) return { ...defaults, ...JSON.parse(raw) }
  } catch {
    /* ignore */
  }
  return { ...defaults }
}

const state = reactive<LayoutState>(load())

watch(
  state,
  (val) => {
    try {
      storageSet(STORAGE_KEY, JSON.stringify(val))
    } catch {
      /* ignore */
    }
  },
  { deep: true },
)

const activeModule = ref<ModuleTab>('develop')

// 全局任务进度（导出/合成），对标 LrC 身份标识监视器
const task = reactive({
  active: false,
  label: '',
  progress: 0, // 0..1
})

function setModule(m: ModuleTab): void {
  activeModule.value = m
}

function toggleLeft(): void {
  state.leftOpen = !state.leftOpen
}
function toggleRight(): void {
  state.rightOpen = !state.rightOpen
}

function setLeftWidth(w: number): void {
  state.leftWidth = Math.max(180, Math.min(480, Math.round(w)))
}
function setRightWidth(w: number): void {
  state.rightWidth = Math.max(200, Math.min(520, Math.round(w)))
}

/** 独奏模式：打开某面板时收起同组其他面板（见 togglePanel） */
function togglePanel(group: 'left' | 'right', id: string): void {
  const map = group === 'left' ? state.leftPanels : state.rightPanels
  const willOpen = !map[id]
  if (willOpen) {
    // 打开时收起同组其他面板（LrC 独奏行为）
    Object.keys(map).forEach((k) => {
      if (k !== id) map[k] = false
    })
    map[id] = true
    state.soloMode = group
  } else {
    map[id] = false
  }
}

function setPanel(group: 'left' | 'right', id: string, open: boolean): void {
  const map = group === 'left' ? state.leftPanels : state.rightPanels
  map[id] = open
}

function startTask(label: string): void {
  task.active = true
  task.label = label
  task.progress = 0
}
function setTaskProgress(p: number): void {
  task.progress = Math.max(0, Math.min(1, p))
}
function endTask(): void {
  task.active = false
  task.label = ''
  task.progress = 0
}

function toggleFilmstrip(): void {
  state.filmstripVisible = !state.filmstripVisible
}
function setFilmstripHeight(h: number): void {
  state.filmstripHeight = Math.max(44, Math.min(260, Math.round(h)))
}

const leftWidthPx = computed(() => state.leftWidth + 'px')
const rightWidthPx = computed(() => state.rightWidth + 'px')
const filmstripHeightPx = computed(() => state.filmstripHeight + 'px')

export function useAppState() {
  return {
    state,
    activeModule,
    task,
    leftWidthPx,
    rightWidthPx,
    filmstripHeightPx,
    setModule,
    toggleLeft,
    toggleRight,
    setLeftWidth,
    setRightWidth,
    toggleFilmstrip,
    setFilmstripHeight,
    togglePanel,
    setPanel,
    startTask,
    setTaskProgress,
    endTask,
  }
}
