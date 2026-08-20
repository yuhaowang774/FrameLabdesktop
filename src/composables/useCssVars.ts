// 驱动器：watch frameConfig → 写 :root CSS 变量，预览实时更新
import { watch, type WatchSource } from 'vue'
import type { FrameConfig } from '../core/types'

type CssVarMap = Record<string, (c: FrameConfig) => string>

// FrameConfig 字段 → CSS 变量 的映射（仅预览布局所需的变量）
const VAR_MAP: CssVarMap = {
  // none 模式：无边框，照片铺满（边距归零、缩放强制 100%）
  '--frame-padding': (c) => (c.bgMode === 'none' ? '0px' : `${c.padding}px`),
  '--img-scale': (c) => (c.bgMode === 'none' ? '100%' : `${c.scale}%`),
  '--dist-photo-logo': (c) => `${c.distPhotoLogo}px`,
  '--dist-logo-text': (c) => `${c.distLogoText}px`,
  '--dist-bottom': (c) => `${c.distBottom}px`,
  '--border-radius': (c) => `${c.radius}px`,
  '--shadow-opacity': (c) => `${c.shadow}`,
  '--font-family': (c) => c.fontFamily,
  '--font-size': (c) => `${c.fontSize}px`,
  '--text-weight': (c) => `${c.textWeight}`,
  '--text-opacity': (c) => `${c.textOpacity}`,
  '--footer-text-color': () => 'rgba(255,255,255,0.95)',
  '--logo-size': (c) => `${c.logoSize}px`,
  '--logo-opacity': (c) => `${c.logoOpacity}`,
  '--logo-display': (c) => (c.showLogo ? 'block' : 'none'),
  '--camera-model-size': (c) => `${c.cameraModelSize}px`,
  '--camera-model-weight': (c) => `${c.cameraModelWeight}`,
  '--camera-model-gap': (c) => `${c.cameraModelGap}px`,
  '--camera-model-opacity': (c) => `${c.cameraModelOpacity}`,
  '--camera-model-italic': (c) => (c.cameraModelItalic ? 'italic' : 'normal'),
  '--camera-model-display': (c) => (c.showCameraModel ? 'block' : 'none'),
  '--camera-model-font-family': (c) => c.cameraModelFont,
  '--camera-model-offset-x': (c) => `${c.cameraModelOffsetX}px`,
  '--camera-model-offset-y': (c) => `${c.cameraModelOffsetY}px`,
  '--exif-display': (c) => (c.showExif ? 'block' : 'none'),
}

function applyVars(config: FrameConfig, root: HTMLElement): void {
  for (const [name, fn] of Object.entries(VAR_MAP)) {
    root.style.setProperty(name, fn(config))
  }
}

/**
 * 将 frameConfig 同步到 :root 的 CSS 变量。
 * 返回 stop 句柄以便卸载时清理。
 */
export function useCssVars(getConfig: () => FrameConfig) {
  const root = document.documentElement

  // 立即写入一次
  applyVars(getConfig(), root)

  // 深度 watch，任一字段变化即更新
  const stop = watch(
    getConfig as WatchSource<FrameConfig>,
    (cfg) => applyVars(cfg, root),
    { deep: true, flush: 'sync' },
  )

  return { stop, applyNow: () => applyVars(getConfig(), root) }
}
