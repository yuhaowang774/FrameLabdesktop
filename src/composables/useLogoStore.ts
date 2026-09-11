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
// 审查报告 S16：着色变体（键含 #色值）无上限——取色器连续拖动每帧产生一个中间色。
// 超限时仅淘汰变体，保留所有无色基准（key=id）与自定义缓存（custom:*）。
const CACHE_MAX = 48
function trimBrandCache(): void {
  if (cache.size <= CACHE_MAX) return
  for (const key of [...cache.keys()]) {
    if (cache.size <= CACHE_MAX) break
    if (key.includes('#')) cache.delete(key)
  }
}
/** 写入着色变体后的统一入口（自动维护变体上限） */
function setVariant(key: string, canvas: HTMLCanvasElement): void {
  cache.set(key, canvas)
  trimBrandCache()
}
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

/** 生成文本 Logo 并存入自定义 Logo（IndexedDB 持久化，全链路复用）。返回新 Logo id */
export async function addTextLogo(text: string, opts?: { color?: string }): Promise<string> {
  const content = text.trim()
  if (!content) throw new Error('请输入 Logo 文本')
  if (getCustomCount() >= MAX_CUSTOM_LOGOS) {
    throw new Error(`自定义 Logo 已达上限（${MAX_CUSTOM_LOGOS} 个）`)
  }
  const canvas = document.createElement('canvas')
  const probe = document.createElement('canvas').getContext('2d')!
  probe.font = TEXT_LOGO_FONT
  const w = Math.max(48, Math.ceil(probe.measureText(content).width) + 24)
  canvas.width = w
  canvas.height = 96
  const ctx = canvas.getContext('2d')!
  ctx.font = TEXT_LOGO_FONT
  ctx.fillStyle = opts?.color || '#ffffff'
  ctx.textBaseline = 'middle'
  ctx.fillText(content, 12, canvas.height / 2)
  const dataURL = canvas.toDataURL('image/png')
  const img = await loadImage(dataURL)
  const id = makeId()
  const rec: CustomLogoRecord = { id, name: content, dataURL }
  await putCustomLogo(rec)
  customImages.set(id, img)
  customMeta.set(id, content)
  renderCustomToCache(id)
  return id
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
    // 审查报告 S7：载入完成后 bump 版本——此前不 bump，早于加载渲染的 1×1 占位
    // 不会被刷新，自定义 Logo 长期空白（仅别的品牌渲染时才偶然恢复）
    logoVersion.value++
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

// SVG 原文缓存：同一品牌反复换色/换主题时避免重复 fetch（着色管线重做，fetch 免除）
const svgTextCache = new Map<string, string>()
// 确认无 SVG 资源的品牌（redmi/realme/iqoo 等文字标记品牌）：短路后续 fetch 404
const svgMissing = new Set<string>()
function fetchSvgText(id: string): Promise<string> {
  const hit = svgTextCache.get(id)
  if (hit) return Promise.resolve(hit)
  if (svgMissing.has(id)) return Promise.reject(new Error('SVG 资源不存在'))
  return fetch(brandSvgUrl(id))
    .then((r) => r.text())
    .then((text) => {
      svgTextCache.set(id, text)
      return text
    })
    .catch((err) => {
      svgMissing.add(id)
      throw err
    })
}

/** 解析 SVG 文本中的实际图形边界（联合全部 path 的 bbox）与 viewBox 尺寸 */
function parseSvgGeometry(
  text: string,
): { x: number; y: number; w: number; h: number; vbW: number; vbH: number } | null {
  const div = document.createElement('div')
  try {
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
    if (!isFinite(bb.x) || !isFinite(bb.y) || !isFinite(bb.width) || !isFinite(bb.height)) return null
    return { x: bb.x, y: bb.y, w: bb.width, h: bb.height, vbW, vbH }
  } catch {
    return null
  } finally {
    // 审查报告 S12：成功 / 提前 return / 异常都必须摘除临时节点
    //（此前各失败路径都会在 body 留下一个 400×100 隐藏 div，反复解析持续泄漏）
    div.remove()
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
  const text = await fetchSvgText(id)
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

/** 无色基准画布同步套色：source-in 填充保留字形轮廓（内置 SVG 字标与文字标记均为单色剪影）。
 *  着色变体因此可以同步生成 —— 取色器连续拖动时颜色即时生效，无需再走
 *  「fetch SVG → DOM 解析 → Blob 解码」异步管线（此前变色延迟数秒的根因）。 */
function tintCanvas(base: HTMLCanvasElement, color: string): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = base.width
  c.height = base.height
  const ctx = c.getContext('2d')!
  ctx.drawImage(base, 0, 0)
  ctx.globalCompositeOperation = 'source-in'
  ctx.fillStyle = color
  ctx.fillRect(0, 0, c.width, c.height)
  return c
}

/** 确保品牌「无色基准」画布就绪：SVG 几何规范化渲染 → 原图回退 → 文字标记兜底。
 *  基准始终缓存于 key = id；着色变体由调用方用 tintCanvas 同步生成。 */
function ensureBrandBase(id: string): Promise<HTMLCanvasElement | null> {
  const hit = cache.get(id)
  if (hit && hit.width > 1) return Promise.resolve(hit)
  return renderBrandSvgNormalized(id)
    .then((norm) => {
      const base = document.createElement('canvas')
      base.width = norm.width
      base.height = norm.height
      base.getContext('2d')!.drawImage(norm, 0, 0)
      cache.set(id, base)
      return base
    })
    .catch(() => {
      // 规范化失败：退回原始 SVG 全图；资源不存在（redmi/realme/iqoo 等无图形品牌）回退文字标记
      return new Promise<HTMLCanvasElement | null>((resolve) => {
        const img = new Image()
        img.onload = () => {
          const base = document.createElement('canvas')
          base.width = img.naturalWidth || 120
          base.height = img.naturalHeight || 48
          base.getContext('2d')!.drawImage(img, 0, 0)
          cache.set(id, base)
          resolve(base)
        }
        img.onerror = () => {
          svgMissing.add(id)
          const base = renderTextLogo(id)
          cache.set(id, base)
          resolve(base)
        }
        img.src = brandSvgUrl(id)
      })
    })
}

/** 基准未就绪时的兜底入口：同步返回占位画布，基准就绪后套色写入缓存并触发响应式刷新 */
function renderBrandToCache(id: string, color?: string): HTMLCanvasElement {
  const placeholder = document.createElement('canvas')
  placeholder.width = 120
  placeholder.height = 48
  const key = logoCacheKey(id, color)
  void ensureBrandBase(id).then((base) => {
    if (!base) return
    const target = color && color !== 'auto' ? color : undefined
    setVariant(key, target ? tintCanvas(base, target) : base)
    logoVersion.value++
  })
  return placeholder
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
  const targetColor = color && color !== 'auto' ? color : undefined
  // 着色变体：无色基准已就绪时同步套色返回（连续变色的关键路径，全程无异步等待）
  if (targetColor) {
    const base = cache.get(id)
    if (base && base.width > 1) {
      const tinted = tintCanvas(base, targetColor)
      setVariant(key, tinted)
      return tinted
    }
  }
  // 基准未就绪（首次加载）：走异步管线，完成后经 logoVersion 触发响应式重算
  return renderBrandToCache(id, targetColor)
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
  // 无色基准已就绪：同步套色，无需任何异步管线
  const base = cache.get(id)
  if (base && base.width > 1) {
    setVariant(key, targetColor ? tintCanvas(base, targetColor) : base)
    logoVersion.value++
    return Promise.resolve()
  }
  return ensureBrandBase(id).then((ready) => {
    if (!ready) return
    setVariant(key, targetColor ? tintCanvas(ready, targetColor) : ready)
    logoVersion.value++
  })
}

/** 取得预览用 dataURL（供 <img :src> 使用）。依赖 logoVersion 以在异步加载后刷新 */
// dataURL 缓存：PNG 编码（toDataURL）每次数百 µs~数 ms，Logo 颜色在取色器里高频变化时
// 未缓存的实现会让 <img> 持续重解码导致明显卡顿。按 logoVersion 失效。
const dataUrlCache = new Map<string, string>()
let dataUrlCacheVersion = -1
export function resolveLogoDataURL(id: string, color?: string): string {
  // 读取 logoVersion 建立响应式依赖；内置品牌首次可能为占位，加载完成后会重新计算
  const ver = logoVersion.value
  if (ver !== dataUrlCacheVersion) {
    dataUrlCache.clear()
    dataUrlCacheVersion = ver
  }
  const key = id.startsWith(CUSTOM_PREFIX) ? id : logoCacheKey(id, color)
  const hit = dataUrlCache.get(key)
  if (hit !== undefined) return hit
  const logo = resolveLogo(id, color)
  const url = logo.toDataURL('image/png')
  // 审查报告 S7：未就绪自定义 Logo 的 1×1 占位不写缓存——否则会永久停留在空白
  //（initCustomLogos 完成 bump logoVersion 后重新计算）
  if (!(id.startsWith(CUSTOM_PREFIX) && (logo.width <= 1 || logo.height <= 1))) {
    dataUrlCache.set(key, url)
    // 取色器连续拖动会产生大量中间色 dataURL：超上限整表清空（下次按需重建，成本低）
    if (dataUrlCache.size > 64) dataUrlCache.clear()
  }
  return url
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
    /** 响应式版本号：异步加载/缓存更新后自增，供 UI 列表与预览刷新（审查报告 U12） */
    logoVersion,
    listCustomLogos,
    uploadCustomLogo,
    addTextLogo,
    removeCustomLogo,
    getCustomCount,
    CUSTOM_PREFIX,
  }
}
