// 品牌 Logo 系统（阶段 8 + 阶段 9 自定义 Logo）
//
// 说明：原设计计划"网搜官方 SVG + 暗白双版"。但官方商标受版权保护，
// 不宜在仓库内重新分发其矢量文件（见 PROJECT_PLAN 风险项）。
// 因此本实现采用**矢量自绘**策略：内置品牌用其标志性文字标记（mark）
// 在 Canvas 上以系统字体渲染，并按主题自动选择亮/暗色。
//
// 阶段 9 引入"自定义 Logo"：用户上传的图片经 IndexedDB 持久化
// （见 useLogoDB），加载到内存后由 resolveLogo 统一返回图像，对外接口不变。
// 自定义 Logo 为彩色原图，不随主题重绘（仅内置品牌做暗白双版）。

import { BRANDS } from '../core/constants'
import {
  getAllCustomLogos,
  putCustomLogo,
  deleteCustomLogo,
  countCustomLogos,
  MAX_CUSTOM_LOGOS,
  type CustomLogoRecord,
} from './useLogoDB'

/** 品牌标记定义：mark=Logo 区显示的标志性文字，font=字形（优先字体） */
interface BrandMark {
  id: string
  mark: string
  font: string
}

// 各品牌标志性文字标记（取最具辨识度的写法，非官方商标图形）
const BRAND_MARKS: BrandMark[] = [
  { id: 'sony', mark: 'SONY', font: "600 1em 'Arial Black', Arial, sans-serif" },
  { id: 'nikon', mark: 'NIKON', font: "700 1em 'Helvetica Neue', Arial, sans-serif" },
  { id: 'canon', mark: 'Canon', font: "700 1em 'Optima', 'Segoe UI', Georgia, serif" },
  { id: 'fujifilm', mark: 'FUJIFILM', font: "700 1em 'Helvetica Neue', Arial, sans-serif" },
  { id: 'hasselblad', mark: 'HASSELBLAD', font: "600 1em 'Georgia', serif" },
  { id: 'leica', mark: 'LEICA', font: "700 1em 'Arial Black', Arial, sans-serif" },
  { id: 'ricoh', mark: 'RICOH', font: "700 1em 'Helvetica Neue', Arial, sans-serif" },
  { id: 'zeiss', mark: 'ZEISS', font: "600 1em 'Georgia', serif" },
  { id: 'pentax', mark: 'PENTAX', font: "700 1em 'Helvetica Neue', Arial, sans-serif" },
  { id: 'dji', mark: 'DJI', font: "800 1em 'Arial Black', Arial, sans-serif" },
  { id: 'panasonic', mark: 'Panasonic', font: "700 1em 'Helvetica Neue', Arial, sans-serif" },
  { id: 'olympus', mark: 'OLYMPUS', font: "700 1em 'Helvetica Neue', Arial, sans-serif" },
  { id: 'caye', mark: '沧野', font: "700 1em 'PingFang SC', 'Microsoft YaHei', sans-serif" },
  { id: 'xuzhou', mark: '徐州老味菜', font: "700 1em 'PingFang SC', 'Microsoft YaHei', sans-serif" },
]

const MARK_MAP = new Map(BRAND_MARKS.map((b) => [b.id, b]))

// 缓存：内置品牌 key = `${brandId}:${theme}`；自定义 key = `custom:${id}`
const cache = new Map<string, HTMLCanvasElement>()
// 自定义 Logo 内存镜像：id → 已解码 Image
const customImages = new Map<string, HTMLImageElement>()
// 自定义 Logo 元信息（含 name），供 UI 列表
const customMeta = new Map<string, string>() // id → name

export const CUSTOM_PREFIX = 'custom:'

function brandName(id: string): string {
  return BRANDS.find((b) => b.id === id)?.name ?? id
}

function makeId(): string {
  return `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

function loadImage(dataURL: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('图片解码失败'))
    img.src = dataURL
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

/**
 * 解析某品牌的 Logo 图像（HTMLCanvasElement）。
 * - 内置品牌：暗色主题绘浅色文字，亮色主题绘深色文字（暗白双版）
 * - 自定义 Logo：返回彩色原图（不随主题重绘）
 */
export function resolveLogo(id: string, theme: 'light' | 'dark'): HTMLCanvasElement {
  const key = id.startsWith(CUSTOM_PREFIX) ? id : `${id}:${theme}`
  const hit = cache.get(key)
  if (hit) return hit

  if (id.startsWith(CUSTOM_PREFIX)) {
    // 尚未在缓存（可能仍在异步加载），返回空白占位，加载完成后通过响应式刷新
    const blank = document.createElement('canvas')
    blank.width = 1
    blank.height = 1
    return blank
  }

  const def = MARK_MAP.get(id) ?? { id, mark: brandName(id), font: "700 1em sans-serif" }
  const color = theme === 'dark' ? '#ffffff' : '#111111'

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  const fontSize = 64
  ctx.font = def.font.replace('1em', `${fontSize}px`)
  const metrics = ctx.measureText(def.mark)
  const pad = 4
  const w = Math.ceil(metrics.width) + pad * 2
  const h = Math.ceil(fontSize * 1.2) + pad * 2
  canvas.width = w
  canvas.height = h

  ctx.clearRect(0, 0, w, h)
  ctx.font = def.font.replace('1em', `${fontSize}px`)
  ctx.fillStyle = color
  ctx.textBaseline = 'middle'
  ctx.textAlign = 'left'
  ctx.fillText(def.mark, pad, h / 2)

  cache.set(key, canvas)
  return canvas
}

/** 取得预览用 dataURL（供 <img :src> 使用） */
export function resolveLogoDataURL(id: string, theme: 'light' | 'dark'): string {
  return resolveLogo(id, theme).toDataURL('image/png')
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
