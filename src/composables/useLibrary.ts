// 图库素材库：纯前端本地管理（不上传后端）。
// 使用 objectURL 引用本地文件，支持多图导入、缩略图、多选、删除、选中。
// 桌面端（Tauri）：经 platform/fs 扫描磁盘图片后以 asset 协议 URL 引用绝对路径，
// 不拷贝原图（LrC 理念：素材库只记录引用）。
import { reactive, ref, computed, watch } from 'vue'
import { useFrameConfig, suspendCommit } from './useFrameConfig'
import { importPhoto, removePhotoHistory } from './useHistory'
import { parseExif, buildExifText, formatDate, type ExifParseResult } from './useExif'
import { isTauri } from '../platform/env'
import {
  catalogAdd,
  catalogClear,
  catalogRemove,
  catalogSetActive,
  catalogGetMeta,
  catalogSetMeta,
  loadCatalog,
} from '../platform/catalog'

/** 桌面端本地图片条目（磁盘绝对路径）。
 *  mtime/size 来自目录扫描（list_dir_images），启动还原时用于校验元数据缓存指纹；
 *  文件对话框导入（pick_image_files）无此二者，回退 read_image_meta 取指纹。 */
export interface LocalImageEntry {
  path: string
  name: string
  mtime?: number
  size?: number
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
// 桌面端 EXIF 头部读取上限：EXIF 存于 JPEG APP1 段（规格上限 64KB/段），2MB 绰绰有余；
// 只读头部替代全文件读盘（84MB 照片全量 IO 是导入/启动还原慢的主因）
const EXIF_HEAD_BYTES = 2 * 1024 * 1024

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

/** 移除单张：仅从软件图库移除引用与历史链，不碰磁盘原文件；
 *  磁盘路径同步从目录删除，重启后不会自动加回 */
function remove(id: string): void {
  const idx = items.findIndex((i) => i.id === id)
  if (idx < 0) return
  catalogRemove(items[idx].path)
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
// 桌面端选中态随目录文件持久化（catalogSetActive，AppData JSON，不怕 WebView 数据丢失）；
// localStorage 键保留为网页端主存储 + 桌面端旧版兜底。
const ACTIVE_KEY = 'frame-active-photo'
watch(activeId, () => {
  const it = items.find((i) => i.id === activeId.value)
  catalogSetActive(it?.path ?? null)
  try {
    // 无选中照片时移除键而非写入 "null"：JSON.stringify(null) 会让下次启动
    // 的 restoreActive 解析出 null 并崩溃（0.2.0 白屏根因）
    if (it) localStorage.setItem(ACTIVE_KEY, JSON.stringify({ id: it.id, path: it.path ?? null }))
    else localStorage.removeItem(ACTIVE_KEY)
  } catch {
    /* ignore */
  }
})

/** 启动时恢复上次选中照片：ID 直接命中（种子图等稳定 ID）；其次按桌面端磁盘路径匹配
 *  （桌面端启动按目录还原图库后 ID 会重新生成）；最后按目录文件记录的 activePath 匹配。
 *  找不到则不动作。
 *  注意：localStorage 键在「图库清空」时会写入字符串 "null"（JSON.stringify(null)），
 *  JSON.parse 得到 null——此处必须判空，否则启动即抛 TypeError 白屏（0.2.0 用户实测）。 */
export function restoreActive(): void {
  let rec: { id?: string | null; path?: string | null } = {}
  try {
    const raw = localStorage.getItem(ACTIVE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as { id?: string | null; path?: string | null } | null
      if (parsed && typeof parsed === 'object') rec = parsed
    }
  } catch {
    /* ignore：旧键损坏不阻断，目录文件里的 activePath 仍可恢复 */
  }
  const catActive = loadCatalog()?.activePath ?? null
  const hit =
    (rec.id ? items.find((i) => i.id === rec.id) : undefined) ??
    (rec.path ? items.find((i) => i.path === rec.path) : undefined) ??
    (catActive ? items.find((i) => i.path === catActive) : undefined)
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
    // 审查报告 S3：成功 / 失败都必须释放 objectURL（此前 onerror 分支泄漏全尺寸 URL）
    const done = (width: number, height: number) => {
      URL.revokeObjectURL(url)
      resolve({ width, height })
    }
    img.onload = () => done(img.naturalWidth, img.naturalHeight)
    img.onerror = () => done(0, 0)
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

// ===== 缩略图生成（全局限流）=====
// 生成一张缩略图需要解码原图（桌面端走 Rust DCT 缩放解码，单张峰值仅 ~6MB RGBA；
// 网页端 createImageBitmap 解码期降采样）。全局限流防批量导入时解码峰值叠加：
// 桌面端单张内存小，并发 4 张缩略图生成速度与内存占用平衡最优。
let thumbActive = 0
const thumbQueue: (() => void)[] = []
const THUMB_CONCURRENCY = 4
function acquireThumbSlot(): Promise<void> {
  if (thumbActive < THUMB_CONCURRENCY) {
    thumbActive++
    return Promise.resolve()
  }
  return new Promise((res) => thumbQueue.push(res))
}
function releaseThumbSlot(): void {
  const next = thumbQueue.shift()
  if (next) next()
  else thumbActive = Math.max(0, thumbActive - 1)
}

/** 生成缩略图 objectURL（长边 ≤320，JPEG 0.8）。
 *  内存关键路径（此前三版实现的教训）：
 *  - 桌面端 asset URL 直接绘制会因跨域污染 canvas 失败 → 必须先取同源数据；
 *  - 用 Image 元素 + drawImage 解码：Chromium 图像缓存会按 URL 滞留整张全尺寸
 *    解码位图（96MP ≈ 400MB/张），几张就把渲染进程推到 2GB+；
 *  - createImageBitmap(blob, resize) 在渲染进程内对 96MP 仍有 ~3.9GB 瞬时分配
 *    （全尺寸位图 + 缩放中间缓冲），批量导入/启动还原时 OOM 崩溃；
 *  - 现桌面端走 Rust DCT 缩放解码（readPreviewCanvas，跨 IPC 仅缩放后 RGBA），
 *    网页端保留 createImageBitmap(blob, { resize })（JPEG 解码阶段降采样）。
 *  全局限流（并发 2）防止批量导入时解码峰值叠加。失败返回 null（UI 显示占位）。 */
export async function makeThumbUrl(url: string, w: number, h: number): Promise<string | null> {
  if (!w || !h) return null
  await acquireThumbSlot()
  try {
    const f = Math.min(1, 320 / Math.max(w, h))
    const tw = Math.max(1, Math.round(w * f))
    const th = Math.max(1, Math.round(h * f))
    // 桌面端 asset 协议：Rust 侧 DCT 缩放解码（96MP@1/8 档 ≈ 6MB RGBA）
    const assetHit = url.match(/^(?:https?:\/\/asset\.localhost|asset:\/\/localhost)\/(.+)$/)
    if (assetHit) {
      try {
        const { readPreviewCanvas } = await import('../platform/fs')
        const src = await readPreviewCanvas(decodeURIComponent(assetHit[1]), 320)
        if (src) {
          const c = document.createElement('canvas')
          c.width = tw
          c.height = th
          const cx = c.getContext('2d')
          if (cx) {
            cx.drawImage(src, 0, 0, tw, th)
            const out = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/jpeg', 0.8))
            return out ? URL.createObjectURL(out) : null
          }
        }
      } catch {
        /* 读盘失败：无缩略图，UI 显示占位而非原图 */
      }
      return null
    }
    // 网页端：统一取同源 Blob 后解码期降采样
    const blob = await (await fetch(url)).blob()
    const bmp = await createImageBitmap(blob, {
      resizeWidth: tw,
      resizeHeight: th,
      resizeQuality: 'medium',
    })
    const c = document.createElement('canvas')
    c.width = bmp.width
    c.height = bmp.height
    const cx = c.getContext('2d')
    if (!cx) {
      bmp.close()
      return null
    }
    cx.drawImage(bmp, 0, 0)
    bmp.close() // 立即释放解码位图（这是内存峰值的主体）
    const out = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/jpeg', 0.8))
    return out ? URL.createObjectURL(out) : null
  } catch {
    return null
  } finally {
    releaseThumbSlot()
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
      // 必须先 reactive 化再 push：后续异步回调对 item 的赋值（thumbUrl/exif）才能
      // 走 proxy set 触发渲染；对 raw 对象直写不通知依赖，缩略图要等其它状态
      // 变更引发重渲染才显示（用户表现为「点击后缩略图才陆续出现」）
      const item = reactive<LibraryItem>({
        id,
        name: file.name,
        url,
        width,
        height,
        file,
        size: file.size,
        exif: null,
        selected: false,
      })
      items.push(item)
      // 异步生成缩略图（就绪后 reactive 自动更新列表 UI）；
      // 回填前判条目存活，避免 objectURL 落在已移除条目上永不释放（审查报告 S3）
      void makeThumbUrl(url, width, height).then((t) => {
        if (!t) return
        if (!items.includes(item)) {
          releaseUrl(t)
          return
        }
        item.thumbUrl = t
      })
      // 自动识别该照片的 EXIF（相机型号 / EXIF 文本 / 品牌），失败静默。
      // 审查报告 S1：补丁不再直接改全局 state——仅并入本照片的导入快照；
      // 只有本照片将成为导入后的当前照片（此前无选中）时才同步应用到全局画布，
      // 其余照片在切换到它们时按各自历史恢复，批量导入因此不会互相污染。
      item.exif = await parseExifQuiet(file)
      const exifPatch = item.exif ? buildExifPatch(item.exif) : null
      const { state, patch } = useFrameConfig()
      let snap = JSON.parse(JSON.stringify(state)) as (typeof state)
      if (exifPatch) snap = { ...snap, ...exifPatch } as typeof snap
      const becomesActive = activeId.value === null && firstNewId === id
      if (becomesActive && exifPatch) {
        suspendCommit(true)
        try {
          patch(exifPatch)
        } finally {
          suspendCommit(false)
        }
      }
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

  // 自动识别：解析照片 EXIF（不改全局配置；结果供「导入快照」与「成为当前照片时应用」）。
  // source：网页端传 File，桌面端本地路径导入传磁盘字节 ArrayBuffer。失败静默返回 null。
  async function parseExifQuiet(source: File | ArrayBuffer): Promise<ExifParseResult | null> {
    try {
      return await parseExif(source)
    } catch {
      /* 无 EXIF 或解析失败：留空，用户可手动填写 */
      return null
    }
  }

  /**
   * 依据 EXIF 解析结果构建参数补丁（纯函数，不修改全局 state）。
   * 审查报告 S1：此前导入流程直接 patch 全局 state——批量导入 / 启动还原时
   * 「最后一张的 EXIF」会残留成当前活动照片的显示值，并被后续编辑写进该照片历史链。
   * 现改为：补丁仅并入「该照片自己的导入快照」，仅当照片成为当前照片时才应用到全局。
   * 缺字段（无型号 / 无镜头 / 无日期）时显式清空并隐藏，避免继承上一张照片的信息。
   */
  function buildExifPatch(exif: ExifParseResult): Record<string, unknown> {
    const { state } = useFrameConfig()
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
    } else {
      data.cameraModel = ''
      data.showCameraModel = false
    }
    if (exif.brandId) data.brand = exif.brandId
    if (exif.lens) {
      data.lensText = exif.lens
      data.showLens = true
    } else {
      // 无镜头信息（手机照片等）：清空镜头文本，避免继承上一张照片的镜头值
      // （各布局对空 lensText 自动隐藏镜头行，card 白底卡同理）
      data.lensText = ''
      data.showLens = false
    }
    if (text) data.showExif = true
    else data.showExif = false
    if (data.dateText) data.showDate = true
    else {
      data.dateText = ''
      data.showDate = false
    }
    return data
  }

  /**
   * 桌面端：把本地图片加入图库（asset 协议 URL 引用磁盘路径，不拷贝原图）。
   * 目录权威（LrC 语义）：同一路径已在图库则跳过；成功加入的路径逐条写入目录
   * （随加随记，导入中断也不丢失已导入部分），是启动还原的唯一依据。
   *
   * 提速三层（启动还原零解码的关键）：
   * 1. 目录元数据缓存（catalog meta）：指纹（mtime+size）命中 → 宽高/大小/EXIF 直接取缓存，
   *    零读盘零解析；未命中才走头解析/头部读取，成功后回写缓存供下次命中；
   * 2. 缩略图磁盘缓存（AppData/thumbs）：指纹命中 → 直接读小 JPEG 回 objectURL，
   *    完全跳过原图解码（启动还原最大头）；未命中生成后立即持久化；
   * 3. 元数据/EXIF 解析按 4 路并行批量预取（原逐张串行，首图出现更慢）。
   */
  async function addLocalEntries(entries: LocalImageEntry[]): Promise<LibraryItem[]> {
    if (!isTauri || !entries.length) return []
    const {
      assetUrl,
      readLocalBytes,
      readLocalHead,
      readImageMeta,
      thumbFor,
      saveThumb,
    } = await import('../platform/fs')
    const added: LibraryItem[] = []
    let firstNewId: string | null = null
    const known = new Set(items.map((i) => i.path))
    const fresh = entries.filter((e) => e.path && !known.has(e.path))

    /** 单条解析：优先目录元数据缓存（指纹校验），未命中走头解析并回写缓存 */
    async function resolveMeta(e: LocalImageEntry): Promise<{
      width: number
      height: number
      fileSize: number
      exif: ExifParseResult | null
    }> {
      let cached = catalogGetMeta(e.path)
      let mt = e.mtime
      let sz = e.size
      // 条目缺指纹（文件对话框导入）→ read_image_meta 补取（毫秒级，不解码）
      if (cached && (mt === undefined || sz === undefined)) {
        const m = await readImageMeta(e.path)
        if (m) {
          mt = m.mtime
          sz = m.size
        } else {
          cached = null
        }
      }
      // 指纹失配（文件被外部修改）→ 缓存作废走原解析
      if (cached && mt !== undefined && sz !== undefined && (cached.mt !== mt || cached.sz !== sz)) {
        cached = null
      }
      if (cached) {
        return { width: cached.w, height: cached.h, fileSize: cached.sz, exif: (cached.exif ?? null) as ExifParseResult | null }
      }
      // 未命中：宽高/大小走 Rust 头解析（替代旧 Image 全尺寸解码），EXIF 只读头部 2MB
      let width = 0
      let height = 0
      let fileSize = 0
      let metaMtime = 0
      const m = await readImageMeta(e.path)
      if (m) {
        width = m.width
        height = m.height
        fileSize = m.size
        metaMtime = m.mtime
      }
      if (!width || !height) {
        const dim = await readSizeFromUrl(assetUrl(e.path))
        width = dim.width
        height = dim.height
      }
      let exif: ExifParseResult | null = null
      try {
        exif = await parseExif(await readLocalHead(e.path, EXIF_HEAD_BYTES))
      } catch {
        // 头部解析失败且文件更大时才回退全量重试一次
        if (fileSize > EXIF_HEAD_BYTES) {
          try {
            exif = await parseExif(await readLocalBytes(e.path))
          } catch {
            /* 无 EXIF 或解析失败：留空 */
          }
        }
      }
      // 回写缓存（有指纹才写：指纹不可知时缓存无法校验有效性，宁可不写）
      if (mt !== undefined || metaMtime) {
        catalogSetMeta(e.path, { w: width, h: height, sz: fileSize, mt: mt ?? metaMtime, exif })
      }
      return { width, height, fileSize, exif }
    }

    // 4 路并行解析 + 每批就绪即入列（渐进显示：首批就绪图库即开始出现，不等全部解析完）
    const pending = [...fresh]
    while (pending.length) {
      const batch = pending.splice(0, 4)
      const metas = await Promise.all(
        batch.map((e) =>
          resolveMeta(e).catch(() => {
            /* 单条失败：宽高 0 的坏条目由下方守卫跳过 */
            return null
          }),
        ),
      )
      for (let i = 0; i < batch.length; i++) {
        const e = batch[i]
        const meta = metas[i]
        // 解码失败（该格式不支持或文件损坏）：不加入图库，避免产生 0×0 的坏条目
        if (!meta || !meta.width || !meta.height) continue
        const url = assetUrl(e.path)
        const id = makeId()
        if (firstNewId === null) firstNewId = id
        // 同 addFiles：先 reactive 化再 push，异步缩略图/EXIF 赋值才触发渲染
        const item = reactive<LibraryItem>({
          id,
          name: e.name,
          url,
          width: meta.width,
          height: meta.height,
          file: null,
          size: meta.fileSize,
          exif: meta.exif,
          path: e.path,
          selected: false,
        })
        items.push(item)
        added.push(item)
        known.add(e.path)
        catalogAdd([e.path])
        // 缩略图：优先磁盘持久化缓存（零解码）；未命中生成后立即落盘供下次启动直读。
        // 审查报告 S3：异步回填前先判条目是否已被移除（删除 / 清空），否则 objectURL
        // 落在游离对象上永不 revoke（批量导入后删除时内存持续累积）。
        void (async () => {
          const cachedThumb = await thumbFor(e.path)
          if (cachedThumb) {
            const t = URL.createObjectURL(new Blob([cachedThumb], { type: 'image/jpeg' }))
            if (!items.includes(item)) {
              releaseUrl(t)
              return
            }
            item.thumbUrl = t
            return
          }
          const t = await makeThumbUrl(url, meta.width, meta.height)
          if (!t) return
          if (!items.includes(item)) {
            releaseUrl(t)
            return
          }
          item.thumbUrl = t
          try {
            const blob = await (await fetch(t)).blob()
            void saveThumb(e.path, blob)
          } catch {
            /* 持久化失败仅影响下次启动速度 */
          }
        })()
        // 审查报告 S1：EXIF 补丁只并入本照片的导入快照，不直接改全局 state
        // （缓存命中时 meta.exif 来自目录缓存，零解析）
        const exifPatch = meta.exif ? buildExifPatch(meta.exif) : null
        const { state, patch } = useFrameConfig()
        let snap = JSON.parse(JSON.stringify(state)) as (typeof state)
        if (exifPatch) snap = { ...snap, ...exifPatch } as typeof snap
        const becomesActive = activeId.value === null && firstNewId === id
        if (becomesActive && exifPatch) {
          suspendCommit(true)
          try {
            patch(exifPatch)
          } finally {
            suspendCommit(false)
          }
        }
        await importPhoto(id, snap, '导入')
      }
    }
    // 启动还原：优先恢复目录记录的「上次选中」照片（审查报告 S1 尾注：restoreActive
    // 在 items 为空时抢先执行找不到目标），无记录时才选中第一张，避免重启后总跳回第一张
    if (activeId.value === null) {
      const catActive = loadCatalog()?.activePath ?? null
      const hit = catActive ? items.find((i) => i.path === catActive) : undefined
      if (hit) select(hit.id)
      else if (firstNewId) select(firstNewId)
    }
    return added
  }

  /**
   * 切换当前照片（激活 + 范围锚点），不改动勾选集合。
   * 勾选（导出/移除的「对勾」）只由显式操作修改：勾选圆圈、Ctrl+点击、Shift 范围、全选/清空。
   * 此前 select 会清空其它勾选并只勾被点击项——导出页勾选后只要点一下胶片条/方向键浏览，
   * 对勾就被静默清空，批量导出回退成「当前照片」，导出结果与勾选不符（用户反馈）。
   */
  function select(id: string): void {
    const target = items.find((i) => i.id === id)
    if (!target) return
    activeId.value = id
    anchorIndex = items.indexOf(target)
  }

  /** select 的语义别名：导出页选片调用处沿用，含义即「不动勾选集合」 */
  function setActiveKeepSelection(id: string): void {
    select(id)
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
    // 审查报告 S14：重置选中锚点与移除确认——否则重新导入后 Shift 范围选择
    // 会从陈旧锚点派生（出现「全选 / 漏选」的诡异结果）
    anchorIndex = -1
    removalConfirm.value = { open: false, count: 0 }
    catalogClear()
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
    parseExifQuiet,
    buildExifPatch,
    select,
    selectByIndex,
    setActiveKeepSelection,
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
