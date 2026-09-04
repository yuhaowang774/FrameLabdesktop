// 全局常量：品牌表、字体表、参数范围
import type { BgMode, OverlayAlign } from './types'

/**
 * 内置品牌。Logo 为真实品牌图形 SVG 文件，存放于 src/assets/brands/<id>.svg，
 * 由 useLogoStore 按 id 加载并渲染为图像（暗色界面下用浅色/品牌色版本）。
 */
export interface BrandDef {
  id: string
  name: string
  /** 是否为真实图形 Logo（false = 文字占位，待补充真实图形资源） */
  graphic: boolean
}

export const BRANDS: BrandDef[] = [
  { id: 'sony', name: 'Sony', graphic: true },
  { id: 'nikon', name: 'Nikon', graphic: true },
  { id: 'canon', name: 'Canon', graphic: false },
  { id: 'fujifilm', name: 'Fujifilm', graphic: true },
  { id: 'hasselblad', name: 'Hasselblad', graphic: false },
  { id: 'leica', name: 'Leica', graphic: true },
  { id: 'ricoh', name: 'Ricoh', graphic: false },
  { id: 'zeiss', name: 'Zeiss', graphic: false },
  { id: 'pentax', name: 'Pentax', graphic: false },
  { id: 'dji', name: 'DJI', graphic: true },
  // 松下相机线品牌名为 Lumix（评论区反馈）；SVG 资源仍用 panasonic.svg（id 不变）
  { id: 'panasonic', name: 'Lumix', graphic: true },
  { id: 'olympus', name: 'Olympus', graphic: false },
  { id: 'apple', name: 'Apple', graphic: false },
  { id: 'insta360', name: 'Insta360', graphic: false },
]

/**
 * EXIF Make 关键字 → 内置品牌 id 的自动匹配表。
 * 用于识别 Exif 时自动选中对应品牌。
 */
export const EXIF_MAKE_TO_BRAND: Record<string, string> = {
  sony: 'sony',
  nikon: 'nikon',
  canon: 'canon',
  fuji: 'fujifilm',
  'fujifilm': 'fujifilm',
  hasselblad: 'hasselblad',
  leica: 'leica',
  ricoh: 'ricoh',
  zeiss: 'zeiss',
  pentax: 'pentax',
  dji: 'dji',
  panasonic: 'panasonic',
  olympus: 'olympus',
  apple: 'iphone',
  insta360: 'insta360',
  'arashi vision': 'insta360',
  // 手机品牌（Make 归一化；iQOO 的 Make 多为 vivo，需手动切换）
  huawei: 'huawei',
  xiaomi: 'xiaomi',
  redmi: 'redmi',
  samsung: 'samsung',
  oppo: 'oppo',
  oneplus: 'oneplus',
  '1+': 'oneplus',
  vivo: 'vivo',
  iqoo: 'iqoo',
  honor: 'honor',
  realme: 'realme',
  meizu: 'meizu',
  // 机身/型号代号兜底（Make 缺失时用 Model 匹配；置于表尾避免抢占 Make 精确匹配）
  ilce: 'sony',
  ilme: 'sony',
  eos: 'canon',
}

/**
 * 手机品牌（白底水印 card 模式）。Logo 以 logoText 文字标记渲染（零版权风险），
 * badge 为底部联名标块（text=null 表示无联名，不绘制标块）。
 * bg/fg 缺省 = accent / #ffffff。
 */
export interface PhoneBrandDef {
  id: string
  name: string
  /** Logo 文字标记（如 HUAWEI / XIAOMI） */
  logoText: string
  /** 品牌主色（近似，用于标块底色/文字强调） */
  accent: string
  /** 底部联名标块；text=null 无标块 */
  badge: { text: string | null; bg?: string; fg?: string }
}

export const PHONE_BRANDS: PhoneBrandDef[] = [
  { id: 'huawei', name: '华为', logoText: 'HUAWEI', accent: '#C7000B', badge: { text: 'XMAGE' } },
  { id: 'xiaomi', name: '小米', logoText: 'XIAOMI', accent: '#FF6900', badge: { text: 'LEICA', bg: '#E20612', fg: '#ffffff' } },
  { id: 'iphone', name: '苹果', logoText: 'iPhone', accent: '#1D1D1F', badge: { text: null } },
  { id: 'samsung', name: '三星', logoText: 'SAMSUNG', accent: '#1428A0', badge: { text: null } },
  { id: 'oppo', name: 'OPPO', logoText: 'OPPO', accent: '#006B54', badge: { text: 'HASSELBLAD', bg: '#111111', fg: '#F7941D' } },
  { id: 'oneplus', name: '一加', logoText: 'OnePlus', accent: '#EB0028', badge: { text: 'HASSELBLAD', bg: '#111111', fg: '#F7941D' } },
  { id: 'vivo', name: 'vivo', logoText: 'vivo', accent: '#415FFF', badge: { text: 'ZEISS', bg: '#0064C8', fg: '#ffffff' } },
  { id: 'iqoo', name: 'iQOO', logoText: 'iQOO', accent: '#FF5000', badge: { text: null } },
  { id: 'honor', name: '荣耀', logoText: 'HONOR', accent: '#00A0E9', badge: { text: null } },
  { id: 'redmi', name: '红米', logoText: 'Redmi', accent: '#FF6900', badge: { text: null } },
  { id: 'realme', name: '真我', logoText: 'realme', accent: '#E8B800', badge: { text: null } },
  { id: 'meizu', name: '魅族', logoText: 'MEIZU', accent: '#000000', badge: { text: null } },
]

/** 按品牌 id 查手机品牌定义（相机品牌返回 undefined） */
export function phoneBrandOf(id: string): PhoneBrandDef | undefined {
  return PHONE_BRANDS.find((b) => b.id === id)
}

/** 字体选项（系统字体栈，首版不做 Web Font 内嵌；按 group 分组展示）。
 *  每项 value 为 font-family 回退栈，顺序靠前的优先，缺失时自动回退到下一字体，保证跨平台可读。 */
export const FONT_OPTIONS: { label: string; value: string; group: string }[] = [
  // 中文
  { label: '雅黑 / 黑体', group: '中文', value: "'Microsoft YaHei', 'PingFang SC', sans-serif" },
  { label: '苹方', group: '中文', value: "'PingFang SC', 'Microsoft YaHei', sans-serif" },
  { label: '思源黑体', group: '中文', value: "'Source Han Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif" },
  { label: '黑体（简）', group: '中文', value: "'SimHei', 'Heiti SC', sans-serif" },
  { label: '圆体', group: '中文', value: "'Yuanti SC', 'PingFang SC', 'Hiragino Sans GB', sans-serif" },
  { label: '宋体 / 明体', group: '中文', value: "'SimSun', 'Songti SC', serif" },
  { label: '思源宋体', group: '中文', value: "'Source Han Serif SC', 'Songti SC', 'SimSun', serif" },
  { label: '楷体', group: '中文', value: "'KaiTi', 'Kaiti SC', serif" },
  { label: '仿宋', group: '中文', value: "'FangSong', 'STFangsong', serif" },
  { label: '隶书', group: '中文', value: "'LiSu', 'STLiti', serif" },
  { label: '幼圆', group: '中文', value: "'YouYuan', 'Yuanti SC', sans-serif" },
  // 英文·无衬线
  { label: '系统默认', group: '英文·无衬线', value: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif" },
  { label: 'Helvetica / Arial', group: '英文·无衬线', value: "'Helvetica Neue', Arial, sans-serif" },
  { label: 'Verdana', group: '英文·无衬线', value: "Verdana, Geneva, sans-serif" },
  { label: 'Roboto', group: '英文·无衬线', value: "Roboto, 'Helvetica Neue', Arial, sans-serif" },
  { label: 'Tahoma', group: '英文·无衬线', value: "Tahoma, Geneva, sans-serif" },
  { label: 'Trebuchet', group: '英文·无衬线', value: "'Trebuchet MS', 'Helvetica Neue', sans-serif" },
  { label: 'Optima', group: '英文·无衬线', value: "Optima, 'Segoe UI', sans-serif" },
  // 英文·衬线
  { label: 'Georgia', group: '英文·衬线', value: "Georgia, 'Times New Roman', serif" },
  { label: 'Times', group: '英文·衬线', value: "'Times New Roman', Times, serif" },
  { label: 'Garamond', group: '英文·衬线', value: "Garamond, 'EB Garamond', 'Times New Roman', serif" },
  { label: 'Palatino', group: '英文·衬线', value: "Palatino, 'Palatino Linotype', 'Book Antiqua', serif" },
  { label: 'Didot', group: '英文·衬线', value: "Didot, 'Bodoni MT', 'Times New Roman', serif" },
  // 等宽
  { label: '等宽', group: '等宽', value: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace" },
  { label: 'Courier', group: '等宽', value: "'Courier New', Courier, monospace" },
  // 手写·装饰
  { label: '手写', group: '手写·装饰', value: "'Comic Sans MS', 'Segoe Print', cursive" },
  { label: '行楷（华文）', group: '手写·装饰', value: "'STXingkai', 'Xingkai SC', cursive" },
]

export const BG_MODES: { value: BgMode; label: string }[] = [
  { value: 'blur', label: '背景模糊' },
  { value: 'solid', label: '纯色' },
  { value: 'photo', label: '照片填充' },
]

/**
 * 边框颜色预设：纯黑 / 纯白 / 复古米白。
 * 与取色器配合，解决白色边框与白色背景融为一体的痛点。
 */
export const BORDER_COLORS: { value: string; label: string }[] = [
  { value: '#000000', label: '纯黑' },
  { value: '#ffffff', label: '纯白' },
  { value: '#F5F0E6', label: '复古米白' },
]

/**
 * 画面（边框）比例预设：内容区宽高比（宽/高）。
 * - 自由：跟随照片自身比例
 * - 16:9 / 4:3 / 3:2 / 1:1：横版常用
 * - 3:4 / 9:16：竖版常用
 */
export const FRAME_RATIOS: { value: string; label: string }[] = [
  { value: 'free', label: '原图' },
  { value: '1:1', label: '1:1' },
  { value: '2:3', label: '2:3' },
  { value: '3:2', label: '3:2' },
  { value: '3:4', label: '3:4' },
  { value: '3:5', label: '3:5' },
  { value: '4:3', label: '4:3' },
  { value: '4:5', label: '4:5' },
  { value: '5:4', label: '5:4' },
  { value: '5:7', label: '5:7' },
  { value: '7:5', label: '7:5' },
  { value: '9:16', label: '9:16' },
  { value: '16:9', label: '16:9' },
  { value: '9:18', label: '9:18' },
  { value: '18:9', label: '18:9' },
  { value: '2.35:1', label: '2.35:1' },
]

/** 等效焦距画幅系数选项：value 为裁切系数字符串（'0'=自动用 EXIF 35mm 字段） */
export const CROP_FACTORS: { value: string; label: string }[] = [
  { value: '0', label: '自动 (EXIF)' },
  { value: '1', label: '全画幅 ×1.0' },
  { value: '1.5', label: 'APS-C ×1.5' },
  { value: '1.6', label: 'APS-C (佳能) ×1.6' },
  { value: '2', label: 'M4/3 ×2.0' },
  { value: '0.79', label: '中画幅 ×0.79' },
  { value: '0.64', label: '中画幅 4433 ×0.64' },
]

/** 品牌主色（评论区「尼康黄 / 佳能红」类诉求）：仅收录有公认标志色的品牌，未收录品牌回退自动 */
export const BRAND_LOGO_COLORS: Record<string, string> = {
  nikon: '#FFE100',
  canon: '#BF1E2E',
  fujifilm: '#00B140',
  pentax: '#008C45',
  leica: '#E20612',
  ricoh: '#E60027',
  olympus: '#0B6DBD',
  zeiss: '#0F5DC2',
}

/** 由比例键解析出宽高比数值（null = 自由） */
export function frameRatioOf(value: string): number | null {
  if (value === 'free') return null
  const [w, h] = value.split(':').map(Number)
  return w > 0 && h > 0 ? w / h : null
}

/** 由宽高比数值反查比例键（无匹配时返回自由） */
export function frameRatioKey(ratio: number | null): string {
  if (ratio == null) return 'free'
  const hit = FRAME_RATIOS.find((o) => {
    const v = frameRatioOf(o.value)
    return v != null && Math.abs(v - ratio) < 1e-9
  })
  return hit ? hit.value : 'free'
}

/** 画幅比例图标的显示尺寸（比例图标容器 30×20 内的最大内接矩形）。
 *  传入 null（自由/跟随照片）返回 null，由调用方渲染虚线占位。 */
export function ratioIconSize(ratio: number | null): { w: number; h: number } | null {
  if (ratio == null || ratio <= 0) return null
  const W = 30
  const H = 20
  let w = W
  let h = W / ratio
  if (h > H) {
    h = H
    w = H * ratio
  }
  return { w: Math.max(1, Math.round(w)), h: Math.max(1, Math.round(h)) }
}

export const OVERLAY_ALIGNS: { value: OverlayAlign; label: string }[] = [
  { value: 'left', label: '居左' },
  { value: 'center', label: '居中' },
  { value: 'right', label: '居右' },
]

/** 参数范围（与 UI 滑块联动，也供校验使用） */
export const RANGES = {
  blur: { min: 0, max: 100, step: 1 },
  padding: { min: 0, max: 200, step: 1 },
  borderRatio: { min: 0, max: 400, step: 1 },
  borderRadius: { min: 0, max: 200, step: 1 },
  photoRadius: { min: 0, max: 200, step: 1 },
  bgExpand: { min: 0, max: 400, step: 5 },
  bgBottomRatio: { min: 0, max: 400, step: 1 },
  scale: { min: 50, max: 300, step: 1 },
  bgScale: { min: 0.5, max: 4, step: 0.05 },
  shadow: { min: 0, max: 1, step: 0.05 },
  logoSize: { min: 10, max: 100, step: 1 },
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
  vignette: { min: 0, max: 1, step: 0.05 },
  grain: { min: 0, max: 1, step: 0.05 },
  watermarkOpacity: { min: 0, max: 1, step: 0.05 },
  watermarkSize: { min: 5, max: 60, step: 1 },
  watermarkAngle: { min: 0, max: 90, step: 1 },
  watermarkBottom: { min: 0, max: 200, step: 1 },
} as const

/** 自定义 Logo 上限 */
export const MAX_CUSTOM_LOGOS = 5
/** 历史记录上限 */
export const MAX_HISTORY = 100
/**
 * 历史记录防抖时长：一次操作（如拖动滑块）从开始到结束期间产生多次参数变化，
 * 统一合并为一条完整参数快照，仅在操作停顿该毫秒后才提交。
 */
export const HISTORY_DEBOUNCE_MS = 400
/** 设计稿基准宽度（与预览/导出一致） */
export const DESIGN_CONTAINER = 1200
