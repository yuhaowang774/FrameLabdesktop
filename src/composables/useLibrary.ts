// 图库素材库：纯前端本地管理（不上传后端）。
// 使用 objectURL 引用本地文件，支持多图导入、缩略图、多选、删除、选中。
// 桌面端（Tauri）：经 platform/fs 扫描磁盘图片后以 asset 协议 URL 引用绝对路径，
// 不拷贝原图（LrC 理念：素材库只记录引用）。
import { reactive, ref, computed, watch } from 'vue'
import { useFrameConfig, suspendCommit } from './useFrameConfig'
import { importPhoto, removePhotoHistory } from './useHistory'
import { parseExif, buildExifText, formatDate, type ExifParseResult } from './useExif'
import { isTauri } from '../platform/env'

/** 桌面端本地图片条目（磁盘绝对路径） */
export interface LocalImageEntry {
  path: string
  name: string
}

export interface LibraryItem {
  id: string
  name: string
  url: string // objectURL / asset 协议 URL / 静态资源 URL
  /** 缩略图 objectURL（长边 ≤320 JPEG）：图库网格/胶片条/导出选择条使用，
   *  避免为几十像素的缩略图解码整张超大图（96MP 位图 ≈ 数百 MB）。未就绪时回退 url */
  thumbUrl?: string
  /** 已读取的宽高（用于缩略图比例/胶片条） */
  width: number
  height: number
  /** 文件引用，批量导出时回填 EXIF 用（桌面端本地路径导入时为 null） */
  file: File | null
  /** 文件大小（字节）；桌面端本地路径导入时无法直接取到，为 0 */
  size: number
  /** 导入时解析到的该照片 EXIF（品牌/型号/焦距/光圈/快门/ISO），无则为 null */
  exif: ExifParseResult | null
  /** 桌面端磁盘绝对路径（asset URL 引用），网页端为 undefined */
  path?: string
  /** 是否为当前选中（胶片条高亮） */
  selected: boolean
}

const items = reactive<LibraryItem[]>([])
const activeId = ref<string | null>(null)
// Shift 范围选择锚点（最近一次单击/选中项的索引）
let anchorIndex = -1

// ===== 移除确认（LrC 语义：仅从图库移除，不删磁盘原文件）=====
// 模块级单例：Delete/Backspace 快捷键（App.vue）请求移除 → Filmstrip 的确认弹窗 → confirmRemoval 执行
const removalConfirm = ref<{ open: boolean; count: number }>({ open: false, count: 0 })

/** 快捷键请求移除：有选中照片时移除全部选中，否则移除当前活动照片 */
function requestRemoveViaKeyboard(): void {
  const selCount = items.filter((i) => i.selected).length
  const count = selCount > 0 ? selCount : activeId.value ? 1 : 0
  if (!count) return
  removalConfirm.value = { open: true, count }
}
function confirmRemoval(): void {
  if (items.some((i) => i.selected)) {
    items.filter((i) => i.selected).forEach((i) => remove(i.id))
  } else if (activeId.value) {
    remove(activeId.value)
  }
  removalConfirm.value = { open: false, count: 0 }
}
function cancelRemoval(): void {
  removalConfirm.value = { open: false, count: 0 }
}

/** 移除单张：仅从软件图库移除引用与历史链，不碰磁盘原文件 */
function remove(id: string): void {
  const idx = items.findIndex((i) => i.id === id)
  if (idx < 0) return
  releaseUrl(items[idx].url)
  releaseUrl(items[idx].thumbUrl)
  items.splice(idx, 1)
  // 移除照片时清理其独立历史链表（IndexedDB + 内存缓存）
  void removePhotoHistory(id)
  if (activeId.value === id) {
    activeId.value = items.length ? items[Math.min(idx, items.length - 1)].id : null
  }
  // 锚点随列表收缩修正
  if (anchorIndex >= items.length) anchorIndex = items.length - 1
}

function removeSelected(): void {
  const selected = items.filter((i) => i.selected)
  selected.forEach((i) => remove(i.id))
}

// ===== 当前选中照片持久化：刷新后恢复选中态（历史链在 IndexedDB，选中后参数自动回放） =====
const ACTIVE_KEY = 'frame-active-photo'
watch(activeId, () => {
  try {
    const it = items.find((i) => i.id === activeId.value)
    localStorage.setItem(ACTIVE_KEY, JSON.stringify(it ? { id: it.id, path: it.path ?? null } : null))
  } catch {
    /* ignore */
  }
})

/** 启动时恢复上次选中照片：ID 直接命中（种子图等稳定 ID）；否则按桌面端磁盘路径匹配
 *  （桌面端启动重扫文件夹后 ID 会重新生成）。找不到则不动作。 */
export function restoreActive(): void {
  let rec: { id?: string | null; path?: string | null } = {}
  try {
    const raw = localStorage.getItem(ACTIVE_KEY)
    if (raw) rec = JSON.parse(raw) as { id?: string | null; path?: string | null }
  } catch {
    return
  }
  const hit =
    (rec.id ? items.find((i) => i.id === rec.id) : undefined) ??
    (rec.path ? items.find((i) => i.path === rec.path) : undefined)
  if (hit && hit.id !== activeId.value) {
    // 与 select() 相同的选中语义（select 定义在 useLibrary 内部，此处直接实现）
    items.forEach((i) => (i.selected = false))
    hit.selected = true
    activeId.value = hit.id
    anchorIndex = items.indexOf(hit)
  }
}

function makeId(): string {
  return `lib_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

function readSize(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      resolve({ width: img.naturalWidth, height: img.naturalHeight })
      URL.revokeObjectURL(url)
    }
    img.onerror = () => resolve({ width: 0, height: 0 })
    img.src = url
  })
}

/** 从 URL（含桌面端 asset 协议 URL）读取图片宽高 */
function readSizeFromUrl(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => resolve({ width: 0, height: 0 })
    img.src = url
  })
}

/** 仅释放 blob: 前缀的 objectURL（缩略图同此规则）；asset 协议 URL 引用磁盘文件，无需释放 */
function releaseUrl(url?: string): void {
  if (url && url.startsWith('blob:')) URL.revokeObjectURL(url)
}

/** 生成缩略图 objectURL（长边 ≤320，JPEG 0.8）。失败（如 asset URL 跨域污染 canvas）
 *  返回 null，调用方回退使用原图 url。导出供 useSeed 等导入流程复用。 */
export async function makeThumbUrl(url: string, w: number, h: number): Promise<string | null> {
  if (!w || !h) return null
  try {
    const im = new Image()
    im.crossOrigin = 'anonymous'
    await new Promise<void>((res, rej) => {
      im.onload = () => res()
      im.onerror = () => rej(new Error('缩略图源加载失败'))
      im.src = url
    })
    const f = Math.min(1, 320 / Math.max(w, h))
    const tw = Math.max(1, Math.round(w * f))
    const th = Math.max(1, Math.round(h * f))
    const c = document.createElement('canvas')
    c.width = tw
    c.height = th
    const cx = c.getContext('2d')
    if (!cx) return null
    cx.imageSmoothingQuality = 'medium'
    cx.drawImage(im, 0, 0, tw, th)
    const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/jpeg', 0.8))
    return blob ? URL.createObjectURL(blob) : null
  } catch {
    return null
  }
}

export function useLibrary() {
  const activeIndex = computed(() =>
    items.findIndex((i) => i.id === activeId.value),
  )

  async function addFiles(files: File[]): Promise<void> {
    const rejected: string[] = []
    let firstNewId: string | null = null
    for (const file of files) {
      // type 为空（如部分系统的 HEIC/TIFF 拖放）或非图片：Chromium 无法解码，跳过并汇总提示
      if (!file.type.startsWith('image/')) {
        rejected.push(file.name)
        continue
      }
      const { width, height } = await readSize(file)
      // 解码失败（该格式不支持或文件损坏）：不加入图库，避免产生 0×0 的坏条目
      if (!width || !height) {
        rejected.push(file.name)
        continue
      }
      const url = URL.createObjectURL(file)
      const id = makeId()
      if (firstNewId === null) firstNewId = id
      const item: LibraryItem = {
        id,
        name: file.name,
        url,
        width,
        height,
        file,
        size: file.size,
        exif: null,
        selected: false,
      }
      items.push(item)
      // 异步生成缩略图（就绪后 reactive 自动更新列表 UI）
      void makeThumbUrl(url, width, height).then((t) => {
        if (t) item.thumbUrl = t
      })
      // 自动识别该照片的 EXIF（相机型号 / EXIF 文本 / 品牌），失败静默。
      // EXIF 填充属于导入流程的一部分，不应产生历史节点，故期间挂起提交；
      // 导入完成后以最终参数建立该照片历史链的 Import 节点。
      suspendCommit(true)
      try {
        item.exif = await applyExif(file)
      } finally {
        suspendCommit(false)
      }
      const { state } = useFrameConfig()
      const snap = JSON.parse(JSON.stringify(state)) as (typeof state)
      await importPhoto(id, snap, '导入')
    }
    // 导入后若当前无选中照片，自动选中第一张以激活画布与 INFO 层显示
    if (activeId.value === null && firstNewId) select(firstNewId)
    // 汇总提示无法导入的文件（含 type 为空被跳过与解码失败两类），替代静默丢弃
    if (rejected.length) {
      window.alert(
        `以下 ${rejected.length} 个文件无法导入（该格式不支持或文件已损坏）：\n${rejected.join('\n')}`,
      )
    }
  }

  // 自动识别：解析照片 EXIF，自动填充相机型号 / EXIF 文本 / 品牌（不自动显示，
  // 显示与否由 INFO 面板各板块开关控制），并返回解析结果供挂载到该项。失败静默返回 null。
  // source：网页端传 File，桌面端本地路径导入传磁盘字节 ArrayBuffer。
  async function applyExif(source: File | ArrayBuffer): Promise<ExifParseResult | null> {
    try {
      const { patch, state } = useFrameConfig()
      const exif = await parseExif(source)
      // 按当前等效焦距开关拼接（切换开关时由 INFO 面板重拼）
      const text = buildExifText(exif.raw, { eqFocal: state.eqFocal, cropFactor: state.cropFactor })
      const data: Record<string, unknown> = {
        exifText: text,
        exifRaw: exif.raw,
        dateText: formatDate(exif.raw.dateTimeOriginal, state.dateFormat),
      }
      // 导入照片并解析到对应字段后，自动打开画板上的 INFO 元素显示开关。
      // 之前用户反馈「相机型号显示有问题」，常见情况就是解析到了型号但画板未显示。
      if (exif.model) {
        data.cameraModel = exif.model
        data.showCameraModel = true
      }
      if (exif.brandId) data.brand = exif.brandId
      if (exif.lens) {
        data.lensText = exif.lens
        data.showLens = true
      } else {
        // 无镜头信息（手机照片等）：清空镜头文本，避免继承上一张照片的镜头值
        // （各布局对空 lensText 自动隐藏镜头行，card 白底卡同理）
        data.lensText = ''
      }
      if (text) data.showExif = true
      if (data.dateText) data.showDate = true
      patch(data)
      return exif
    } catch {
      /* 无 EXIF 或解析失败：留空，用户可手动填写 */
      return null
    }
  }

  /**
   * 桌面端：把扫描到的本地图片加入图库（asset 协议 URL 引用磁盘路径，不拷贝原图）。
   * 流程与 addFiles 完全一致：EXIF 自动回填（挂起提交）→ 建立该照片历史链 Import 节点。
   */
  async function addLocalEntries(entries: LocalImageEntry[]): Promise<LibraryItem[]> {
    if (!isTauri || !entries.length) return []
    const { assetUrl, readLocalBytes } = await import('../platform/fs')
    const added: LibraryItem[] = []
    let firstNewId: string | null = null
    for (const e of entries) {
      const url = assetUrl(e.path)
      const { width, height } = await readSizeFromUrl(url)
      const id = makeId()
      if (firstNewId === null) firstNewId = id
      const item: LibraryItem = {
        id,
        name: e.name,
        url,
        width,
        height,
        file: null,
        size: 0,
        exif: null,
        path: e.path,
        selected: false,
      }
      items.push(item)
      added.push(item)
      // 异步生成缩略图（asset URL 若污染 canvas 会失败回退原图）
      void makeThumbUrl(url, width, height).then((t) => {
        if (t) item.thumbUrl = t
      })
      suspendCommit(true)
      try {
        const bytes = await readLocalBytes(e.path)
        item.exif = await applyExif(bytes)
      } catch {
        /* 读取失败静默跳过 EXIF */
      } finally {
        suspendCommit(false)
      }
      const { state } = useFrameConfig()
      const snap = JSON.parse(JSON.stringify(state)) as (typeof state)
      await importPhoto(id, snap, '导入')
    }
    if (activeId.value === null && firstNewId) select(firstNewId)
    return added
  }

  function select(id: string): void {
    const target = items.find((i) => i.id === id)
    if (!target) return
    items.forEach((i) => (i.selected = false))
    target.selected = true
    activeId.value = id
    anchorIndex = items.indexOf(target)
  }

  function selectByIndex(index: number): void {
    if (index < 0 || index >= items.length) return
    select(items[index].id)
  }

  function next(): void {
    if (!items.length) return
    const i = activeIndex.value < 0 ? 0 : Math.min(items.length - 1, activeIndex.value + 1)
    selectByIndex(i)
  }

  function prev(): void {
    if (!items.length) return
    const i = activeIndex.value < 0 ? 0 : Math.max(0, activeIndex.value - 1)
    selectByIndex(i)
  }

  function clearAll(): void {
    items.forEach((i) => {
      releaseUrl(i.url)
      releaseUrl(i.thumbUrl)
      void removePhotoHistory(i.id)
    })
    items.splice(0, items.length)
    activeId.value = null
  }

  function toggleSelect(id: string): void {
    const t = items.find((i) => i.id === id)
    if (!t) return
    t.selected = !t.selected
    // Ctrl 点击选上某项时将其作为新的范围锚点（反选时不改动锚点）
    if (t.selected) anchorIndex = items.indexOf(t)
  }

  /** Shift 范围选择：选中从锚点到目标项之间的全部照片（替换当前选择），目标项成为当前照片 */
  function rangeSelect(id: string): void {
    const toIdx = items.findIndex((i) => i.id === id)
    if (toIdx < 0) return
    let from = anchorIndex
    if (from < 0) from = activeIndex.value >= 0 ? activeIndex.value : toIdx
    const lo = Math.min(from, toIdx)
    const hi = Math.max(from, toIdx)
    items.forEach((i, idx) => {
      i.selected = idx >= lo && idx <= hi
    })
    const target = items[toIdx]
    target.selected = true
    activeId.value = target.id
    anchorIndex = toIdx
  }

  function selectAll(): void {
    items.forEach((i) => (i.selected = true))
  }

  function selectNone(): void {
    items.forEach((i) => (i.selected = false))
  }

  function setSelected(ids: string[], value: boolean): void {
    ids.forEach((id) => {
      const t = items.find((i) => i.id === id)
      if (t) t.selected = value
    })
  }

  return {
    items,
    activeId,
    activeIndex,
    addFiles,
    addLocalEntries,
    applyExif,
    select,
    selectByIndex,
    next,
    prev,
    remove,
    removeSelected,
    removalConfirm,
    requestRemoveViaKeyboard,
    confirmRemoval,
    cancelRemoval,
    clearAll,
    toggleSelect,
    rangeSelect,
    setSelected,
    selectAll,
    selectNone,
  }
}
