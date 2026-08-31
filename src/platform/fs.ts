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
 * - 桌面端：弹出系统保存对话框，经 Rust 写入所选路径；取消返回 false。
 * - 网页端：触发浏览器下载。
 */
export async function saveBlobAs(blob: Blob, filename: string): Promise<boolean> {
  if (!isTauri) {
    downloadBlob(blob, filename)
    return true
  }
  const path = await tauriInvoke<string | null>('save_file_dialog', { defaultName: filename })
  if (!path) return false
  const b64 = await blobToBase64(blob)
  await tauriInvoke('write_file_base64', { path, base64Data: b64 })
  return true
}

/** 桌面端：选择导出保存目录 */
export async function pickExportFolder(): Promise<string | null> {
  return tauriInvoke<string | null>('pick_folder')
}

/** 桌面端：把合成结果写入指定目录 */
export async function writeBlobTo(folder: string, filename: string, blob: Blob): Promise<void> {
  const sep = folder.includes('\\') && !folder.includes('/') ? '\\' : '/'
  const path = `${folder}${sep}${filename}`
  const b64 = await blobToBase64(blob)
  await tauriInvoke('write_file_base64', { path, base64Data: b64 })
}

// ===== 图库接入（桌面端） =====

export const LAST_FOLDER_KEY = 'framelab-last-folder'

/** 桌面端：把扫描到的本地图片加入图库（只记录路径，不拷贝原图） */
export async function addLocalEntries(entries: LocalImageEntry[]): Promise<LibraryItem[]> {
  await ensureAssetApi()
  const { useLibrary } = await import('../composables/useLibrary')
  return useLibrary().addLocalEntries(entries)
}

/** 桌面端：选择文件夹 → 扫描 → 加入图库，并记住文件夹路径 */
export async function loadFolderIntoLibrary(
  result: { folder: string; images: LocalImageEntry[] },
): Promise<number> {
  const items = await addLocalEntries(result.images)
  try {
    localStorage.setItem(LAST_FOLDER_KEY, result.folder)
  } catch {
    /* ignore */
  }
  return items.length
}

/** 桌面端：启动时恢复上次打开的文件夹（目录失效则静默清除） */
export async function restoreLastFolder(): Promise<void> {
  let last = ''
  try {
    last = localStorage.getItem(LAST_FOLDER_KEY) || ''
  } catch {
    /* ignore */
  }
  if (!last) return
  try {
    const images = await listDirImages(last, true)
    await addLocalEntries(images)
  } catch {
    try {
      localStorage.removeItem(LAST_FOLDER_KEY)
    } catch {
      /* ignore */
    }
  }
}
