// 注意：platform/storage 必须最先导入（桌面端顶层 await 预载 AppData 持久化数据，
// 保证后续业务模块初始化读档时数据已就绪），排在所有业务模块之前。
import './platform/storage'
import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
import { useFrameConfig } from './composables/useFrameConfig'
import { useCssVars } from './composables/useCssVars'
import { initCustomLogos } from './composables/useLogoStore'
import { loadHistory } from './composables/useHistory'
import { isTauri } from './platform/env'

const app = createApp(App)

// 核心数据流：单一数据源 frameConfig → :root CSS 变量（驱动预览实时更新）
const { state } = useFrameConfig()
useCssVars(() => state)

// 从 IndexedDB 载入已保存的自定义 Logo
initCustomLogos()
// 载入历史记录（模块级单例）
loadHistory()

// 桌面端：接入原生菜单事件分发 + 恢复上次打开的图片文件夹
if (isTauri) {
  const { setupDesktopShell } = await import('./platform/desktop')
  await setupDesktopShell()
}

app.mount('#app')
