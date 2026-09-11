// 全局 UI 状态：工作流模块（图库/编辑/导出）、左右面板折叠/独奏/宽度、全局任务进度。
// 五区工作台布局与顶栏模块选择器。
import { reactive, ref, computed, watch } from 'vue'

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
  // 左侧面板组：我的素材 / 相框模板库 / 修改历史记录（背景模板库已取消）
  leftPanels: Record<string, boolean>
  // 右侧面板组：照片 / 背景 / 边框 / INFO信息设置
  rightPanels: Record<string, boolean>
  // INFO 组合拖动：开启后拖拽任一 INFO 元素时全部元素成组整体移动
  infoGroupDrag: boolean
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
    mediaInfo: true,
    frameTemplates: true,
  },
  rightPanels: {
    photo: false,
    background: false,
    border: false,
    info: false,
  },
  infoGroupDrag: false,
  filmstripVisible: true,
  filmstripHeight: 78,
}

function load(): LayoutState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<LayoutState>
      const merged = { ...defaults, ...parsed }
      // 迁移：rightPanels 由旧「背景设置/图片设置/INFO」拆分为「照片/背景/边框/INFO」。
      // 边框（border）从旧「背景设置」中拆出，展开态跟随旧 background。
      if (parsed.rightPanels) {
        const old = parsed.rightPanels as Record<string, boolean>
        merged.rightPanels = {
          photo: old.photo ?? old.layout ?? old.frame ?? old.effects ?? false,
          background: old.background ?? old.canvas ?? true,
          border: old.border ?? old.background ?? true,
          info: old.info ?? false,
        }
      }
      // 左栏面板：与默认值按键合并，保证新增面板（如「我的模板」）对存量用户按默认态出现
      if (parsed.leftPanels) {
        merged.leftPanels = { ...defaults.leftPanels, ...parsed.leftPanels }
      }
      return merged
    }
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
      localStorage.setItem(STORAGE_KEY, JSON.stringify(val))
    } catch {
      /* ignore */
    }
  },
  { deep: true },
)

// 默认进入图库模块：照片管理是工作流起点，用户从图库选片后再进入编辑/导出
const activeModule = ref<ModuleTab>('library')

// 全局任务进度（导出/合成）
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

/** 切换面板折叠：左右两侧各面板相互独立，展开/收起互不影响，可同时展开多个 */
function togglePanel(group: 'left' | 'right', id: string): void {
  const map = group === 'left' ? state.leftPanels : state.rightPanels
  map[id] = !map[id]
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
/** 更新任务标签（不重置进度）：批量导出逐张显示「第 x/N 张 · 文件名」 */
function setTaskLabel(label: string): void {
  task.label = label
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

// 编辑画布右键「导出当前照片」：Workspace 置位请求标记并切到导出模块，
// ExportPanel 消费该标记后自动触发单张导出（跨组件解耦，不互相引用）。
const pendingSingleExport = ref(false)
function requestSingleExport(): void {
  pendingSingleExport.value = true
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
    pendingSingleExport,
    requestSingleExport,
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
    setTaskLabel,
    setTaskProgress,
    endTask,
  }
}
