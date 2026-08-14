import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
import { useFrameConfig } from './composables/useFrameConfig'
import { useCssVars } from './composables/useCssVars'
import { initCustomLogos } from './composables/useLogoStore'
import { loadHistory } from './composables/useHistory'

const app = createApp(App)

// 核心数据流：单一数据源 frameConfig → :root CSS 变量（驱动预览实时更新）
const { state } = useFrameConfig()
useCssVars(() => state)

// 阶段 9：从 IndexedDB 载入已保存的自定义 Logo
initCustomLogos()
// 阶段 12：载入历史记录（模块级单例）
loadHistory()

app.mount('#app')
