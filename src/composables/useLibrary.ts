// 图库素材库：纯前端本地管理（不上传后端）。
// 使用 objectURL 引用本地文件，支持多图导入、缩略图、多选、删除、选中。
import { reactive, ref, computed } from 'vue'

export interface LibraryItem {
  id: string
  name: string
  url: string // objectURL
  /** 已读取的宽高（用于缩略图比例/胶片条） */
  width: number
  height: number
  /** 文件引用，批量导出时回填 EXIF 用 */
  file: File
  /** 是否为当前选中（胶片条高亮） */
  selected: boolean
}

const items = reactive<LibraryItem[]>([])
const activeId = ref<string | null>(null)

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

export function useLibrary() {
  const activeIndex = computed(() =>
    items.findIndex((i) => i.id === activeId.value),
  )

  async function addFiles(files: File[]): Promise<void> {
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue
      const { width, height } = await readSize(file)
      const url = URL.createObjectURL(file)
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
    URL.revokeObjectURL(items[idx].url)
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
    items.forEach((i) => URL.revokeObjectURL(i.url))
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
