import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
import { useFrameConfig } from './composables/useFrameConfig'
import { useCssVars } from './composables/useCssVars'
import { useHistory } from './composables/useHistory'
import { initCustomLogos } from './composables/useLogoStore'
import { isTauri } from './platform/env'

const app = createApp(App)

// 核心数据流：单一数据源 frameConfig → :root CSS 变量（驱动预览实时更新）。
// 悬浮历史条目时优先渲染该历史节点参数（previewState），实现"导航预览"且不修改实际参数。
const { state } = useFrameConfig()
const history = useHistory()
useCssVars(() => history.previewState.value ?? state)

// 阶段 9：从 IndexedDB 载入已保存的自定义 Logo
initCustomLogos()

// 开发环境：内置种子照片到图库便于调试（动态加载，生产构建不含种子资源）
if (import.meta.env.DEV) {
  const { seedBuiltin } = await import('./composables/useSeed')
  void seedBuiltin()
}

// 桌面端：接入原生菜单事件分发 + 恢复上次打开的图片文件夹（在挂载前完成，
// 使首次渲染即可带上恢复的图库素材）
if (isTauri) {
  const { setupDesktopShell } = await import('./platform/desktop')
  await setupDesktopShell()
}

// 恢复上次选中照片（挂载前执行：App.vue 的 activeId watch 会自动回放该照片参数）
const { restoreActive } = await import('./composables/useLibrary')
restoreActive()

app.mount('#app')
