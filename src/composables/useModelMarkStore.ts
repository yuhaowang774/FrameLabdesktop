// 机型字标渲染缓存（预览 dataURL / 导出画布统一入口）。
// 与 useLogoStore 的品牌 Logo 管线同构：无色基准 + 按色变体缓存 + 响应式版本号。
// 基准渲染为单色（SVG 原始色），着色变体经 tintCanvas 同步套色（取色器连续拖动即时生效）。
import { ref } from 'vue'
import { renderSvgMark, tintCanvas } from '../core/svgMark'

/** 基准渲染高度（px）：覆盖导出高分辨率绘制（字号 × unitScale），兼顾内存 */
const RENDER_HEIGHT = 320
// 着色变体上限（键含 #色值）：超限仅淘汰变体，保留无色基准
const CACHE_MAX = 48

const cache = new Map<string, HTMLCanvasElement>()
const version = ref(0)

function markUrl(file: string): string {
  // Vite 构建时解析（与品牌 SVG 同一模式）
  return new URL(`../assets/models/${file}.svg`, import.meta.url).href
}

function keyOf(file: string, color?: string): string {
  return color ? `${file}#${color}` : file
}

function trimCache(): void {
  if (cache.size <= CACHE_MAX) return
  for (const key of [...cache.keys()]) {
    if (cache.size <= CACHE_MAX) break
    if (key.includes('#')) cache.delete(key)
  }
}

function placeholder(): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = 1
  c.height = 1
  return c
}

function renderBase(file: string): Promise<HTMLCanvasElement> {
  const hit = cache.get(file)
  if (hit && hit.width > 1) return Promise.resolve(hit)
  return renderSvgMark(markUrl(file), RENDER_HEIGHT).then((c) => {
    cache.set(file, c)
    return c
  })
}

/**
 * 解析机型字标图像（HTMLCanvasElement）。
 * 资源未就绪返回 1×1 占位（调用端回退文字渲染），完成后 version 自增触发刷新。
 */
export function resolveModelMark(file: string, color?: string): HTMLCanvasElement {
  const key = keyOf(file, color)
  const hit = cache.get(key)
  if (hit) return hit
  // 着色变体：无色基准已就绪时同步套色（连续换色的关键路径）
  if (color) {
    const base = cache.get(file)
    if (base && base.width > 1) {
      const tinted = tintCanvas(base, color)
      cache.set(key, tinted)
      trimCache()
      return tinted
    }
  }
  // 基准未就绪（首次加载）：异步渲染，完成后套色写入缓存并触发响应式刷新
  void renderBase(file)
    .then((base) => {
      cache.set(key, color ? tintCanvas(base, color) : base)
      trimCache()
      version.value++
    })
    .catch(() => {
      /* 资源缺失：保持占位，调用端回退文字 */
    })
  return placeholder()
}

// dataURL 缓存（<img> 预览用）：PNG 编码昂贵，按 version 失效
const dataUrlCache = new Map<string, string>()
let dataUrlCacheVersion = -1
export function resolveModelMarkDataURL(file: string, color?: string): string {
  const ver = version.value
  if (ver !== dataUrlCacheVersion) {
    dataUrlCache.clear()
    dataUrlCacheVersion = ver
  }
  const key = keyOf(file, color)
  const hit = dataUrlCache.get(key)
  if (hit !== undefined) return hit
  const c = resolveModelMark(file, color)
  // 未就绪（1×1 占位）：不缓存，返回空串让调用端回退文字；就绪后经 version 刷新
  if (c.width <= 1 || c.height <= 1) return ''
  const url = c.toDataURL('image/png')
  dataUrlCache.set(key, url)
  if (dataUrlCache.size > 64) dataUrlCache.clear()
  return url
}

/** 导出前预载（确保拿到完整画布而非占位）；资源缺失静默（导出端自动回退文字） */
export async function preloadModelMark(file: string, color?: string): Promise<void> {
  const key = keyOf(file, color)
  const hit = cache.get(key)
  if (hit && hit.width > 1 && hit.height > 1) return
  try {
    const base = await renderBase(file)
    cache.set(key, color ? tintCanvas(base, color) : base)
    trimCache()
    version.value++
  } catch {
    /* 资源缺失：导出端回退文字渲染 */
  }
}

export function useModelMarkStore() {
  return {
    resolveModelMark,
    resolveModelMarkDataURL,
    preloadModelMark,
    modelMarkVersion: version,
  }
}
