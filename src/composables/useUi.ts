import { ref } from 'vue'

/** 全局 UI 状态 */
export const editingPhoto = ref(false)

/** 当前主照片的源 <img> 元素（由 App 在图片加载后写入），供照片编辑器读取 */
export const photoImage = ref<HTMLImageElement | null>(null)

/** INFO「整体居中」请求计数器：InfoLayerPanel 按钮自增，FooterInfo watch 后执行居中 */
export const infoCenterRequest = ref(0)
