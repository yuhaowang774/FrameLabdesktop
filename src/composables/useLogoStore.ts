// 品牌 Logo 系统（阶段 8 + 阶段 9 自定义 Logo）
//
// 内置品牌使用真实图形 SVG 文件（见 src/assets/brands/<id>.svg），
// 由 resolveLogo 按 id 加载并渲染为 Canvas 图像，供预览与导出统一使用。
//
// 阶段 9 引入"自定义 Logo"：用户上传的图片经 IndexedDB 持久化
// （见 useLogoDB），加载到内存后由 resolveLogo 统一返回图像，对外接口不变。
// 自定义 Logo 为彩色原图，不随主题重绘。

import { ref } from 'vue'
import {
  getAllCustomLogos,
  putCustomLogo,
  deleteCustomLogo,
  countCustomLogos,
  MAX_CUSTOM_LOGOS,
  type CustomLogoRecord,
} from './useLogoDB'

// 缓存：内置品牌 key = `${brandId}`；自定义 key = `custom:${id}`
const cache = new Map<string, HTMLCanvasElement>()
// 内置品牌 SVG 异步加载完成后自增，触发依赖组件刷新
const logoVersion = ref(0)
// 自定义 Logo 内存镜像：id → 已解码 Image
const customImages = new Map<string, HTMLImageElement>()
// 自定义 Logo 元信息（含 name），供 UI 列表
const customMeta = new Map<string, string>() // id → name

export const CUSTOM_PREFIX = 'custom:'

// 内置品牌真实图形 SVG 资源路径（Vite 在构建时处理 new URL）
function brandSvgUrl(id: string): string {
  return new URL(`../assets/brands/${id}.svg`, import.meta.url).href
}

function makeId(): string {
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('图片解码失败'))
    img.src = src
  })
}

/** 启动时从 IndexedDB 载入全部自定义 Logo 到内存 */
export async function initCustomLogos(): Promise<void> {
  try {
    const recs = await getAllCustomLogos()
    await Promise.all(
      recs.map(async (rec: CustomLogoRecord) => {
        try {
          const img = await loadImage(rec.dataURL)
          customImages.set(rec.id, img)
          customMeta.set(rec.id, rec.name)
        } catch {
          /* 损坏记录忽略 */
        }
      }),
    )
    // 内存中的自定义图转 canvas 缓存（一次性）
    for (const id of customImages.keys()) {
      renderCustomToCache(id)
    }
  } catch {
    /* IndexedDB 不可用时静默降级，仅内置品牌可用 */
  }
}

function renderCustomToCache(id: string): void {
  const img = customImages.get(id)
  if (!img) return
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth
  canvas.height = img.naturalHeight
  const ctx = canvas.getContext('2d')!
  ctx.drawImage(img, 0, 0)
  cache.set(`${CUSTOM_PREFIX}${id}`, canvas)
}

/** 将内置品牌真实图形 SVG 文件渲染到 Canvas 并缓存 */
function renderSvgToCache(id: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  // 同步返回一个占位画布（首次 onload 完成前），渲染完成后通过响应式刷新
  canvas.width = 120
  canvas.height = 48
  const img = new Image()
  img.onload = () => {
    const w = img.naturalWidth || 120
    const h = img.naturalHeight || 48
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, 0)
    cache.set(id, canvas)
    // 触发依赖此 Logo 的组件刷新
    logoVersion.value++
  }
  img.onerror = () => {
    canvas.width = 1
    canvas.height = 1
    cache.set(id, canvas)
  }
  img.src = brandSvgUrl(id)
  return canvas
}

/**
 * 解析某品牌的 Logo 图像（HTMLCanvasElement）。
 * - 内置品牌：官方 SVG 字标渲染
 * - 自定义 Logo：返回彩色原图
 */
export function resolveLogo(id: string): HTMLCanvasElement {
  const key = id.startsWith(CUSTOM_PREFIX) ? id : id
  const hit = cache.get(key)
  if (hit) return hit

  if (id.startsWith(CUSTOM_PREFIX)) {
    // 尚未在缓存（可能仍在异步加载），返回空白占位，加载完成后通过响应式刷新
    const blank = document.createElement('canvas')
    blank.width = 1
    blank.height = 1
    return blank
  }

  return renderSvgToCache(id)
}

/**
 * 确保内置品牌 Logo 已加载完成（供导出前预载，避免拿到占位画布）。
 * 自定义 Logo 由 initCustomLogos 处理，此处忽略。
 */
export function preloadBrandLogo(id: string): Promise<void> {
  if (id.startsWith(CUSTOM_PREFIX)) return Promise.resolve()
  const hit = cache.get(id)
  if (hit && hit.width > 1 && hit.height > 1) return Promise.resolve()
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth || 120
      canvas.height = img.naturalHeight || 48
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      cache.set(id, canvas)
      logoVersion.value++
      resolve()
    }
    img.onerror = () => resolve()
    img.src = brandSvgUrl(id)
  })
}

/** 取得预览用 dataURL（供 <img :src> 使用）。依赖 logoVersion 以在异步加载后刷新 */
export function resolveLogoDataURL(id: string): string {
  // 读取 logoVersion 建立响应式依赖；内置品牌首次可能为占位，加载完成后会重新计算
  void logoVersion.value
  return resolveLogo(id).toDataURL('image/png')
}

// ===== 自定义 Logo 管理 =====

export interface CustomLogoInfo {
  id: string
  name: string
  dataURL: string
}

/** 返回当前所有自定义 Logo（含 dataURL，供 UI 缩略图与选择） */
export function listCustomLogos(): CustomLogoInfo[] {
  const out: CustomLogoInfo[] = []
  for (const [id, name] of customMeta) {
    const img = customImages.get(id)
    if (!img) continue
    out.push({ id, name, dataURL: img.src })
  }
  return out
}

export function getCustomCount(): number {
  return customImages.size
}

/** 校验并上传自定义 Logo：读成 dataURL → 存 IDB + 内存 → 生成 canvas 缓存 */
export async function uploadCustomLogo(file: File, name?: string): Promise<string> {
  if (!file.type.startsWith('image/')) {
    throw new Error('请选择图片文件')
  }
  const count = getCustomCount()
  if (count >= MAX_CUSTOM_LOGOS) {
    throw new Error(`自定义 Logo 已达上限（${MAX_CUSTOM_LOGOS} 个）`)
  }
  const dataURL = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('文件读取失败'))
    reader.readAsDataURL(file)
  })
  const img = await loadImage(dataURL)
  const id = makeId()
  const finalName = name?.trim() || file.name.replace(/\.[^.]+$/, '') || `自定义 ${count + 1}`
  const rec: CustomLogoRecord = { id, name: finalName, dataURL }
  await putCustomLogo(rec)
  customImages.set(id, img)
  customMeta.set(id, finalName)
  renderCustomToCache(id)
  return id
}

/** 删除自定义 Logo（IDB + 内存 + 缓存） */
export async function removeCustomLogo(id: string): Promise<void> {
  if (!id.startsWith(CUSTOM_PREFIX)) id = id.replace(CUSTOM_PREFIX, '')
  await deleteCustomLogo(id)
  customImages.delete(id)
  customMeta.delete(id)
  cache.delete(`${CUSTOM_PREFIX}${id}`)
}

export { MAX_CUSTOM_LOGOS, countCustomLogos }
export function useLogoStore() {
  return {
    resolveLogo,
    resolveLogoDataURL,
    initCustomLogos,
    listCustomLogos,
    uploadCustomLogo,
    removeCustomLogo,
    getCustomCount,
    CUSTOM_PREFIX,
  }
}
