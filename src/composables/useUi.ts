import { ref } from 'vue'

/** 全局 UI 状态 */
export const editingPhoto = ref(false)

/** 当前主照片的源 <img> 元素（由 App 在图片加载后写入），供照片编辑器读取 */
export const photoImage = ref<HTMLImageElement | null>(null)

/** INFO「整体居中」请求计数器：InfoLayerPanel 按钮自增，FooterInfo watch 后执行居中 */
export const infoCenterRequest = ref(0)

/** 运行时错误（window error / unhandledrejection 捕获）：App.vue 弹窗提醒用户，
 *  详情同时落盘（Rust write_boot_log）。同一错误短时间去重，避免弹窗风暴。 */
export interface RuntimeErrorInfo {
  title: string
  detail: string
  count: number
}
export const runtimeError = ref<RuntimeErrorInfo | null>(null)

let lastErrKey = ''
let lastErrTime = 0
export function reportRuntimeError(title: string, detail: string): void {
  const key = `${title}|${detail.slice(0, 120)}`
  const now = Date.now()
  // 同一错误 5 秒内合并计数（如拖动滑块触发的连续异常），不重复弹窗
  if (runtimeError.value && key === lastErrKey && now - lastErrTime < 5000) {
    runtimeError.value.count++
    runtimeError.value = { ...runtimeError.value }
    lastErrTime = now
    return
  }
  lastErrKey = key
  lastErrTime = now
  runtimeError.value = { title, detail, count: 1 }
}
