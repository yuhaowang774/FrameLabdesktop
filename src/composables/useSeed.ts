// 开发调试专用：启动时把种子照片内置到图库（便于联调基础信息面板/EXIF 流程）。
// 仅在 DEV 构建下由 main.ts 动态 import；生产构建经死代码消除后本模块与种子图片均不会进入产物。
import { suspendCommit, useFrameConfig } from './useFrameConfig'
import { importPhoto } from './useHistory'
import { loadPhotoNodes } from './useHistoryDB'
import { useLibrary, makeThumbUrl, restoreActive, type LibraryItem } from './useLibrary'

const SEED_IMAGES: { url: string; name: string }[] = [
  { url: new URL('../assets/seed/dsc3164.jpg', import.meta.url).href, name: '_DSC3164-已增强-SR-1.jpg' },
  { url: new URL('../assets/seed/dsc3887.jpg', import.meta.url).href, name: '_DSC3887-30.JPG' },
  { url: new URL('../assets/seed/dji0697.jpg', import.meta.url).href, name: 'DJI_0697-9.JPG' },
]

/** 从 URL 读取图片宽高 */
function readSizeFromUrl(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => resolve({ width: 0, height: 0 })
    img.src = url
  })
}

/** 内置种子照片到图库：与 addFiles 同流程（EXIF 回填挂起提交 + Import 历史节点） */
export async function seedBuiltin(): Promise<void> {
  const lib = useLibrary()
  for (const s of SEED_IMAGES) {
    let blob: Blob | null = null
    try {
      const res = await fetch(s.url)
      if (!res.ok) continue
      blob = await res.blob()
    } catch {
      continue // 种子资源缺失时静默跳过
    }
    const id = `lib_seed_${s.name}`
    // 重复启动防护（热重载会重新执行）：同名种子已在图库则跳过
    if (lib.items.some((i) => i.id === id)) continue
    const { width, height } = await readSizeFromUrl(s.url)
    const item: LibraryItem = {
      id,
      name: s.name,
      url: s.url,
      width,
      height,
      file: null,
      size: blob.size,
      exif: null,
      selected: false,
    }
    lib.items.push(item)
    // 异步缩略图：胶片条/图库用小图，避免为 88px 缩略图解码 96MP 原图
    void makeThumbUrl(s.url, width, height).then((t) => {
      if (t) item.thumbUrl = t
    })
    suspendCommit(true)
    try {
      item.exif = await lib.applyExif(await blob.arrayBuffer())
    } finally {
      suspendCommit(false)
    }
    const { state } = useFrameConfig()
    const snap = JSON.parse(JSON.stringify(state)) as typeof state
    // 链已存在（上次启动导入过该种子）：保留既有历史链不重建，避免每次刷新清掉编辑记录
    const existing = await loadPhotoNodes(id)
    if (!existing.length) await importPhoto(id, snap, '导入')
  }
  // 种子入库完成后再恢复选中态（种子为异步加载，main.ts 的早期调用可能扑空）
  restoreActive()
}
