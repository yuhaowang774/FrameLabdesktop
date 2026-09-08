import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
import { useFrameConfig } from './composables/useFrameConfig'
import { useCssVars } from './composables/useCssVars'
import { useHistory } from './composables/useHistory'
import { initCustomLogos } from './composables/useLogoStore'
import { isTauri } from './platform/env'
import { getStartupTemplatePref } from './composables/usePrefs'
import { reportRuntimeError } from './composables/useUi'

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

// ===== 全局运行时错误捕获：弹窗提醒用户 + 详情落盘（用户要求：报错可见、可定位）=====
// 注意：渲染进程 OOM 崩溃（WebView2 错误页）发生在进程层面，此处捕获不到；
// 该场景由启动看门狗（public/boot-watchdog.js）与日志文件覆盖。
{
  const report = (title: string, detail: string) => {
    reportRuntimeError(title, detail)
    try {
      void (window as unknown as { __TAURI__?: { core: { invoke: (c: string, a?: Record<string, unknown>) => Promise<void> } } })
        .__TAURI__?.core.invoke('write_boot_log', { content: `${title}\n${detail}` })
        .catch(() => {})
    } catch {
      /* 非桌面端静默 */
    }
  }
  window.addEventListener('error', (e) => {
    // 资源加载失败（缩略图/字体等）单独提示，避免与脚本错误混淆
    if (e.target && (e.target as HTMLElement).tagName) {
      const el = e.target as HTMLElement
      if (el.tagName === 'SCRIPT' || el.tagName === 'LINK' || el.tagName === 'IMG') {
        const src = (el as HTMLImageElement).src || ''
        if (src.startsWith('blob:') || src.startsWith('data:')) return // 已失效的本地 blob 缩略图：无害，不弹窗
        report('资源加载失败', `类型: ${el.tagName}\n地址: ${src}`)
        return
      }
    }
    report('脚本错误', (e.message || 'unknown error') + (e.filename ? `\n位置: ${e.filename}:${e.lineno}` : ''))
  }, true)
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason
    const detail = (r && (r.stack || r.message)) || String(r)
    report('异步操作错误', detail)
  })

  // Vue 组件树内的错误默认只打 console（生产不会抛到 window）：显式接管，同样弹窗+落盘
  app.config.errorHandler = (err, _instance, info) => {
    const detail = String((err as Error)?.stack || err) + `\n触发于: ${info}`
    report('组件错误', detail)
  }
}

app.mount('#app')

// 启动看门狗解除：挂载成功，8 秒白屏检测不再触发
;(window as unknown as { __MARK_BOOTED__?: () => void }).__MARK_BOOTED__?.()
// 启动期间捕获到的非致命错误也落盘（成功挂载但带错误），供远程诊断
try {
  const bootErrors = (window as unknown as { __BOOT_ERRORS__?: string[] }).__BOOT_ERRORS__
  if (bootErrors?.length) {
    void (window as unknown as { __TAURI__?: { core: { invoke: (c: string, a?: Record<string, unknown>) => Promise<void> } } })
      .__TAURI__?.core.invoke('write_boot_log', { content: bootErrors.join('\n') })
      .catch(() => {})
  }
} catch {
  /* 看门狗不存在（网页端老缓存）忽略 */
}

// 首选项「启动默认模板」：应用内置模板装饰参数（不覆盖已恢复照片的 EXIF/位置/变换）
void (async () => {
  const tplId = getStartupTemplatePref()
  if (!tplId) return
  const { useTemplates, applyTemplateToState } = await import('./composables/useTemplates')
  const t = useTemplates().templates.find((x) => x.id === tplId)
  if (t) applyTemplateToState(t.config)
})()
