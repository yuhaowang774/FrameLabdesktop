// 修改历史记录模块（每次操作记录完整参数快照，非破坏性编辑）
//
// 核心本质：不是记录每一步增量操作，而是记录每一次操作后的完整参数快照
//（FrameConfig 全量 dict），持久化保存在 IndexedDB，实现非破坏性编辑。
//
// 存储模型：
//  - 每张图片独立一条历史链表，链表底部固定为 Import 导入节点；
//  - 每次编辑在链表头部（顶部）追加新节点，节点保存 { id, name, ts, seq, state }，
//    state 为完整全套调整参数（非增量 diff）；
//  - 历史顺序固定：底部最早、顶部最新，不可调换；支持单条节点重命名。
//
// 跳转核心逻辑：
//  - 点击节点 → 全部参数替换为该节点快照，刷新预览；
//  - 跳回旧节点后再编辑 → 删除该节点之上全部节点，新编辑成为新头部；
//  - Clear History Above This Step → 删除当前节点上方全部历史，不新增历史、不改参数；
//  - 悬浮历史条目 → 提供预览参数（previewState），渲染历史效果但不修改实际参数。
//
// 功能：
//  - Reset 复位操作本身生成一条历史记录（可撤销复位）；
//  - 右键菜单：复制该历史参数为 Before 对比状态 / 从该历史节点创建快照 Snapshot；
//  - Clear All：清空该图片全部历史链表（不修改当前参数，仅删日志，并以当前参数重建 Import）；
//  - 不支持删除链表中间单条节点，仅支持清除某节点以上或全部清空；
//  - 提供批量清除接口（removePhotoHistory / clearAllGlobal），防止数据库无限膨胀。
import { reactive, computed, ref } from 'vue'
import type { FrameConfig } from '../core/types'
import { MAX_HISTORY, HISTORY_DEBOUNCE_MS } from '../core/constants'
import { useFrameConfig, registerCommit } from './useFrameConfig'
import { buildExifText, formatDate, cleanLens } from './useExif'
import {
  loadPhotoNodes,
  putHistoryNode,
  deleteHistoryNodes,
  deletePhotoChain,
  clearAllHistoryNodes,
  countHistoryNodes,
  nextSeq,
  type HistoryNodeRecord,
} from './useHistoryDB'

// ===== 当前活动照片提供者（由 App.vue 注册，避免与 useLibrary 循环依赖） =====
export interface ActivePhotoTarget {
  id: string
  url: string
}
type ActiveProvider = () => ActivePhotoTarget | null
let activeProvider: ActiveProvider | null = null
export function registerActiveProvider(fn: ActiveProvider): void {
  activeProvider = fn
}
function currentTarget(): ActivePhotoTarget | null {
  return activeProvider ? activeProvider() : null
}

// ===== 内存缓存：photoId → 链表（index 0 = Import 底部，末位 = 最新顶部） =====
const chains = reactive<Record<string, HistoryNodeRecord[]>>({})
const cursors = reactive<Record<string, number>>({})

// 懒加载标记：保证每张照片的链表只从 DB 载入一次
const loaded = new Set<string>()
const loading = new Map<string, Promise<void>>()
export function ensureChain(photoId: string): Promise<void> {
  if (loaded.has(photoId)) return Promise.resolve()
  const pending = loading.get(photoId)
  if (pending) return pending
  const p = (async () => {
    const recs = await loadPhotoNodes(photoId)
    chains[photoId] = recs
    cursors[photoId] = recs.length > 0 ? recs.length - 1 : -1
    loaded.add(photoId)
  })()
  loading.set(photoId, p)
  return p
}

function chainOf(photoId: string): HistoryNodeRecord[] {
  return chains[photoId] ?? []
}

// ===== 字段 → 中文显示名 =====
const FIELD_LABELS: Record<string, string> = {
  bgMode: '背景模式',
  bgColor: '背景颜色',
  customBgImage: '背景图片',
  blur: '背景模糊',
  bgScale: '背景缩放',
  bgOffsetX: '背景水平偏移',
  bgOffsetY: '背景垂直偏移',
  bgExpand: '背景扩展',
  bgBottomRatio: '下边宽度',
  padding: '边框宽度',
  borderColor: '边框颜色',
  borderRatio: '下边宽度',
  borderRadius: '边框圆角',
  photoRadius: '照片圆角',
  frameRatio: '画面比例',
  scale: '照片缩放',
  shadow: '照片阴影',
  photoX: '照片位置',
  photoY: '照片位置',
  photoRotation: '照片旋转',
  photoCrop: '照片裁剪',
  photoSrc: '切换照片',
  canvasH: '画布高度',
  brand: '品牌',
  showLogo: 'Logo 显示',
  logoSize: 'Logo 大小',
  logoOpacity: 'Logo 透明度',
  showExif: 'EXIF 显示',
  exifText: 'EXIF 文本',
  showLens: '镜头型号显示',
  lensText: '镜头文本',
  infoLayout: '信息布局',
  lensX: '镜头位置',
  lensY: '镜头位置',
  fontFamily: '字体',
  fontSize: '字体大小',
  textWeight: '字重',
  textOpacity: '文字透明度',
  distPhotoLogo: 'Logo 间距',
  distLogoText: 'Logo 文字间距',
  distBottom: '底部留白',
  showCameraModel: '相机型号显示',
  cameraModel: '相机型号',
  cameraModelFont: '型号字体',
  cameraModelSize: '型号字号',
  cameraModelWeight: '型号字重',
  cameraModelGap: '型号间距',
  cameraModelOpacity: '型号透明度',
  cameraModelColor: '型号颜色',
  cameraModelItalic: '型号斜体',
  exifTextColor: 'EXIF 颜色',
  lensTextColor: '镜头颜色',
  dateTextColor: '日期颜色',
  cameraModelOffsetX: '型号偏移',
  cameraModelOffsetY: '型号偏移',
  logoX: 'Logo 位置',
  logoY: 'Logo 位置',
  modelX: '型号位置',
  modelY: '型号位置',
  exifX: 'EXIF 位置',
  exifY: 'EXIF 位置',
  eqFocal: '等效焦距',
  cropFactor: '画幅系数',
  showDate: '日期显示',
  dateText: '日期文本',
  dateFormat: '日期格式',
  dateX: '日期位置',
  dateY: '日期位置',
  vignette: '暗角',
  grain: '颗粒',
  showWatermark: '水印显示',
  watermarkText: '水印文字',
  watermarkImage: '水印图片',
  watermarkOpacity: '水印透明度',
  watermarkSize: '水印大小',
  watermarkAngle: '水印角度',
  watermarkTile: '水印平铺',
  watermarkAlign: '水印对齐',
  watermarkBottom: '水印位置',
  exifRaw: 'EXIF 数据',
  infoLayer: 'INFO 排版',
  layerVisible: '图层可见性',
  loadConfig: '应用预设',
  reset: '复位全部',
}

function describe(key: string): string {
  return FIELD_LABELS[key] ?? key
}

function makeId(): string {
  return `h_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`
}

// ===== 参数应用（跳转/撤销/切换照片共用） =====
// restoring：应用历史参数时抑制 commitHistory，避免把"跳转"本身记成新历史
let restoring = false

function applyConfig(photoId: string, state?: FrameConfig): void {
  const { loadConfig } = useFrameConfig()
  const target = currentTarget()
  restoring = true
  try {
    const base = state ?? chainOf(photoId)[cursors[photoId] ?? -1]?.state
    loadConfig({ ...(base ?? {}), photoSrc: target?.url ?? null })
  } finally {
    restoring = false
  }
}

/** 应用某照片当前 cursor 指向的节点参数（切换照片时恢复该照片状态）。
 *  先 flush 待提交历史，避免上次操作的记录丢失。 */
export async function applyCursorFor(photoId: string): Promise<void> {
  await flushPending()
  const chain = chains[photoId]
  const cur = cursors[photoId] ?? -1
  applyConfig(photoId, chain?.[cur]?.state)
}

/** 同步应用某照片当前 cursor 指向的节点参数（需先 ensureChain 加载）。
 *  供切换照片时与图源/背景在同一同步块内原子恢复，避免中间帧卡顿。 */
export function loadCursorFor(photoId: string): void {
  applyConfig(photoId, chainOf(photoId)[cursors[photoId] ?? -1]?.state)
}

// ===== 自动记录（防抖提交）：一次"操作"合并为一条完整参数快照 =====
// 用户调整滑块等操作期间，patch 会被连续调用（input/pointermove…）。
// 这里只更新"待提交快照"并重置防抖定时器；操作停顿（松开鼠标）DEBOUNCE 后才
// 真正追加一条历史节点 —— 因此每次操作仅产生一条记录，且记录的是操作结束后的
// 完整参数快照（非每步增量）。
let debounceTimer: ReturnType<typeof setTimeout> | null = null
let pendingCommit: { photoId: string; state: FrameConfig; name: string } | null = null

function commitHistory(key = ''): void {
  if (restoring) return
  if (key === 'photoSrc') return // 切换照片不入历史
  const target = currentTarget()
  if (!target) return
  const { state } = useFrameConfig()
  pendingCommit = {
    photoId: target.id,
    state: JSON.parse(JSON.stringify(state)) as FrameConfig,
    name: describe(key),
  }
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => { void flushPending() }, HISTORY_DEBOUNCE_MS)
}
registerCommit((key) => commitHistory(key))

/** 立即提交待提交的历史节点（若存在）。关键操作前调用，避免操作竞态与快照丢失。 */
export async function flushPending(): Promise<void> {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }
  const p = pendingCommit
  pendingCommit = null
  if (!p) return
  await ensureChain(p.photoId) // 保证链表已从 DB 载入，避免覆盖丢失
  recordEdit(p.photoId, p.state, p.name)
}

/** 在链表头部追加一条新节点；若当前不在顶部则先截断其上分支 */
export function recordEdit(photoId: string, state: FrameConfig, name: string): void {
  const chain = chainOf(photoId)
  const cur = cursors[photoId] ?? -1
  let removed: HistoryNodeRecord[] = []
  if (cur >= 0 && cur < chain.length - 1) {
    removed = chain.splice(cur + 1) // 截断当前节点之上的历史
  }
  const node: HistoryNodeRecord = {
    id: makeId(),
    photoId,
    name,
    ts: Date.now(),
    seq: nextSeq(),
    state: JSON.parse(JSON.stringify(state)) as FrameConfig,
  }
  chain.push(node)
  let overflow: HistoryNodeRecord[] = []
  if (chain.length > MAX_HISTORY) {
    // 防膨胀：保留 Import（index 0），裁剪最旧编辑节点
    overflow = chain.splice(1, chain.length - MAX_HISTORY)
    if (cur >= 1 && cursors[photoId] != null) cursors[photoId] = Math.max(0, (cursors[photoId] ?? 0) - overflow.length)
  }
  cursors[photoId] = chain.length - 1
  void putHistoryNode(node).catch(() => { /* IndexedDB 写入失败静默 */ })
  const del = [...removed, ...overflow]
  if (del.length) void deleteHistoryNodes(del.map((n) => n.id)).catch(() => {})
}

/** 建立 Import 导入节点（照片导入时调用）；已有链则整体重建 */
export async function importPhoto(photoId: string, state: FrameConfig, name = '导入'): Promise<void> {
  await flushPending()
  await ensureChain(photoId)
  const chain = chains[photoId]
  const oldIds = chain.map((n) => n.id)
  chain.splice(0, chain.length)
  const node: HistoryNodeRecord = {
    id: makeId(),
    photoId,
    name,
    ts: Date.now(),
    seq: nextSeq(),
    state: JSON.parse(JSON.stringify(state)) as FrameConfig,
  }
  chain.push(node)
  cursors[photoId] = 0
  void putHistoryNode(node).catch(() => {})
  if (oldIds.length) void deleteHistoryNodes(oldIds).catch(() => {})
}

/** 点击历史节点：将该照片全部参数替换为此节点快照并刷新预览 */
export async function jumpTo(photoId: string, index: number): Promise<void> {
  await flushPending()
  await ensureChain(photoId)
  const chain = chains[photoId]
  if (index < 0 || index >= chain.length) return
  cursors[photoId] = index
  applyConfig(photoId, chain[index].state)
}

/**
 * 批量应用模板配置到多张照片：每张照片在其历史链追加一条「应用模板」节点。
 * 各照片保留自身的照片变换/位置/EXIF（模板只覆盖装饰参数，与单张 apply 语义一致）；
 * 当前编辑的照片在列表内时同步刷新预览到模板化后的参数。
 */
export async function applyTemplateToPhotos(
  photoIds: string[],
  config: Partial<FrameConfig>,
  name = '应用模板',
): Promise<void> {
  await flushPending()
  const keep = new Set([
    'photoSrc', 'photoX', 'photoY', 'photoRotation', 'photoCrop',
    'bgScale', 'bgOffsetX', 'bgOffsetY', 'canvasH',
    'exifText', 'exifRaw', 'dateText', 'cameraModel', 'brand', 'lensText',
    // 保留各 INFO 文本（EXIF/镜头/日期）的独立样式覆盖，模板只覆盖装饰、不抹掉单独设置
    'exifFontFamily', 'exifFontSize', 'exifTextWeight', 'exifTextOpacity',
    'lensFontFamily', 'lensFontSize', 'lensTextWeight', 'lensTextOpacity',
    'dateFontFamily', 'dateFontSize', 'dateTextWeight', 'dateTextOpacity',
    'exifTextColor', 'lensTextColor', 'dateTextColor', 'cameraModelColor',
  ])
  for (const id of photoIds) {
    await ensureChain(id)
    const base = chainOf(id)[cursors[id] ?? -1]?.state
    if (!base) continue
    const next: FrameConfig = { ...base }
    for (const [k, v] of Object.entries(config)) {
      if (!keep.has(k)) Object.assign(next, { [k]: v })
    }
    // 兜底重建被「复位 INFO」清空的 INFO 文本（保留照片 EXIF 语义；型号为手动输入不重建）
    const raw = next.exifRaw
    if (!next.exifText && raw) next.exifText = buildExifText(raw, { eqFocal: next.eqFocal, cropFactor: next.cropFactor })
    if (!next.dateText && raw?.dateTimeOriginal) next.dateText = formatDate(raw.dateTimeOriginal, next.dateFormat)
    if (!next.lensText) next.lensText = cleanLens(raw?.lensMake, raw?.lensModel) ?? ''
    recordEdit(id, next, name)
  }
  const target = currentTarget()
  if (target && photoIds.includes(target.id)) {
    loadCursorFor(target.id)
  }
}

/** Clear History Above This Step：删除指定节点上方全部历史。
 *  若当前所在节点位于被删区间，则落回该节点并加载其参数（保持"当前参数 = 当前步骤"自洽）；
 *  否则参数不变、不新增历史条目。 */
export async function clearAbove(photoId: string, index: number): Promise<void> {
  await flushPending()
  await ensureChain(photoId)
  const chain = chains[photoId]
  if (index < 0 || index >= chain.length) return
  const cur = cursors[photoId] ?? -1
  const removed = chain.splice(index + 1)
  if (cur > index) {
    cursors[photoId] = index
    applyConfig(photoId, chain[index].state)
  }
  if (removed.length) void deleteHistoryNodes(removed.map((n) => n.id)).catch(() => {})
}

/** Clear All：清空该图片全部历史链表，不修改当前参数（仅删日志），
 *  并以当前参数重建底部 Import 节点，保持链表结构固定。 */
export async function clearAll(photoId: string): Promise<void> {
  await flushPending()
  await ensureChain(photoId)
  const chain = chains[photoId]
  const { state } = useFrameConfig()
  const current = JSON.parse(JSON.stringify(state)) as FrameConfig
  const oldIds = chain.map((n) => n.id)
  chain.splice(0, chain.length)
  const node: HistoryNodeRecord = {
    id: makeId(),
    photoId,
    name: '导入',
    ts: Date.now(),
    seq: nextSeq(),
    state: current,
  }
  chain.push(node)
  cursors[photoId] = 0
  void putHistoryNode(node).catch(() => {})
  if (oldIds.length) void deleteHistoryNodes(oldIds).catch(() => {})
}

/** 重命名单条历史节点 */
export async function renameNode(photoId: string, index: number, name: string): Promise<void> {
  await ensureChain(photoId)
  const n = chainOf(photoId)[index]
  if (!n) return
  const trimmed = name.trim()
  n.name = trimmed || n.name
  void putHistoryNode(n).catch(() => {})
}

// ===== 悬浮预览：渲染该历史状态效果，不修改实际运行参数 =====
const preview = ref<{ photoId: string; node: HistoryNodeRecord } | null>(null)
export function setPreview(node: HistoryNodeRecord | null): void {
  const target = currentTarget()
  preview.value = node && target ? { photoId: target.id, node } : null
}
/** 当前照片悬浮历史节点对应的完整参数快照（null = 无悬浮） */
export const previewState = computed<FrameConfig | null>(() => {
  const p = preview.value
  if (!p) return null
  const target = currentTarget()
  if (!target || p.photoId !== target.id) return null
  return p.node.state
})

// ===== 右键菜单：复制该历史参数为 Before 对比状态 =====
const beforeState = ref<FrameConfig | null>(null)
export function copyToBefore(state: FrameConfig): void {
  beforeState.value = JSON.parse(JSON.stringify(state)) as FrameConfig
}

// ===== 快照 Snapshot（从历史节点创建，localStorage 持久化） =====
export interface Snapshot {
  id: string
  photoId: string
  name: string
  ts: number
  state: FrameConfig
}
const SNAP_KEY = 'frame-snapshots'
function readSnapshots(): Snapshot[] {
  try {
    const raw = localStorage.getItem(SNAP_KEY)
    return raw ? (JSON.parse(raw) as Snapshot[]) : []
  } catch {
    return []
  }
}
function writeSnapshots(list: Snapshot[]): void {
  try {
    localStorage.setItem(SNAP_KEY, JSON.stringify(list))
  } catch {
    /* 存储不可用静默 */
  }
}
export function listSnapshots(photoId: string): Snapshot[] {
  return readSnapshots().filter((s) => s.photoId === photoId)
}
export function createSnapshot(photoId: string, state: FrameConfig, name?: string): Snapshot {
  const list = readSnapshots()
  const count = list.filter((s) => s.photoId === photoId).length + 1
  const snap: Snapshot = {
    id: makeId(),
    photoId,
    name: name?.trim() || `快照 ${count}`,
    ts: Date.now(),
    state: JSON.parse(JSON.stringify(state)) as FrameConfig,
  }
  list.push(snap)
  writeSnapshots(list)
  return snap
}
export function removeSnapshot(photoId: string, id: string): void {
  writeSnapshots(readSnapshots().filter((s) => !(s.photoId === photoId && s.id === id)))
}
/** 恢复快照 = 一次编辑操作：应用参数并追加一条历史节点（命名为"快照: 名称"） */
export async function restoreSnapshot(photoId: string, id: string): Promise<boolean> {
  const s = readSnapshots().find((x) => x.photoId === photoId && x.id === id)
  if (!s) return false
  await flushPending()
  const target = currentTarget()
  restoring = true
  try {
    const { loadConfig } = useFrameConfig()
    loadConfig({ ...s.state, photoSrc: target?.url ?? null })
  } finally {
    restoring = false
  }
  await ensureChain(photoId)
  recordEdit(photoId, s.state, `快照: ${s.name}`)
  return true
}
export function clearSnapshots(photoId: string): void {
  writeSnapshots(readSnapshots().filter((s) => s.photoId !== photoId))
}

// ===== 撤销 / 重做（在当前照片链表上游走） =====
export async function undo(): Promise<void> {
  const t = currentTarget()
  if (!t) return
  await flushPending()
  await ensureChain(t.id)
  const cur = cursors[t.id] ?? -1
  if (cur <= 0) return
  cursors[t.id] = cur - 1
  applyConfig(t.id, chainOf(t.id)[cur - 1].state)
}
export async function redo(): Promise<void> {
  const t = currentTarget()
  if (!t) return
  await flushPending()
  await ensureChain(t.id)
  const chain = chains[t.id]
  const cur = cursors[t.id] ?? -1
  if (cur >= chain.length - 1) return
  cursors[t.id] = cur + 1
  applyConfig(t.id, chain[cur + 1].state)
}
export function canUndo(): boolean {
  const t = currentTarget()
  return t ? (cursors[t.id] ?? -1) > 0 : false
}
export function canRedo(): boolean {
  const t = currentTarget()
  if (!t) return false
  return (cursors[t.id] ?? -1) < chainOf(t.id).length - 1
}

// ===== 批量清除接口（防数据库无限膨胀） =====
/** 删除单张照片的整条历史链表（照片移除时调用） */
export async function removePhotoHistory(photoId: string): Promise<void> {
  // 若该照片有未提交的操作，先提交，避免删链后 pending 又把节点写回数据库
  if (pendingCommit?.photoId === photoId) await flushPending()
  loaded.delete(photoId)
  loading.delete(photoId)
  delete chains[photoId]
  delete cursors[photoId]
  await deletePhotoChain(photoId)
}
/** 清空全局全部历史节点 */
export async function clearAllGlobal(): Promise<void> {
  await flushPending()
  for (const k of Object.keys(chains)) delete chains[k]
  for (const k of Object.keys(cursors)) delete cursors[k]
  loaded.clear()
  loading.clear()
  await clearAllHistoryNodes()
}
/** 统计全部历史节点数量 */
export function countAll(): Promise<number> {
  return countHistoryNodes()
}

export function useHistory() {
  /** 当前照片的历史链表（底部 Import → 顶部最新） */
  const records = computed<HistoryNodeRecord[]>(() => {
    const t = currentTarget()
    return t ? (chains[t.id] ?? []) : []
  })
  /** 当前照片的当前步骤索引 */
  const cursor = computed<number>(() => {
    const t = currentTarget()
    return t ? (cursors[t.id] ?? -1) : -1
  })
  return {
    records,
    cursor,
    previewState,
    beforeState,
    flushPending,
    ensureChain,
    importPhoto,
    recordEdit,
    jumpTo,
    clearAbove,
    clearAll,
    renameNode,
    applyCursorFor,
    loadCursorFor,
    setPreview,
    copyToBefore,
    listSnapshots,
    createSnapshot,
    removeSnapshot,
    restoreSnapshot,
    clearSnapshots,
    canUndo,
    canRedo,
    undo,
    redo,
    removePhotoHistory,
    clearAllGlobal,
    countAll,
    MAX_HISTORY,
  }
}
