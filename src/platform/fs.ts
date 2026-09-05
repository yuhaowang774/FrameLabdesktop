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
import { loadCatalog, setCatalogFolder } from './catalog'

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

/** 桌面端：读取本地文件全部内容（base64） */
export async function readLocalBase64(path: string): Promise<string> {
  return tauriInvoke<string>('read_file_base64', { path })
}

/** 桌面端：读取本地图片字节（EXIF 解析用） */
export async function readLocalBytes(path: string): Promise<ArrayBuffer> {
  const b64 = await readLocalBase64(path)
  const u8 = base64ToBytes(b64)
  const ab = new ArrayBuffer(u8.byteLength)
  new Uint8Array(ab).set(u8)
  return ab
}

/** 桌面端：读取本地图片并转为 dataURL（自定义背景持久化用） */
export async function readLocalDataURL(path: string): Promise<string> {
  const b64 = await readLocalBase64(path)
  const mime = MIME[extOf(path)] || 'image/png'
  return `data:${mime};base64,${b64}`
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
  // 按父目录分组（捕获含尾分隔符的目录部分；无分隔符的裸路径单独判定）
  const byDir = new Map<string, string[]>()
  for (const p of cat.paths) {
    const m = p.match(/^(.*[/\\])/)
    const dir = m ? m[1].replace(/[/\\]+$/, '') : ''
    const list = byDir.get(dir)
    if (list) list.push(p)
    else byDir.set(dir, [p])
  }
  const entries: LocalImageEntry[] = []
  for (const [dir, paths] of byDir) {
    let existing: Set<string> | null = null
    if (dir) {
      try {
        existing = new Set((await listDirImages(dir, false)).map((i) => i.path))
      } catch {
        existing = null // 目录暂不可访问：容错，该组全部还原
      }
    }
    for (const p of paths) {
      if (existing && !existing.has(p)) continue // 文件已不在磁盘：跳过加载
      if (!dir && !(await pathExists(p).catch(() => false))) continue
      entries.push({ path: p, name: p.split(/[\\/]/).pop() || p })
    }
  }
  if (entries.length) await addLocalEntries(entries)
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
