/// <reference types="vite/client" />

/** 构建时由 vite.config.ts 从 package.json 注入的应用版本号 */
declare const __APP_VERSION__: string

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<Record<string, never>, Record<string, never>, unknown>
  export default component
}
