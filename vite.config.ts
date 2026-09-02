import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// 构建时从 package.json 注入应用版本号（前端 About 显示；桌面端运行时优先读 tauri.conf.json）
const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf-8')) as {
  version: string
}

// 双端构建配置：
// - 网页端：vite build 产物可直接部署；
// - Tauri 桌面端：tauri dev/build 以 http://localhost:5180 为 devUrl、dist 为 frontendDist。
export default defineConfig({
  plugins: [vue()],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  // Tauri CLI 接管终端输出，关闭 vite 清屏
  clearScreen: false,
  // 端口与 src-tauri/tauri.conf.json 的 devUrl 保持一致
  server: {
    port: 5180,
    strictPort: true,
  },
  build: {
    // 平台适配层（platform/storage.ts）使用顶层 await，需要 es2022
    target: 'es2022',
  },
})
