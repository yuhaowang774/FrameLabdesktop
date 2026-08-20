// 当前主图来源单例：供"识别 Exif"等复用，避免重复选图。
// 网页端保存 File 引用；桌面端保存本地磁盘路径（不拷贝原图）。
import { ref, type Ref } from 'vue'

// 模块级单例，保证 ImageSource 与 BrandExif 共享同一份主图
const file: Ref<File | null> = ref(null)
const path: Ref<string | null> = ref(null)

export function useSourceFile() {
  function setSourceFile(f: File | null): void {
    file.value = f
  }
  function getSourceFile(): File | null {
    return file.value
  }
  function setSourcePath(p: string | null): void {
    path.value = p
  }
  function getSourcePath(): string | null {
    return path.value
  }
  function clearSourceFile(): void {
    file.value = null
    path.value = null
  }
  return { sourceFile: file, setSourceFile, getSourceFile, setSourcePath, getSourcePath, clearSourceFile }
}
