// 图库素材库：纯前端本地管理（不上传后端）。
// 网页端：objectURL 引用上传文件；桌面端：asset 协议 URL 引用磁盘绝对路径（不拷贝原图）。
// 支持多图导入、缩略图、多选、删除、选中。
import { reactive, ref, computed } from 'vue'
import { assetUrl, type LocalImageEntry } from '../platform/fs'

export interface LibraryItem {
  id: string
  name: string
  url: string // 网页端 objectURL；桌面端 asset 协议 URL
  /** 已读取的宽高（用于缩略图比例/胶片条） */
  width: number
  height: number
  /** 网页端文件引用，批量导出时回填 EXIF 用 */
  file?: File
  /** 桌面端本地图片绝对路径（仅保存路径引用，不拷贝原图） */
  path?: string
  /** 是否为当前选中（胶片条高亮） */
  selected: boolean
}

const items = reactive<LibraryItem[]>([])
const activeId = ref<string | null>(null)

function makeId(): string {
  return `lib_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

function readSize(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight })
    img.onerror = () => resolve({ width: 0, height: 0 })
    img.src = url
  })
}

/** 释放 objectURL（桌面端 asset URL 无需释放） */
function releaseUrl(url: string): void {
  if (url.startsWith('blob:')) URL.revokeObjectURL(url)
}

export function useLibrary() {
  const activeIndex = computed(() =>
    items.findIndex((i) => i.id === activeId.value),
  )

  async function addFiles(files: File[]): Promise<void> {
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue
      const url = URL.createObjectURL(file)
      const { width, height } = await readSize(url)
      items.push({
        id: makeId(),
        name: file.name,
        url,
        width,
        height,
        file,
        selected: false,
      })
    }
  }

  /** 桌面端：把扫描到的本地图片（磁盘路径）加入图库，返回新增项 */
  async function addLocalEntries(entries: LocalImageEntry[]): Promise<LibraryItem[]> {
    const added: LibraryItem[] = []
    for (const e of entries) {
      const url = assetUrl(e.path)
      const { width, height } = await readSize(url)
      const item: LibraryItem = {
        id: makeId(),
        name: e.name,
        url,
        width,
        height,
        path: e.path,
        selected: false,
      }
      items.push(item)
      added.push(item)
    }
    return added
  }

  function select(id: string): void {
    const target = items.find((i) => i.id === id)
    if (!target) return
    items.forEach((i) => (i.selected = false))
    target.selected = true
    activeId.value = id
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

  function remove(id: string): void {
    const idx = items.findIndex((i) => i.id === id)
    if (idx < 0) return
    releaseUrl(items[idx].url)
    items.splice(idx, 1)
    if (activeId.value === id) {
      activeId.value = items.length ? items[Math.min(idx, items.length - 1)].id : null
    }
  }

  function removeSelected(): void {
    const selected = items.filter((i) => i.selected)
    selected.forEach((i) => remove(i.id))
  }

  function clearAll(): void {
    items.forEach((i) => releaseUrl(i.url))
    items.splice(0, items.length)
    activeId.value = null
  }

  function toggleSelect(id: string): void {
    const t = items.find((i) => i.id === id)
    if (t) t.selected = !t.selected
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
    select,
    selectByIndex,
    next,
    prev,
    remove,
    removeSelected,
    clearAll,
    toggleSelect,
    setSelected,
  }
}
