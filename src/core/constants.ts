// 全局常量：品牌表、字体表、参数范围
import type { BgMode, OverlayAlign, Theme } from './types'

/** 内置品牌（Logo 由 useLogoStore 按主题解析路径，此处仅存元数据） */
export interface BrandDef {
  id: string
  name: string
}

export const BRANDS: BrandDef[] = [
  { id: 'sony', name: 'Sony' },
  { id: 'nikon', name: 'Nikon' },
  { id: 'canon', name: 'Canon' },
  { id: 'fujifilm', name: 'Fujifilm' },
  { id: 'hasselblad', name: 'Hasselblad' },
  { id: 'leica', name: 'Leica' },
  { id: 'ricoh', name: 'Ricoh' },
  { id: 'zeiss', name: 'Zeiss' },
  { id: 'pentax', name: 'Pentax' },
  { id: 'dji', name: 'DJI' },
  { id: 'panasonic', name: 'Panasonic' },
  { id: 'olympus', name: 'Olympus' },
  { id: 'caye', name: '沧野' },
  { id: 'xuzhou', name: '徐州老味菜' },
]

/** 字体选项（系统字体栈，首版不做 Web Font 内嵌） */
export const FONT_OPTIONS: { label: string; value: string }[] = [
  { label: '系统默认', value: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" },
  { label: '无衬线', value: "'Helvetica Neue', Arial, sans-serif" },
  { label: '衬线', value: "Georgia, 'Times New Roman', serif" },
  { label: '等宽', value: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace" },
  { label: '圆体', value: "'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', sans-serif" },
  { label: '黑体', value: "'Microsoft YaHei', 'PingFang SC', sans-serif" },
  { label: '宋体', value: "'SimSun', 'Songti SC', serif" },
  { label: '楷体', value: "'KaiTi', 'Kaiti SC', serif" },
]

export const BG_MODES: { value: BgMode; label: string }[] = [
  { value: 'default', label: '原背景' },
  { value: 'custom', label: '自定义' },
  { value: 'none', label: '无背景' },
]

export const OVERLAY_ALIGNS: { value: OverlayAlign; label: string }[] = [
  { value: 'left', label: '居左' },
  { value: 'center', label: '居中' },
  { value: 'right', label: '居右' },
]

export const THEMES: { value: Theme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
]

/** 参数范围（与 UI 滑块联动，也供校验使用） */
export const RANGES = {
  blur: { min: 0, max: 100, step: 1 },
  padding: { min: 20, max: 200, step: 1 },
  scale: { min: 50, max: 100, step: 1 },
  radius: { min: 0, max: 100, step: 1 },
  shadow: { min: 0, max: 1, step: 0.05 },
  logoSize: { min: 10, max: 150, step: 1 },
  logoOpacity: { min: 0, max: 1, step: 0.05 },
  fontSize: { min: 8, max: 80, step: 1 },
  textWeight: { min: 100, max: 900, step: 100 },
  textOpacity: { min: 0, max: 1, step: 0.05 },
  distPhotoLogo: { min: 0, max: 200, step: 1 },
  distLogoText: { min: 0, max: 100, step: 1 },
  distBottom: { min: 0, max: 200, step: 1 },
  cameraModelSize: { min: 8, max: 60, step: 1 },
  cameraModelWeight: { min: 100, max: 900, step: 100 },
  cameraModelGap: { min: 0, max: 60, step: 1 },
  cameraModelOpacity: { min: 0, max: 1, step: 0.05 },
  cameraModelOffset: { min: -60, max: 60, step: 1 },
  overlayBottom: { min: 0, max: 200, step: 1 },
} as const

/** 自定义 Logo 上限 */
export const MAX_CUSTOM_LOGOS = 5
/** 历史记录上限 */
export const MAX_HISTORY = 100
/** 设计稿基准宽度（与预览/导出一致） */
export const DESIGN_CONTAINER = 1200
