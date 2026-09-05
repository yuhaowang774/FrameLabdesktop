// 照片取色色卡：从照片提取主色（k-means，k=5），供 magazine 布局的取色色卡使用。
// 预览与导出共用同一算法：缩小采样 + k-means 聚类 + 按明度升序排列（深→浅，与样张一致）。
import { ref } from 'vue'

/** 采样图最长边（足够取色，开销极小） */
const SAMPLE_MAX = 64
/** k-means 迭代次数 */
const KMEANS_ITERS = 10

/** 单张照片的色卡缓存（键 = photoSrc），预览滚动/重渲染时不重复计算；上限防长会话内存膨胀 */
const cache = new Map<string, string[]>()
const CACHE_LIMIT = 30
/** 版本号：异步提取完成后自增，触发依赖刷新 */
export const paletteVersion = ref(0)

function cachePut(key: string, value: string[]): void {
  if (cache.has(key)) cache.delete(key)
  cache.set(key, value)
  if (cache.size > CACHE_LIMIT) {
    // Map 迭代按插入序：淘汰最旧的一张
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
}

function toHex(r: number, g: number, b: number): string {
  const h = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0')
  return `#${h(r)}${h(g)}${h(b)}`
}

function luminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

/**
 * 从图像源提取 k 个主色（hex），按明度升序（深→浅）。
 * source：HTMLImageElement / HTMLCanvasElement 等 drawImage 可接受的图像源。
 * 提取失败（无 2d 上下文等）返回 null，调用方回退默认色。
 */
export function extractPalette(source: CanvasImageSource, width: number, height: number, k = 5): string[] | null {
  try {
    const scale = Math.min(1, SAMPLE_MAX / Math.max(width || 1, height || 1))
    const w = Math.max(1, Math.round((width || 1) * scale))
    const h = Math.max(1, Math.round((height || 1) * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    if (!ctx) return null
    ctx.drawImage(source, 0, 0, w, h)
    const data = ctx.getImageData(0, 0, w, h).data
    // 收集不透明像素（跳过透明/近白近黑极端噪声像素保留自然分布）
    const px: [number, number, number][] = []
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 125) continue
      px.push([data[i], data[i + 1], data[i + 2]])
    }
    if (!px.length) return null
    // 初始中心：按均匀位置抽 k 个样本（对任意分布都稳定）
    const centers: [number, number, number][] = []
    for (let i = 0; i < k; i++) {
      const p = px[Math.floor(((i + 0.5) / k) * px.length)]
      centers.push([p[0], p[1], p[2]])
    }
    const assign = new Array<number>(px.length).fill(0)
    for (let iter = 0; iter < KMEANS_ITERS; iter++) {
      for (let i = 0; i < px.length; i++) {
        let best = 0
        let bestD = Infinity
        for (let c = 0; c < centers.length; c++) {
          const dr = px[i][0] - centers[c][0]
          const dg = px[i][1] - centers[c][1]
          const db = px[i][2] - centers[c][2]
          const d = dr * dr + dg * dg + db * db
          if (d < bestD) { bestD = d; best = c }
        }
        assign[i] = best
      }
      const sum = centers.map(() => [0, 0, 0, 0])
      for (let i = 0; i < px.length; i++) {
        const a = assign[i]
        sum[a][0] += px[i][0]; sum[a][1] += px[i][1]; sum[a][2] += px[i][2]; sum[a][3]++
      }
      for (let c = 0; c < centers.length; c++) {
        if (sum[c][3] > 0) centers[c] = [sum[c][0] / sum[c][3], sum[c][1] / sum[c][3], sum[c][2] / sum[c][3]]
      }
    }
    // 按明度升序（深→浅）
    return centers
      .slice()
      .sort((a, b) => luminance(a[0], a[1], a[2]) - luminance(b[0], b[1], b[2]))
      .map((c) => toHex(c[0], c[1], c[2]))
  } catch {
    return null
  }
}

/** 兜底色卡（照片无数据/提取失败时的中性蓝灰渐变，与样张气质一致；小写 hex 与提取输出一致） */
export const FALLBACK_PALETTE = ['#1d3a5f', '#2e5a8f', '#4a7fbd', '#8fa8b8', '#a8c4dc']

/**
 * 预览端取色：按 photoSrc 异步加载照片并提取色卡（带缓存）。
 * 返回缓存的即时结果（可能为兜底色），完成后通过 paletteVersion 触发刷新。
 * 桌面端 photoSrc 是 asset 协议 URL：直接绘制 canvas 会污染（getImageData 抛错，
 * extractPalette 内部吞错回退兜底色）——先经 toDrawableUrl 读盘转 dataURL 再提取。
 */
export function paletteFor(photoSrc: string | null): string[] {
  if (!photoSrc) return FALLBACK_PALETTE
  const hit = cache.get(photoSrc)
  if (hit) return hit
  // 未加载过：占位兜底 + 异步提取
  cachePut(photoSrc, FALLBACK_PALETTE)
  void (async () => {
    try {
      let src = photoSrc
      if (/^(?:https?:\/\/asset\.localhost|asset:\/\/localhost)\//.test(photoSrc)) {
        const { toDrawableUrl } = await import('../platform/fs')
        src = await toDrawableUrl(photoSrc)
      }
      const img = new Image()
      await new Promise<void>((res, rej) => {
        img.onload = () => res()
        img.onerror = () => rej(new Error('取色源加载失败'))
        img.src = src
      })
      const pal = extractPalette(img, img.naturalWidth, img.naturalHeight)
      if (pal) cachePut(photoSrc, pal)
    } catch {
      /* 提取失败保持兜底色 */
    }
    paletteVersion.value++
  })()
  return FALLBACK_PALETTE
}
