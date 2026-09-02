// LrC 式图库目录（Catalog）：图库里有什么，目录里就记什么。
// - 目录是权威数据库：启动只按目录还原图库，不重扫文件夹；
//   磁盘新增照片仅在显式导入时进入目录，从图库移除即从目录删除，
//   因此「删除后重启又复活」在语义上不可能发生。
// - 存储：localStorage（Tauri WebView 数据目录随应用持久化，重启按钮不丢）。
// - 零依赖：不引用 useLibrary / fs（二者已动态互引），保持为叶子模块避免循环导入。

const CATALOG_KEY = 'framelab-catalog'

export interface CatalogData {
  /** 目录关联的根文件夹（导入文件夹时记录，元数据）；单张选图导入不改动 */
  folder: string | null
  /** 目录内的磁盘绝对路径（有序、去重） */
  paths: string[]
}

// 进程内缓存：localStorage 只在首次读取时解析，后续读改写全走缓存
let cache: CatalogData | null = null

function read(): CatalogData {
  if (cache) return cache
  cache = parse(localStorage.getItem(CATALOG_KEY))
  return cache
}

function parse(raw: string | null): CatalogData {
  try {
    if (raw) {
      const obj = JSON.parse(raw) as Partial<CatalogData>
      if (obj && typeof obj === 'object') {
        const folder = typeof obj.folder === 'string' && obj.folder ? obj.folder : null
        const paths = Array.isArray(obj.paths)
          ? [...new Set(obj.paths.filter((p): p is string => typeof p === 'string'))]
          : []
        return { folder, paths }
      }
    }
  } catch {
    /* 损坏数据按空目录处理 */
  }
  return { folder: null, paths: [] }
}

function write(data: CatalogData): void {
  cache = data
  try {
    localStorage.setItem(CATALOG_KEY, JSON.stringify(data))
  } catch {
    /* ignore */
  }
}

/** 读取目录快照（返回副本，调用方修改不影响存储） */
export function loadCatalog(): CatalogData {
  const d = read()
  return { folder: d.folder, paths: [...d.paths] }
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
  if (changed) write(d)
}

/** 删除单个路径：从图库移除照片时调用 */
export function catalogRemove(path?: string): void {
  if (!path) return
  const d = read()
  const i = d.paths.indexOf(path)
  if (i >= 0) {
    d.paths.splice(i, 1)
    write(d)
  }
}

/** 清空目录（路径与关联文件夹全部重置）：清除图库时调用 */
export function catalogClear(): void {
  cache = { folder: null, paths: [] }
  try {
    localStorage.removeItem(CATALOG_KEY)
  } catch {
    /* ignore */
  }
}

/** 记录目录关联的根文件夹（元数据，记录最后导入的文件夹） */
export function setCatalogFolder(folder: string | null): void {
  const d = read()
  if (d.folder === folder) return
  write({ folder, paths: d.paths })
}
