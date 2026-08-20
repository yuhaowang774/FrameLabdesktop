// 平台环境判断：Tauri 桌面客户端 vs 浏览器网页端。
// 按规范通过 window.__TAURI__ 判断；同时兼容 __TAURI_INTERNALS__
// （Tauri 2 WebView 必注入 internals，withGlobalTauri 开启时注入 __TAURI__）。
export const isTauri: boolean =
  typeof window !== 'undefined' &&
  ('__TAURI__' in window || '__TAURI_INTERNALS__' in window)
