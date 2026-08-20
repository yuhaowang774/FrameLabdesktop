// 当前主图 File 单例：上传主图时写入，供"识别 Exif"等复用，避免重复选图。
import { ref, type Ref } from 'vue'

// 模块级单例，保证 ImageSource 与 BrandExif 共享同一份主图文件
const file: Ref<File | null> = ref(null)

export function useSourceFile() {
  function setSourceFile(f: File | null): void {
    file.value = f
  }
  function getSourceFile(): File | null {
    return file.value
  }
  function clearSourceFile(): void {
    file.value = null
  }
  return { sourceFile: file, setSourceFile, getSourceFile, clearSourceFile }
}
