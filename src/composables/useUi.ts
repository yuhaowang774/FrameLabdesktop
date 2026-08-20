import { ref } from 'vue'

/** 全局 UI 状态 */
export const editingPhoto = ref(false)

/** 当前主照片的源 <img> 元素（由 App 在图片加载后写入），供照片编辑器读取 */
export const photoImage = ref<HTMLImageElement | null>(null)
