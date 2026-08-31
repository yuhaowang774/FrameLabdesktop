// 修改历史记录持久层：原生 IndexedDB，每张图片一条独立历史链表。
// 每条历史节点存储：{ id, photoId, name, ts, seq, state }
//  - state 为该时刻的完整 FrameConfig 参数快照（非增量 diff）
//  - seq 为全局单调递增序号，用于保证链表顺序（底部最早 → 顶部最新）
// 链表的"头部追加/跳转截断/清上"等语义由 useHistory 在内存中维护，此处仅负责存取。
import type { FrameConfig } from '../core/types'

const DB_NAME = 'frame-history'
const STORE = 'nodes'
const VERSION = 1

export interface HistoryNodeRecord {
  id: string
  photoId: string
  /** 显示名称（如 "导入"、"背景模糊"、"复位"） */
  name: string
  ts: number
  /** 全局单调递增序号，链表排序依据 */
  seq: number
  /** 该时刻完整参数快照 */
  state: FrameConfig
}

let dbPromise: Promise<IDBDatabase> | null = null
// 全局 seq 计数：加载节点时以最大 seq 为起点，保证新增节点序号单调
let globalSeq = 0

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        const store = db.createObjectStore(STORE, { keyPath: 'id' })
        // 按照片 id 索引：取某张照片的整条链表
        store.createIndex('photoId', 'photoId', { unique: false })
      }
    }
    req.onsuccess = () => {
      globalSeq = 0 // 重新打开后由 load 阶段重建
      resolve(req.result)
    }
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function store(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(STORE, mode).objectStore(STORE)
}

/** 记录 seq 起点：任意一次读取后调用，确保后续新增节点 seq 严格递增 */
export function trackSeq(recs: { seq: number }[]): void {
  for (const r of recs) {
    if (r.seq > globalSeq) globalSeq = r.seq
  }
}

export function nextSeq(): number {
  globalSeq += 1
  return globalSeq
}

/** 读取某张照片的整条历史链表（按 seq 升序 = 底部 Import 最早 → 顶部最新） */
export async function loadPhotoNodes(photoId: string): Promise<HistoryNodeRecord[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const req = store(db, 'readonly').index('photoId').getAll(photoId)
    req.onsuccess = () => {
      const recs = (req.result as HistoryNodeRecord[]).sort((a, b) => a.seq - b.seq)
      trackSeq(recs)
      resolve(recs)
    }
    req.onerror = () => reject(req.error)
  })
}

/** 写入/更新一条历史节点 */
export async function putHistoryNode(rec: HistoryNodeRecord): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const req = store(db, 'readwrite').put(rec)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

/** 批量删除指定节点（清除历史上方 / 截断分支用） */
export async function deleteHistoryNodes(ids: string[]): Promise<void> {
  if (!ids.length) return
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, 'readwrite')
    const s = t.objectStore(STORE)
    ids.forEach((id) => s.delete(id))
    t.oncomplete = () => resolve()
    t.onerror = () => reject(t.error)
  })
}

/** 删除单张照片的整条历史链表 */
export async function deletePhotoChain(photoId: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, 'readwrite')
    const s = t.objectStore(STORE)
    const req = s.index('photoId').getAllKeys(photoId)
    req.onsuccess = () => {
      const keys = req.result as string[]
      keys.forEach((k) => s.delete(k))
      t.oncomplete = () => resolve()
    }
    t.onerror = () => reject(t.error)
  })
}

/** 批量删除多张照片的历史链表（防数据库无限膨胀 / 批量清除接口） */
export async function deletePhotoChains(photoIds: string[]): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const t = db.transaction(STORE, 'readwrite')
    const s = t.objectStore(STORE)
    const seen = new Set<string>()
    photoIds.forEach((pid) => {
      if (seen.has(pid)) return
      seen.add(pid)
      const req = s.index('photoId').getAllKeys(pid)
      req.onsuccess = () => {
        const keys = req.result as string[]
        keys.forEach((k) => s.delete(k))
      }
    })
    t.oncomplete = () => resolve()
    t.onerror = () => reject(t.error)
  })
}

/** 统计所有历史节点数量（监控数据库膨胀） */
export async function countHistoryNodes(): Promise<number> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const req = store(db, 'readonly').count()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

/** 清空全部历史节点（全局清理接口） */
export async function clearAllHistoryNodes(): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const req = store(db, 'readwrite').clear()
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}
