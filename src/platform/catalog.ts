// LrC 式图库目录（Catalog）：图库里有什么，目录里就记什么。
// - 目录是权威数据库：启动只按目录还原图库，不重扫文件夹；
//   磁盘新增照片仅在显式导入时进入目录，从图库移除即从目录删除，
//   因此「删除后重启又复活」在语义上不可能发生。
// - 存储（桌面端）：AppData JSON 文件（Rust 命令 read/write_app_json，同步 fs::write 落盘）。
//   不再依赖 WebView localStorage——updater 静默安装重启会硬杀 WebView 进程，
//   localStorage（LevelDB）未 flush 即回滚/损坏，曾导致「更新后图库清空」；
//   普通文件毫秒级落盘，且 app_data_dir 由 identifier 决定，与安装形态（安装版/绿色版）无关。
// - 存储（网页端）：localStorage（浏览器无文件能力）。
// - 旧版迁移：桌面端首次载入时若文件为空而 localStorage 存有旧目录，一次性迁移进文件。
// - 零依赖：仅引 isTauri（叶子模块），Tauri API 惰性动态加载，避免与 fs.ts 循环导入。
import { isTauri } from './env'

const CATALOG_KEY = 'framelab-catalog'
/** 桌面端 AppData JSON 文件名（Rust 端 data_file 白名单化后为 framelab-catalog.json） */
const CATALOG_FILE = 'framelab-catalog'

export interface CatalogData {
  /** 目录关联的根文件夹（导入文件夹时记录，元数据）；单张选图导入不改动 */
  folder: string | null
  /** 目录内的磁盘绝对路径（有序、去重） */
  paths: string[]
  /** 上次选中的照片路径（恢复选中态用；桌面端随目录文件持久化，比 localStorage 可靠） */
  activePath?: string | null
  /**
   * 每路径元数据缓存（宽高/大小/mtime/EXIF 解析结果）：启动还原时指纹命中即零解码、
   * 零头部读取直接还原图库。纯加速缓存，可整体丢弃——缺失/失配走原解析路径并回写。
   * mtime+size 与文件指纹一致才视为有效；条目删除时同步清理。
   */
  meta?: Record<string, CatalogMeta>
}

/** 单路径元数据缓存（ExifParseResult 纯 JSON 结构，可安全序列化） */
export interface CatalogMeta {
  w: number
  h: number
  sz: number
  /** 修改时间（Unix 秒），与文件 mtime 比对判定缓存有效性 */
  mt: number
  /** EXIF 解析结果（无 EXIF 照片为 null：命中时同样跳过解析尝试） */
  exif: unknown
}

// 进程内缓存：持久层只在首次读取时解析，后续读改写全走缓存
let cache: CatalogData | null = null
/** 桌面端：目录文件是否已载入（ensureCatalogLoaded 幂等保护） */
let loaded = false

function parse(raw: string | null | undefined): CatalogData {
  try {
    if (raw) {
      const obj = JSON.parse(raw) as Partial<CatalogData>
      if (obj && typeof obj === 'object') {
        const folder = typeof obj.folder === 'string' && obj.folder ? obj.folder : null
        const paths = Array.isArray(obj.paths)
          ? [...new Set(obj.paths.filter((p): p is string => typeof p === 'string'))]
          : []
        const activePath =
          typeof obj.activePath === 'string' && obj.activePath ? obj.activePath : null
        // meta 缓存宽容解析：非对象/字段缺型按无缓存处理（存量旧格式自然兼容）
        const meta: Record<string, CatalogMeta> = {}
        if (obj.meta && typeof obj.meta === 'object') {
          for (const [p, m] of Object.entries(obj.meta as Record<string, unknown>)) {
            const v = m as Partial<CatalogMeta> | null
            if (
              v &&
              typeof v === 'object' &&
              typeof v.w === 'number' &&
              typeof v.h === 'number' &&
              typeof v.sz === 'number' &&
              typeof v.mt === 'number'
            ) {
              meta[p] = { w: v.w, h: v.h, sz: v.sz, mt: v.mt, exif: v.exif ?? null }
            }
          }
        }
        return { folder, paths, activePath, meta }
      }
    }
  } catch {
    /* 损坏数据按空目录处理 */
  }
  return { folder: null, paths: [], activePath: null, meta: {} }
}

function isEmpty(d: CatalogData): boolean {
  return !d.paths.length && !d.folder && !d.activePath
}

// ===== 持久化写入调度：去抖合并 + 单飞串行 =====
// 背景（审查报告 T3）：此前每次变更（catalogAdd / catalogSetMeta / catalogSetActive）都
// fire-and-forget 发起一次全量写；批量导入上千张 = 数千次互不等待的 IPC 写同一文件，
// 并发截断写互相交错会产出半截 JSON（解析失败被当空目录 → 下次写回即图库丢失）。
// 现改为：250ms 去抖合并 + 单飞串行（同一时刻至多一个在飞写入，写完若有新变更再补一轮）。
const WRITE_DEBOUNCE_MS = 250
let writeTimer: ReturnType<typeof setTimeout> | null = null
let writeInFlight: Promise<void> | null = null
let dirty = false

/** 把缓存写入持久层：网页端 localStorage；桌面端 AppData JSON（不阻塞 UI） */
function persist(): void {
  if (!cache) return
  dirty = true
  if (writeTimer) return
  writeTimer = setTimeout(() => {
    writeTimer = null
    void flushPersist()
  }, WRITE_DEBOUNCE_MS)
}

/** 立即落盘（去抖到期 / 退出前调用）。单飞串行：写入期间的新变更会在完成后自动补写一轮。 */
export function flushPersist(): Promise<void> {
  if (writeInFlight) return writeInFlight
  if (!dirty) return Promise.resolve()
  if (writeTimer) {
    clearTimeout(writeTimer)
    writeTimer = null
  }
  dirty = false
  const json = cache ? JSON.stringify(cache) : null
  writeInFlight = (async () => {
    if (json === null) return
    if (!isTauri) {
      try {
        localStorage.setItem(CATALOG_KEY, json)
      } catch {
        /* ignore */
      }
      return
    }
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('write_app_json', { filename: CATALOG_FILE, content: json })
    } catch (e) {
      // 审查报告 T12：写盘失败留痕（目录变更可能未落盘，仅影响下次恢复）
      console.warn('[catalog] 目录写盘失败：', e)
    }
  })().finally(() => {
    writeInFlight = null
    if (dirty) void flushPersist() // 写入期间又有变更：补一轮
  })
  return writeInFlight
}

// 退出前尽量落盘（覆盖去抖窗口内的变更；网页端 localStorage 为同步写入，必然成功）
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    void flushPersist()
  })
}

/**
 * 桌面端启动：从 AppData JSON 载入目录（在首次 loadCatalog / restoreLibrary 之前调用）。
 * - 文件有数据 → 直接作为目录权威；
 * - 文件为空 → 尝试把 localStorage 旧键（0.1.29 及以前版本）一次性迁移进文件；
 * - 进程内已有数据（极早期同步写）时不覆盖，避免竞态丢失。
 */
export async function ensureCatalogLoaded(): Promise<void> {
  if (!isTauri || loaded) return
  let raw: string | null = null
  try {
    const { invoke } = await import('@tauri-apps/api/core')
    raw = await invoke<string | null>('read_app_json', { filename: CATALOG_FILE })
  } catch {
    loaded = true // 读文件失败：降级走 localStorage 旧行为
    return
  }
  const fromFile = parse(raw)
  if (cache === null) {
    if (!isEmpty(fromFile)) {
      cache = fromFile
    } else {
      // 文件为空：迁移 localStorage 旧目录（正常升级场景）
      const legacy = parse(localStorage.getItem(CATALOG_KEY))
      if (!isEmpty(legacy)) {
        cache = legacy
        persist()
      }
    }
  }
  loaded = true
  // 迁移完成后清理 localStorage 旧键，避免陈旧副本混淆（文件此后为唯一权威）
  try {
    if (localStorage.getItem(CATALOG_KEY)) localStorage.removeItem(CATALOG_KEY)
  } catch {
    /* ignore */
  }
}

function read(): CatalogData {
  if (cache) return cache
  // 文件载入前的兜底（桌面端正常时序下 ensureCatalogLoaded 已先行完成）
  cache = parse(localStorage.getItem(CATALOG_KEY))
  return cache
}

/** 读取目录快照（返回副本，调用方修改不影响存储） */
export function loadCatalog(): CatalogData {
  const d = read()
  return {
    folder: d.folder,
    paths: [...d.paths],
    activePath: d.activePath ?? null,
    meta: { ...(d.meta ?? {}) },
  }
}

/** 追加路径（已存在则忽略，保持顺序）；导入图库成功后调用 */
export function catalogAdd(paths: Iterable<string>): void {
  const d = read()
  const has = new Set(d.paths)
  let changed = false
  for (const p of paths) {
    if (p && !has.has(p)) {
      d.paths.push(p)
      has.add(p)
      changed = true
    }
  }
  if (changed) persist()
}

/** 删除单个路径：从图库移除照片时调用（同步清理该路径的元数据缓存） */
export function catalogRemove(path?: string): void {
  if (!path) return
  const d = read()
  const i = d.paths.indexOf(path)
  if (i >= 0) {
    d.paths.splice(i, 1)
    if (d.meta && d.meta[path]) delete d.meta[path]
    persist()
  }
}

/** 清空目录（路径与关联文件夹全部重置）：清除图库时调用。
 *  桌面端必须把空目录写回文件（目录是权威数据库，否则重启恢复旧目录） */
export function catalogClear(): void {
  cache = { folder: null, paths: [], activePath: null, meta: {} }
  persist()
  if (!isTauri) {
    try {
      localStorage.removeItem(CATALOG_KEY)
    } catch {
      /* ignore */
    }
  }
}

/** 读取路径的元数据缓存（无则 null） */
export function catalogGetMeta(path: string): CatalogMeta | null {
  return read().meta?.[path] ?? null
}

/** 写入路径的元数据缓存（导入/还原时解析成功后回写，下次启动零解析） */
export function catalogSetMeta(path: string, meta: CatalogMeta): void {
  const d = read()
  if (!d.meta) d.meta = {}
  d.meta[path] = meta
  persist()
}

/** 裁剪元数据缓存：只保留仍在目录内的路径（启动还原末尾调用，防已移除路径残留） */
export function catalogPruneMeta(): void {
  const d = read()
  if (!d.meta) return
  const keep = new Set(d.paths)
  let changed = false
  for (const p of Object.keys(d.meta)) {
    if (!keep.has(p)) {
      delete d.meta[p]
      changed = true
    }
  }
  if (changed) persist()
}

/** 记录目录关联的根文件夹（元数据，记录最后导入的文件夹） */
export function setCatalogFolder(folder: string | null): void {
  const d = read()
  if (d.folder === folder) return
  cache = { ...d, folder }
  persist()
}

/** 记录上次选中的照片路径（恢复选中态用；随目录文件持久化） */
export function catalogSetActive(path: string | null): void {
  const d = read()
  if ((d.activePath ?? null) === path) return
  cache = { ...d, activePath: path }
  persist()
}
