// 文件能力适配层：
// - 网页端：保留 <input> 上传 / <a download> 浏览器下载模式。
// - Tauri 桌面端：文件、目录、对话框读写全部经 invoke 走 Rust IPC Command，
//   前端（WebView）不直接访问本地文件系统；图片经 asset 协议 URL 引用磁盘路径，
//   不拷贝、不上传原图。
// 小配置键（上次打开的文件夹等）与网页版一致，直接走 localStorage
// （Tauri WebView 的 localStorage 随应用数据目录持久化）。
import { isTauri } from './env'
import { downloadBlob } from '../core/exporter'
import type { LibraryItem, LocalImageEntry } from '../composables/useLibrary'
import { loadCatalog, setCatalogFolder, catalogPruneMeta } from './catalog'

// Tauri API 一律惰性动态加载：网页端构建/运行不依赖 @tauri-apps/api 包
let convertFileSrcFn: ((path: string) => string) | null = null

async function ensureAssetApi(): Promise<void> {
  if (!isTauri || convertFileSrcFn) return
  convertFileSrcFn = (await import('@tauri-apps/api/core')).convertFileSrc
}

async function tauriInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(cmd, args)
}

/** 本地磁盘路径 → WebView 可显示的 asset 协议 URL（仅桌面端调用；需先 ensureAssetApi） */
export function assetUrl(path: string): string {
  return isTauri && convertFileSrcFn ? convertFileSrcFn(path) : path
}

// ===== 桌面端：图片选择与目录扫描 =====

/** 桌面端：系统对话框选择多张本地图片，返回绝对路径列表 */
export async function pickImageFiles(): Promise<LocalImageEntry[]> {
  const paths = await tauriInvoke<string[]>('pick_image_files')
  return paths.map((p) => ({ path: p, name: p.split(/[\\/]/).pop() || p }))
}

/** 桌面端：选择本地文件夹并扫描图片（含子目录，深度由 Rust 端限制） */
export async function pickImageFolder(): Promise<{ folder: string; images: LocalImageEntry[] } | null> {
  const folder = await tauriInvoke<string | null>('pick_folder')
  if (!folder) return null
  const images = await listDirImages(folder, true)
  return { folder, images }
}

/** 桌面端：扫描目录内图片 */
export async function listDirImages(dir: string, recursive: boolean): Promise<LocalImageEntry[]> {
  return tauriInvoke<LocalImageEntry[]>('list_dir_images', { dir, recursive })
}

/**
 * 桌面端：监听窗口文件拖放（Tauri 原生事件，需 WebviewWindow drag_and_drop 开启）。
 * 拖入的是真实磁盘路径 → 调用方走 addLocalEntries 导入（进 catalog 持久化，重启可还原），
 * 与菜单「导入照片…」同链路；拖入非图片文件（含文件夹）自动过滤。
 * 返回取消监听函数；网页端不应调用。
 */
export async function onDropImageFiles(
  onHover: (over: boolean) => void,
  onDropEntries: (entries: LocalImageEntry[]) => void,
): Promise<() => void> {
  const { getCurrentWebview } = await import('@tauri-apps/api/webview')
  return getCurrentWebview().onDragDropEvent((event) => {
    if (event.payload.type === 'enter' || event.payload.type === 'over') {
      onHover(true)
    } else if (event.payload.type === 'leave') {
      onHover(false)
    } else if (event.payload.type === 'drop') {
      onHover(false)
      const entries = event.payload.paths
        .filter(isImagePath)
        .map((p) => ({ path: p, name: p.split(/[\\/]/).pop() || p }))
      if (entries.length) onDropEntries(entries)
    }
  })
}

// ===== 桌面端：字节读取（EXIF / 自定义背景） =====

export function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

function extOf(path: string): string {
  const m = path.match(/\.([A-Za-z0-9]+)$/)
  return m ? m[1].toLowerCase() : ''
}

const MIME: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  jfif: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp',
  avif: 'image/avif',
}

/** 支持的图片扩展名集合（与 Rust 端 IMAGE_EXTS 对齐） */
const IMAGE_EXT_SET: ReadonlySet<string> = new Set(Object.keys(MIME))

/** 路径扩展名是否为支持的图片（拖放导入过滤用） */
export function isImagePath(p: string): boolean {
  return IMAGE_EXT_SET.has(extOf(p))
}

/** 桌面端：读取本地文件全部内容（base64） */
export async function readLocalBase64(path: string): Promise<string> {
  return tauriInvoke<string>('read_file_base64', { path })
}

/**
 * 桌面端：读取本地文件原始字节（二进制 IPC）。
 * 走 read_file_bytes（tauri::ipc::Response 二进制通道）：80MB 照片不再经历
 * base64 编码（+33%）与 JSON 字符串序列化的多份副本，IPC 瞬时内存降到单份数据本体。
 * read_file_base64 版本保留给确需字符串的场景（dataURL 持久化等）。
 */
export async function readLocalBytes(path: string): Promise<ArrayBuffer> {
  const buf = await tauriInvoke<ArrayBuffer>('read_file_bytes', { path })
  if (buf instanceof ArrayBuffer) return buf
  // 兜底：某些宿主版本返回 Uint8Array 视图
  const u8 = buf as unknown as Uint8Array
  const ab = new ArrayBuffer(u8.byteLength)
  new Uint8Array(ab).set(u8)
  return ab
}

export interface ImageMeta {
  width: number
  height: number
  size: number
  /** 修改时间（Unix 秒）：目录元数据缓存指纹用 */
  mtime: number
}

/** 桌面端：仅解析图片头拿宽高与文件大小（不解码像素，毫秒级）——导入提速关键路径。
 *  JPEG 走 jpeg-decoder read_info，PNG 手工解析 IHDR；其它格式/失败返回 null，
 *  调用方回退 Image 全尺寸解码（旧路径）。 */
export async function readImageMeta(path: string): Promise<ImageMeta | null> {
  try {
    const buf = await tauriInvoke<ArrayBuffer>('read_image_meta', { path })
    const v = new DataView(buf)
    return {
      width: v.getUint32(0, true),
      height: v.getUint32(4, true),
      size: Number(v.getBigUint64(8, true)),
      mtime: v.byteLength >= 24 ? Number(v.getBigUint64(16, true)) : 0,
    }
  } catch {
    return null
  }
}

/** 桌面端：只读文件前 len 字节（EXIF 头部解析用，避免大图全量读盘） */
export async function readLocalHead(path: string, len: number): Promise<ArrayBuffer> {
  const buf = await tauriInvoke<ArrayBuffer>('read_file_head', { path, len })
  if (buf instanceof ArrayBuffer) return buf
  const u8 = buf as unknown as Uint8Array
  const ab = new ArrayBuffer(u8.byteLength)
  new Uint8Array(ab).set(u8)
  return ab
}

/**
 * 桌面端：读取持久化缩略图（指纹 = 路径 + mtime + 大小，Rust 侧自行校验）。
 * 命中返回 JPEG ArrayBuffer（Rust 约定未命中返回空字节），启动还原零解码显示缩略图。
 */
export async function thumbFor(path: string): Promise<ArrayBuffer | null> {
  try {
    const buf = await tauriInvoke<ArrayBuffer>('thumb_get', { path })
    if (buf instanceof ArrayBuffer) return buf.byteLength ? buf : null
    const u8 = buf as unknown as Uint8Array
    if (!u8.byteLength) return null
    const ab = new ArrayBuffer(u8.byteLength)
    new Uint8Array(ab).set(u8)
    return ab
  } catch (e) {
    // 审查报告 T12：失败留痕（不打断流程，降级为重新生成缩略图）
    console.warn('[fs] 读取缩略图缓存失败（降级为重新生成）：', e)
    return null
  }
}

/** 桌面端：持久化缩略图（blob 转 base64 上传，Rust 按当前文件指纹落盘并清理旧指纹） */
export async function saveThumb(path: string, blob: Blob): Promise<void> {
  try {
    const buf = new Uint8Array(await blob.arrayBuffer())
    let bin = ''
    const CHUNK = 0x8000
    for (let i = 0; i < buf.length; i += CHUNK) {
      bin += String.fromCharCode(...buf.subarray(i, i + CHUNK))
    }
    await tauriInvoke('thumb_put', { path, dataBase64: btoa(bin) })
  } catch (e) {
    // 审查报告 T12：失败留痕（仅影响下次启动速度，不打断当前流程）
    console.warn('[fs] 缩略图持久化失败（仅影响下次启动速度）：', e)
  }
}

/** 桌面端：读取本地图片并转为 dataURL（自定义背景持久化用） */
export async function readLocalDataURL(path: string): Promise<string> {
  const b64 = await readLocalBase64(path)
  const mime = MIME[extOf(path)] || 'image/png'
  return `data:${mime};base64,${b64}`
}

/** 桌面端：读取本地图片为同源 Blob（带正确 MIME），供 createImageBitmap 解码。
 *  走二进制 IPC（readLocalBytes）：Blob 由解码器流式消费，无 base64 中间副本。 */
export async function readLocalBlob(path: string): Promise<Blob> {
  const ab = await readLocalBytes(path)
  const mime = MIME[extOf(path)] || 'image/png'
  return new Blob([ab], { type: mime })
}

/**
 * 桌面端：读取 JPEG 并由 Rust 在解码阶段直接缩放（DCT 1/2·1/4·1/8），返回同源 canvas。
 * 内存关键路径：渲染进程里 createImageBitmap(blob, resize) 对 96MP JPEG 会产生 ~3.9GB
 * 瞬时分配（全尺寸位图 + 缩放中间缓冲），是「进入编辑模式提交内存冲上 5GB / 渲染进程
 * OOM 崩溃」的根因。Rust 侧缩放解码后跨 IPC 只有缩放后 RGBA（96MP@1/4 ≈ 24MB）。
 * 非 JPEG / CMYK 等解码失败时返回 null，调用方回退 createImageBitmap 路径。
 */
export async function readPreviewCanvas(path: string, longMax: number): Promise<HTMLCanvasElement | null> {
  try {
    const buf = await tauriInvoke<ArrayBuffer>('read_preview_bytes', { path, longMax })
    const view = new DataView(buf)
    const w = view.getUint32(0, true)
    const h = view.getUint32(4, true)
    if (!w || !h) return null
    const rgba = new Uint8ClampedArray(buf, 8, w * h * 4)
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.putImageData(new ImageData(rgba, w, h), 0, 0)
    return canvas
  } catch (e) {
    // 审查报告 T12：留痕（非 JPEG / 解码失败属预期降级路径，调用方回退 createImageBitmap）
    console.warn('[fs] Rust 预览解码失败（回退前端解码）：', e)
    return null
  }
}

/** asset 协议 URL 判定（Tauri convertFileSrc 在 Windows 生成 http://asset.localhost/<encoded-path>） */
export function isAssetProtocolUrl(url: string): boolean {
  return /^(?:https?:\/\/asset\.localhost|asset:\/\/localhost)\/.+/.test(url)
}

/**
 * 任意图片 URL → canvas 可绘制 URL（桌面端 asset 协议 → dataURL，其余原样返回）。
 * 桌面端照片引用是 asset 协议 URL：直接绘制到 canvas 会因 CORS 污染画布，导致
 * toBlob / getImageData 抛 SecurityError（导出报 Tainted canvases、缩略图/取色失败的根因）。
 * 读盘转 dataURL 后为同源数据，可安全绘制；网页端（blob:/data:）不经过此路径。
 */
export async function toDrawableUrl(url: string): Promise<string> {
  if (!isTauri || !isAssetProtocolUrl(url)) return url
  const hit = url.match(/^(?:https?:\/\/asset\.localhost|asset:\/\/localhost)\/(.+)$/)
  try {
    return await readLocalDataURL(decodeURIComponent(hit![1]))
  } catch {
    return url // 读盘失败（文件被移动等）仍按原 URL 尝试，由调用方兜底
  }
}

// ===== 导出落盘（双端） =====

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => {
      const s = String(r.result)
      resolve(s.slice(s.indexOf(',') + 1))
    }
    r.onerror = reject
    r.readAsDataURL(blob)
  })
}

/**
 * 保存合成结果：
 * - 桌面端：弹出系统保存对话框，经 Rust 写入所选路径；取消返回 null。
 * - 网页端：触发浏览器下载，返回 null。
 * 返回值：桌面端成功保存的绝对路径（供「打开所在文件夹」定位）；其余 null。
 */
export async function saveBlobAs(blob: Blob, filename: string): Promise<string | null> {
  if (!isTauri) {
    downloadBlob(blob, filename)
    return null
  }
  const path = await tauriInvoke<string | null>('save_file_dialog', { defaultName: filename })
  if (!path) return null
  const b64 = await blobToBase64(blob)
  await tauriInvoke('write_file_base64', { path, base64Data: b64 })
  return path
}

/** 桌面端：在资源管理器中定位文件（explorer /select，仅 Windows；网页端不应调用） */
export async function revealInExplorer(path: string): Promise<void> {
  await tauriInvoke('reveal_path', { path })
}

/** 桌面端：选择导出保存目录 */
export async function pickExportFolder(): Promise<string | null> {
  return tauriInvoke<string | null>('pick_folder')
}

/** 桌面端：路径是否已存在 */
async function pathExists(path: string): Promise<boolean> {
  return tauriInvoke<boolean>('path_exists', { path })
}

/** 桌面端：把合成结果写入指定目录；重名自动加序号（name.jpg → name-2.jpg …），返回实际写入路径 */
export async function writeBlobTo(folder: string, filename: string, blob: Blob): Promise<string> {
  const sep = folder.includes('\\') && !folder.includes('/') ? '\\' : '/'
  const dot = filename.lastIndexOf('.')
  const stem = dot > 0 ? filename.slice(0, dot) : filename
  const ext = dot > 0 ? filename.slice(dot) : ''
  let target = `${folder}${sep}${filename}`
  for (let n = 2; await pathExists(target); n++) {
    target = `${folder}${sep}${stem}-${n}${ext}`
  }
  const b64 = await blobToBase64(blob)
  await tauriInvoke('write_file_base64', { path: target, base64Data: b64 })
  return target
}

// ===== 图库接入（桌面端） =====

/** 旧版（≤0.1.7）「上次文件夹」键：仅一次性迁移到目录时读取 */
const LEGACY_LAST_FOLDER_KEY = 'framelab-last-folder'
/** 旧版墓碑键：仅一次性迁移时读取过滤 */
const LEGACY_REMOVED_KEY = 'framelab-removed-paths'

/** 桌面端：把本地图片加入图库（只记录路径，不拷贝原图） */
export async function addLocalEntries(entries: LocalImageEntry[]): Promise<LibraryItem[]> {
  await ensureAssetApi()
  const { useLibrary } = await import('../composables/useLibrary')
  return useLibrary().addLocalEntries(entries)
}

/** 桌面端：选择文件夹 → 扫描 → 加入图库，并记录目录关联文件夹。
 *  目录权威（LrC 语义）：文件夹里新增的照片不会自动出现，需再次导入；
 *  从图库移除的照片也不会因重启而回来。 */
export async function loadFolderIntoLibrary(
  result: { folder: string; images: LocalImageEntry[] },
): Promise<number> {
  const items = await addLocalEntries(result.images)
  setCatalogFolder(result.folder)
  return items.length
}

/**
 * 桌面端启动恢复：只按目录还原图库，不重扫文件夹（LrC 目录语义）。
 * - 目录有记录：按父目录分组批量确认存在性（每目录一次扫描，避免逐路径 invoke）；
 *   文件已不在磁盘的路径跳过加载（记录保留在目录里，文件恢复后自动回来）；
 *   目录暂不可访问（如移动硬盘未挂载）时按 LrC 容错整组还原，缺失文件显示为
 *   坏条目，不会因一次扫描失败清空图库。
 * - 目录为空：一次性迁移旧版数据（上次文件夹扫描 − 旧墓碑 → 导入即写入目录），
 *   先清旧键再导入（导入中断不会重扫复活），之后启动永远只认目录。
 */
export async function restoreLibrary(): Promise<void> {
  const cat = loadCatalog()
  if (!cat.paths.length) {
    await migrateLegacyLibrary()
    return
  }
  // 按父目录分组（捕获最后一个分隔符前的部分；无分隔符的裸路径单独判定）
  // 审查报告 T20：盘根（C:\a.jpg → "C:"）与 UNC 共享根不能走目录扫描校验——
  // "C:" 的 read_dir 语义是「该盘当前工作目录」（通常是 exe 所在目录）而非盘根，
  // 会把盘根照片误判为「文件已不存在」而跳过。此类无父目录情形归为 '' 组，逐条 pathExists 校验。
  const byDir = new Map<string, string[]>()
  for (const p of cat.paths) {
    const m = p.match(/^(.*)[/\\][^/\\]+$/)
    let dir = m ? m[1] : ''
    if (/^[a-zA-Z]:$/.test(dir)) dir = '' // 盘根（C: / D: …）
    if (/^[/\\]{2}[^/\\]+[/\\][^/\\]+$/.test(dir)) dir = '' // UNC 共享根（\\server\share）
    const list = byDir.get(dir)
    if (list) list.push(p)
    else byDir.set(dir, [p])
  }
  const entries: LocalImageEntry[] = []
  for (const [dir, paths] of byDir) {
    let existing: Set<string> | null = null
    let existingStats: Map<string, { mt: number; sz: number }> | null = null
    if (dir) {
      try {
        const listing = await listDirImages(dir, false)
        existing = new Set(listing.map((i) => i.path))
        // 目录扫描顺带拿到 mtime/size 指纹：元数据缓存命中即可零解码零读盘还原
        existingStats = new Map(listing.map((i) => [i.path, { mt: i.mtime ?? 0, sz: i.size ?? 0 }]))
      } catch {
        existing = null // 目录暂不可访问：容错，该组全部还原
      }
    }
    for (const p of paths) {
      if (existing && !existing.has(p)) continue // 文件已不在磁盘：跳过加载
      if (!dir && !(await pathExists(p).catch(() => false))) continue
      const stat = existingStats?.get(p)
      entries.push({ path: p, name: p.split(/[\\/]/).pop() || p, mtime: stat?.mt, size: stat?.sz })
    }
  }
  if (entries.length) await addLocalEntries(entries)
  // 还原收尾：清掉已不在目录内的元数据缓存残留
  catalogPruneMeta()
}

/** 旧版「启动重扫上次文件夹 + 墓碑过滤」数据一次性迁移为目录 */
async function migrateLegacyLibrary(): Promise<void> {
  let last = ''
  let removed: ReadonlySet<string> | null = null
  try {
    last = localStorage.getItem(LEGACY_LAST_FOLDER_KEY) || ''
    const raw = localStorage.getItem(LEGACY_REMOVED_KEY)
    if (raw) {
      const arr = JSON.parse(raw) as unknown
      if (Array.isArray(arr)) {
        removed = new Set(arr.filter((p): p is string => typeof p === 'string'))
      }
    }
  } catch {
    /* ignore */
  }
  if (!last) return
  // 先清旧键再导入：迁移中途退出也不会在下次启动重扫复活
  try {
    localStorage.removeItem(LEGACY_LAST_FOLDER_KEY)
    localStorage.removeItem(LEGACY_REMOVED_KEY)
  } catch {
    /* ignore */
  }
  try {
    const images = await listDirImages(last, true)
    const fresh =
      removed && removed.size ? images.filter((i) => !removed.has(i.path)) : images
    setCatalogFolder(last)
    if (fresh.length) await addLocalEntries(fresh)
  } catch {
    /* 文件夹已不可访问：不迁移，目录保持为空，用户可重新导入 */
  }
}
