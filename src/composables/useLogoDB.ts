// 自定义 Logo 持久层（阶段 9）
// 使用原生 IndexedDB，无需额外依赖。每条自定义 Logo 存储为：
//   { id: string, name: string, dataURL: string }
// dataURL 已是 PNG/JPG 的 base64，可直接喂给 <img> 或 drawImage。

import { MAX_CUSTOM_LOGOS } from '../core/constants'

const DB_NAME = 'frame-logos'
const STORE = 'custom-logos'
const VERSION = 1

export interface CustomLogoRecord {
  id: string
  name: string
  dataURL: string
}

let dbPromise: Promise<IDBDatabase> | null = null

function openDB(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' })
      }
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
  return dbPromise
}

function tx(db: IDBDatabase, mode: IDBTransactionMode): IDBObjectStore {
  return db.transaction(STORE, mode).objectStore(STORE)
}

export async function getAllCustomLogos(): Promise<CustomLogoRecord[]> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const req = tx(db, 'readonly').getAll()
    req.onsuccess = () => resolve(req.result as CustomLogoRecord[])
    req.onerror = () => reject(req.error)
  })
}

export async function putCustomLogo(rec: CustomLogoRecord): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const req = tx(db, 'readwrite').put(rec)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

export async function deleteCustomLogo(id: string): Promise<void> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const req = tx(db, 'readwrite').delete(id)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

export async function countCustomLogos(): Promise<number> {
  const db = await openDB()
  return new Promise((resolve, reject) => {
    const req = tx(db, 'readonly').count()
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export { MAX_CUSTOM_LOGOS }
