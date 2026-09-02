// 品牌 Logo 系统（阶段 8 + 阶段 9 自定义 Logo）
//
// 内置品牌使用真实图形 SVG 文件（见 src/assets/brands/<id>.svg），
// 由 resolveLogo 按 id 加载并渲染为 Canvas 图像，供预览与导出统一使用。
//
// 阶段 9 引入"自定义 Logo"：用户上传的图片经 IndexedDB 持久化
// （见 useLogoDB），加载到内存后由 resolveLogo 统一返回图像，对外接口不变。
// 自定义 Logo 为彩色原图，不随主题重绘。

import { ref } from 'vue'
import { BRANDS, PHONE_BRANDS } from '../core/constants'
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

/**
 * 无 SVG 资源的品牌（apple / insta360 等）文字标记回退：
 * 以品牌名渲染 Canvas 文字（与阶段 8 矢量自绘策略一致，规避商标版权）。
 * color：指定着色（如品牌主色），缺省白色。
 */
const TEXT_LOGO_FONT = `600 44px -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif`
function renderTextLogo(id: string, color?: string): HTMLCanvasElement {
  // 相机品牌用名称；手机品牌用 logoText 文字标记（HUAWEI/XIAOMI…）
  const name = BRANDS.find((b) => b.id === id)?.name ?? PHONE_BRANDS.find((b) => b.id === id)?.logoText ?? id
  const canvas = document.createElement('canvas')
  // 先在临时尺寸上测量文本宽，再定稿画布尺寸
  const probe = document.createElement('canvas').getContext('2d')!
  probe.font = TEXT_LOGO_FONT
  const w = Math.max(24, Math.ceil(probe.measureText(name).width) + 16)
  const h = 64
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  ctx.font = TEXT_LOGO_FONT
  ctx.fillStyle = color || '#ffffff'
  ctx.textBaseline = 'middle'
  ctx.fillText(name, 8, h / 2)
  return canvas
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

// ===== 品牌 SVG 几何规范化（统一标准） =====
//
// 品牌 SVG 来源混杂（SimpleIcons 字标 / 官方 wordmark），viewBox 与图形边距各不相同：
// 例如 Sony 字标在 24×24 viewBox 中仅占中间 ~18% 高度，上下大量空白，
// 导致 INFO 信息里 Logo 已拖到底部但字体离边界还有很大距离。
//
// 统一标准：渲染时按 SVG 实际图形 bounding box（svg.getBBox()）裁剪，
// 四周再留统一的内边距（PAD_RATIO），使所有品牌的图形以一致的边距充满画布——
// 上下左右边距完全一致，任何品牌显示效果统一。

const PAD_RATIO = 0.04 // 统一内边距：图形四周各留 4%

/** 解析 SVG 文本中的实际图形边界（联合全部 path 的 bbox）与 viewBox 尺寸 */
function parseSvgGeometry(
  text: string,
): { x: number; y: number; w: number; h: number; vbW: number; vbH: number } | null {
  try {
    const div = document.createElement('div')
    div.style.cssText = 'position:fixed;left:-99999px;top:0;width:400px;height:100px'
    div.innerHTML = text
    document.body.appendChild(div)
    const svg = div.querySelector('svg')
    if (!svg) return null
    svg.setAttribute('width', '400')
    svg.setAttribute('height', '100')
    const bb = svg.getBBox()
    let vbW = 0
    let vbH = 0
    const vb = svg.getAttribute('viewBox')
    if (vb) {
      const p = vb.trim().split(/[\s,]+/).map(Number)
      if (p.length === 4) {
        vbW = p[2]
        vbH = p[3]
      }
    }
    div.remove()
    if (!isFinite(bb.x) || !isFinite(bb.y) || !isFinite(bb.width) || !isFinite(bb.height)) return null
    return { x: bb.x, y: bb.y, w: bb.width, h: bb.height, vbW, vbH }
  } catch {
    return null
  }
}

/**
 * 按统一标准渲染品牌 SVG：将 SVG 的 viewBox 重写为「实际图形边界 + 统一内边距」，
 * 再整体加载绘制 —— 图形以一致的 4% 边距充满画布，任何品牌显示效果统一。
 *
 * color：指定着色时统一覆盖 SVG 全部 fill（品牌主色/白/黑）；缺省保留原色。
 *
 * 采用「重写 viewBox + Blob URL + 全图绘制」而非「drawImage 源矩形裁剪」：
 * 源矩形裁剪在部分目标尺寸下会出现绘制异常（全透明），重写 viewBox 后按全图绘制
 * 稳定可靠，且对所有品牌坐标系（SimpleIcons 字标 / wordmark / 无 viewBox）通用。
 */
async function renderBrandSvgNormalized(id: string, color?: string): Promise<HTMLCanvasElement> {
  const text = await (await fetch(brandSvgUrl(id))).text()
  const geo = parseSvgGeometry(text)
  if (!geo || geo.w <= 0 || geo.h <= 0) {
    throw new Error('SVG 图形边界解析失败')
  }
  // 图形 bbox 四周各扩 PAD_RATIO，并钳制在 viewBox 内
  const padX = geo.w * PAD_RATIO
  const padY = geo.h * PAD_RATIO
  const vbW = geo.vbW || geo.x + geo.w + padX
  const vbH = geo.vbH || geo.y + geo.h + padY
  const x = Math.max(0, geo.x - padX)
  const y = Math.max(0, geo.y - padY)
  const w = Math.min(vbW - x, geo.w + 2 * padX)
  const h = Math.min(vbH - y, geo.h + 2 * padY)
  if (w <= 0 || h <= 0) throw new Error('SVG 图形边界为空')

  // 重写 viewBox，去掉可能干扰的 width/height
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
  const svg = doc.querySelector('svg')
  if (!svg) throw new Error('SVG 解析失败')
  svg.setAttribute('viewBox', `${x} ${y} ${w} ${h}`)
  svg.removeAttribute('width')
  svg.removeAttribute('height')
  // 指定着色：覆盖 fill 的全部三种来源（优先级：内联 style > CSS 块 > fill 属性）。
  // Inkscape/AI 导出的 SVG（canon/hasselblad/ricoh）用 style="fill:#xxx"，
  // 仅 setAttribute('fill') 会被内联样式覆盖导致换色无效，必须同步改写 style。
  if (color) {
    svg.setAttribute('fill', color)
    svg.querySelectorAll('style').forEach((el) => {
      if (el.textContent && /fill\s*:/.test(el.textContent)) {
        el.textContent = el.textContent.replace(/fill\s*:\s*[^;}]+/g, `fill:${color}`)
      }
    })
    svg.querySelectorAll('*').forEach((el) => {
      if (el.hasAttribute('fill')) el.setAttribute('fill', color)
      const style = el.getAttribute('style')
      if (style && /(^|[;\s])fill\s*:/.test(style)) {
        el.setAttribute('style', style.replace(/fill\s*:\s*[^;]+/g, `fill:${color}`))
      }
    })
  }
  const xml = new XMLSerializer().serializeToString(svg)

  const blobUrl = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml' }))
  try {
    const clipImg = await loadImage(blobUrl)
    const canvas = document.createElement('canvas')
    canvas.height = 48
    canvas.width = Math.max(1, Math.round(48 * (w / h)))
    canvas.getContext('2d')!.drawImage(clipImg, 0, 0, canvas.width, canvas.height)
    return canvas
  } finally {
    URL.revokeObjectURL(blobUrl)
  }
}

/** 缓存键：着色与非着色（及不同色值）分开缓存 */
function logoCacheKey(id: string, color?: string): string {
  const c = color && color !== 'auto' ? color : ''
  return c ? `${id}#${c}` : id
}

/** 将内置品牌真实图形 SVG 文件渲染到 Canvas 并缓存（几何规范化 + 可选着色） */
function renderSvgToCache(id: string, color?: string): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  // 同步返回一个占位画布（异步渲染完成前），渲染完成后通过响应式刷新
  canvas.width = 120
  canvas.height = 48
  const key = logoCacheKey(id, color)
  renderBrandSvgNormalized(id, color && color !== 'auto' ? color : undefined)
    .then((norm) => {
      canvas.width = norm.width
      canvas.height = norm.height
      canvas.getContext('2d')!.drawImage(norm, 0, 0)
      cache.set(key, canvas)
      logoVersion.value++
    })
    .catch(() => {
      // 规范化失败：退回原始 SVG 全图
      const img = new Image()
      img.onload = () => {
        canvas.width = img.naturalWidth || 120
        canvas.height = img.naturalHeight || 48
        canvas.getContext('2d')!.drawImage(img, 0, 0)
        cache.set(key, canvas)
        logoVersion.value++
      }
      img.onerror = () => {
        // SVG 资源不存在（apple/insta360 等无图形品牌）：回退文字标记
        cache.set(key, renderTextLogo(id, color && color !== 'auto' ? color : undefined))
        logoVersion.value++
      }
      img.src = brandSvgUrl(id)
    })
  return canvas
}

/**
 * 解析某品牌的 Logo 图像（HTMLCanvasElement）。
 * - 内置品牌：官方 SVG 字标渲染（color 指定时单色化重绘）
 * - 自定义 Logo：返回彩色原图（忽略 color）
 */
export function resolveLogo(id: string, color?: string): HTMLCanvasElement {
  if (id.startsWith(CUSTOM_PREFIX)) {
    const hit = cache.get(id)
    if (hit) return hit
    // 尚未在缓存（可能仍在异步加载），返回空白占位，加载完成后通过响应式刷新
    const blank = document.createElement('canvas')
    blank.width = 1
    blank.height = 1
    return blank
  }

  const key = logoCacheKey(id, color)
  const hit = cache.get(key)
  if (hit) return hit
  return renderSvgToCache(id, color)
}

/**
 * 确保内置品牌 Logo 已加载完成（供导出前预载，避免拿到占位画布）。
 * color 与 resolveLogo 的着色参数一致（'auto' 或色值），缓存键保持一致才能命中。
 * 自定义 Logo 由 initCustomLogos 处理，此处忽略。
 */
export function preloadBrandLogo(id: string, color?: string): Promise<void> {
  if (id.startsWith(CUSTOM_PREFIX)) return Promise.resolve()
  const key = logoCacheKey(id, color)
  const hit = cache.get(key)
  if (hit && hit.width > 1 && hit.height > 1) return Promise.resolve()
  const targetColor = color && color !== 'auto' ? color : undefined
  return renderBrandSvgNormalized(id, targetColor)
    .then((norm) => {
      const canvas = document.createElement('canvas')
      canvas.width = norm.width
      canvas.height = norm.height
      canvas.getContext('2d')!.drawImage(norm, 0, 0)
      cache.set(key, canvas)
      logoVersion.value++
    })
    .catch(() => {
      // 规范化失败：退回原始 SVG 全图
      return new Promise<void>((resolve) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          canvas.width = img.naturalWidth || 120
          canvas.height = img.naturalHeight || 48
          canvas.getContext('2d')!.drawImage(img, 0, 0)
          cache.set(key, canvas)
          logoVersion.value++
          resolve()
        }
        img.onerror = () => {
          // SVG 资源不存在：回退文字标记
          cache.set(key, renderTextLogo(id, targetColor))
          logoVersion.value++
          resolve()
        }
        img.src = brandSvgUrl(id)
      })
    })
}

/** 取得预览用 dataURL（供 <img :src> 使用）。依赖 logoVersion 以在异步加载后刷新 */
export function resolveLogoDataURL(id: string, color?: string): string {
  // 读取 logoVersion 建立响应式依赖；内置品牌首次可能为占位，加载完成后会重新计算
  void logoVersion.value
  return resolveLogo(id, color).toDataURL('image/png')
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
