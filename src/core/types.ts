export type BgMode = 'default' | 'custom' | 'none'
export type OverlayAlign = 'left' | 'center' | 'right'
export type PhotoRotation = 0 | 90 | 180 | 270

/**
 * 图层标识。相框由下至上叠放 4 个图层，符合 PS 图层叠加编辑逻辑：
 * - artboard：画板（最底层容器，定义画布尺寸与背景底色）
 * - bg      ：背景层（模糊照片背景）
 * - photo   ：照片层（主照片本体）
 * - info    ：信息层（顶层：Logo + 相机型号 + EXIF）
 */
export type LayerId = 'artboard' | 'bg' | 'photo' | 'info'

/** PS 式图层面板中的单图层描述 */
export interface LayerDef {
  id: LayerId
  /** 面板显示名 */
  label: string
  /** 在画布中的 z 顺序（数值越大越靠上） */
  z: number
  /** 是否可被用户隐藏（画板常驻，不可隐藏） */
  hideable: boolean
}

/** 归一化裁剪矩形（0..1，相对旋转后照片），x/y 为左上角 */
export interface PhotoCrop {
  x: number
  y: number
  w: number
  h: number
}

export interface FrameConfig {
  bgMode: BgMode
  /** 自定义背景图（dataURL / objectURL），bgMode==='custom' 时使用 */
  customBgImage: string | null
  overlayAlign: OverlayAlign
  overlayBottom: number

  blur: number
  padding: number
  scale: number
  radius: number
  shadow: number

  /** 主照片自由变换（Word 式拖拽） */
  photoX: number | null // 设计坐标左上角 X；null = 自动居中
  photoY: number | null // 设计坐标左上角 Y；null = 自动居中

  /** 当前主照片 src（dataURL / objectURL），null 表示未导入 */
  photoSrc: string | null

  /** 照片编辑：旋转 + 裁剪（手机式） */
  photoRotation: PhotoRotation // 顺时针旋转角度
  photoCrop: PhotoCrop // 归一化裁剪矩形（相对旋转后照片）

  brand: string
  showLogo: boolean
  logoSize: number
  logoOpacity: number

  showExif: boolean
  exifText: string
  fontFamily: string
  fontSize: number
  textWeight: number
  textOpacity: number

  distPhotoLogo: number
  distLogoText: number
  distBottom: number

  showCameraModel: boolean
  cameraModel: string
  cameraModelFont: string
  cameraModelSize: number
  cameraModelWeight: number
  cameraModelGap: number
  cameraModelOpacity: number
  cameraModelItalic: boolean
  cameraModelOffsetX: number
  cameraModelOffsetY: number

  /** 品牌 Logo / 相机型号 / EXIF 在 1200px 设计坐标系中的绝对位置（像素，左上角）。
   *  null 表示未手动拖动，由预览/导出按默认布局自动定位。三项可独立拖动。 */
  logoX: number | null
  logoY: number | null
  modelX: number | null
  modelY: number | null
  exifX: number | null
  exifY: number | null

  /** 背景自由变换（缩放 + 平移），设计坐标 */
  bgScale: number // 背景缩放倍数（1 = cover 铺满）
  bgOffsetX: number // 背景平移 X（设计像素）
  bgOffsetY: number // 背景平移 Y（设计像素）

  /** 画板底色（最底层容器背景，none 模式透明时用于 JPG 兜底） */
  artboardColor: string

  /** 附加效果：暗角（vignette）与颗粒（grain） */
  vignette: number // 0..1 暗角强度
  grain: number // 0..1 颗粒强度

  /** 水印叠加（用户自定义文本/图片） */
  showWatermark: boolean
  watermarkText: string
  watermarkImage: string | null // 自定义水印图 dataURL
  watermarkOpacity: number
  watermarkSize: number // 相对画布宽度百分比
  watermarkAngle: number // 旋转角度（平铺模式用）
  watermarkTile: boolean // 平铺模式
  watermarkAlign: OverlayAlign
  watermarkBottom: number

  /** PS 式图层可见性：控制各图层是否参与预览与导出合成 */
  layerVisible: Record<LayerId, boolean>
}

export const defaultFrameConfig: FrameConfig = {
  bgMode: 'default',
  customBgImage: null,
  overlayAlign: 'center',
  overlayBottom: 20,

  blur: 40,
  padding: 80,
  scale: 90,
  radius: 20,
  shadow: 0.5,

  photoX: null,
  photoY: null,
  photoSrc: null,

  photoRotation: 0,
  photoCrop: { x: 0, y: 0, w: 1, h: 1 },

  brand: 'sony',
  showLogo: true,
  logoSize: 30,
  logoOpacity: 1,

  showExif: false,
  exifText: '200mm f/4 1/800s ISO400',
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  fontSize: 16,
  textWeight: 600,
  textOpacity: 1,

  distPhotoLogo: 40,
  distLogoText: 15,
  distBottom: 60,

  showCameraModel: true,
  cameraModel: 'A7R V',
  cameraModelFont: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  cameraModelSize: 14,
  cameraModelWeight: 600,
  cameraModelGap: 8,
  cameraModelOpacity: 1,
  cameraModelItalic: false,
  cameraModelOffsetX: 0,
  cameraModelOffsetY: 0,

  logoX: null,
  logoY: null,
  modelX: null,
  modelY: null,
  exifX: null,
  exifY: null,

  bgScale: 1,
  bgOffsetX: 0,
  bgOffsetY: 0,

  artboardColor: 'transparent',

  vignette: 0,
  grain: 0,

  showWatermark: false,
  watermarkText: '© PHOTOGRAPHER',
  watermarkImage: null,
  watermarkOpacity: 0.25,
  watermarkSize: 18,
  watermarkAngle: 30,
  watermarkTile: true,
  watermarkAlign: 'center',
  watermarkBottom: 40,

  layerVisible: { artboard: true, bg: true, photo: true, info: true },
}
