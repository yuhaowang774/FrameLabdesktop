// 单色 SVG 字标渲染管线（机型字标等使用）。
// 流程与 useLogoStore 的品牌 Logo 管线同构：
//   fetch SVG 文本 → 临时挂载 DOM 用 getBBox 实测实际图形边界（含 <text> 的排版结果）
//   → 重写 viewBox 为「墨迹边界 + 统一内边距」→ Blob 加载 → 按目标高度等比渲染为 Canvas。
// 自带 SVG 文本缓存与资源缺失短路；Canvas 缓存与响应式刷新由调用方（useModelMarkStore）管理。

/** 统一内边距：图形四周各留 4%（与品牌 Logo 同一标准，任何字标显示边距统一） */
export const SVG_MARK_PAD_RATIO = 0.04

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('SVG 解码失败'))
    img.src = src
  })
}

/** 单色套色：source-in 填充保留字形轮廓（字标为单色剪影），连续换色可同步生成 */
export function tintCanvas(base: HTMLCanvasElement, color: string): HTMLCanvasElement {
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

// SVG 原文缓存：同一字标反复换色 / 预览与导出先后触发时避免重复 fetch
const textCache = new Map<string, string>()
// 确认缺失的资源（404）短路后续 fetch
const missing = new Set<string>()
function fetchSvgText(url: string): Promise<string> {
  const hit = textCache.get(url)
  if (hit) return Promise.resolve(hit)
  if (missing.has(url)) return Promise.reject(new Error('SVG 资源不存在'))
  return fetch(url)
    .then((r) => r.text())
    .then((text) => {
      textCache.set(url, text)
      return text
    })
    .catch((err) => {
      missing.add(url)
      throw err
    })
}

/** 解析 SVG 文本中的实际图形边界（联合全部图形的 bbox）与 viewBox 尺寸 */
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
    // 所有路径（成功 / 提前 return / 异常）都必须摘除临时节点，避免反复解析泄漏 DOM
    div.remove()
  }
}

/**
 * 渲染 SVG 字标：自动裁剪到墨迹边界（+统一内边距），按 targetHeight 等比输出 Canvas。
 * 渲染为单色基准（原始颜色），着色由调用方经 tintCanvas 生成变体。
 */
export async function renderSvgMark(svgUrl: string, targetHeight: number): Promise<HTMLCanvasElement> {
  const text = await fetchSvgText(svgUrl)
  const geo = parseSvgGeometry(text)
  if (!geo || geo.w <= 0 || geo.h <= 0) {
    throw new Error('SVG 图形边界解析失败')
  }
  // 图形 bbox 四周各扩 PAD_RATIO，并钳制在 viewBox 内
  const padX = geo.w * SVG_MARK_PAD_RATIO
  const padY = geo.h * SVG_MARK_PAD_RATIO
  const vbW = geo.vbW || geo.x + geo.w + padX
  const vbH = geo.vbH || geo.y + geo.h + padY
  const x = Math.max(0, geo.x - padX)
  const y = Math.max(0, geo.y - padY)
  const w = Math.min(vbW - x, geo.w + 2 * padX)
  const h = Math.min(vbH - y, geo.h + 2 * padY)
  if (w <= 0 || h <= 0) throw new Error('SVG 图形边界为空')

  // 重写 viewBox，去掉可能干扰的 width/height（采用「重写 viewBox + Blob 全图绘制」，
  // 与品牌 Logo 管线一致：源矩形裁剪在部分目标尺寸下会绘制异常）
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml')
  const svg = doc.querySelector('svg')
  if (!svg) throw new Error('SVG 解析失败')
  svg.setAttribute('viewBox', `${x} ${y} ${w} ${h}`)
  svg.removeAttribute('width')
  svg.removeAttribute('height')
  const xml = new XMLSerializer().serializeToString(svg)

  const blobUrl = URL.createObjectURL(new Blob([xml], { type: 'image/svg+xml' }))
  try {
    const img = await loadImage(blobUrl)
    const canvas = document.createElement('canvas')
    canvas.height = Math.max(1, Math.round(targetHeight))
    canvas.width = Math.max(1, Math.round(targetHeight * (w / h)))
    canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height)
    return canvas
  } finally {
    URL.revokeObjectURL(blobUrl)
  }
}
