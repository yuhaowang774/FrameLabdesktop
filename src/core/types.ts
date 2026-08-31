/** 背景模式：背景模糊 | 纯色 | 照片填充 */
export type BgMode = 'blur' | 'solid' | 'photo'
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
  /** 自定义背景图（dataURL / objectURL），bgMode==='photo' 时使用 */
  customBgImage: string | null
  /** 纯色背景颜色，bgMode==='solid' 时使用 */
  bgColor: string
  overlayAlign: OverlayAlign
  overlayBottom: number

  blur: number
  padding: number
  /** 下边宽度（设计 px，>0 时在照片下边额外延长的留白宽）：下边总留白 = padding + borderRatio。0 = 四边等宽 */
  borderRatio: number
  /** 边框留白区颜色（纯色相框底色），支持取色器与预设（纯白/纯黑/复古米白） */
  borderColor: string
  /** 边框（画板）外圆角半径（设计 px，0~50），现代极简风 */
  borderRadius: number
  /** 照片圆角半径（设计 px，0~50） */
  photoRadius: number
  /** 画面（边框）比例：内容区宽高比（宽/高）。null = 自由（跟随照片）；如 16/9、4/3、1/1 */
  frameRatio: number | null
  scale: number
  shadow: number

  /**
   * 画布设计总高度（含上下 padding）。
   * 导入照片时按"初始照片高度 + 2*padding"计算一次并固定，之后缩放/平移照片
   * 不再改变画布高度，从而背景层不会随照片大小编辑而变化。0 表示未初始化。
   */
  canvasH: number

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
  /**
   * 品牌 Logo 着色：
   * - 'auto'=随背景明暗自适应（纯色浅底用近黑 #1a1a1a，其余深底/模糊/照片用纯白），保证对比可见；
   * - 其余为具体色值（如品牌主色 '#FFE100'、'#ffffff'），由用户显式指定。
   * 解析见 core/colorUtils.logoAutoColor（预览与导出共用）。
   */
  logoColor: string

  showExif: boolean
  exifText: string
  /** 镜头型号显示（EXIF LensModel，可手改）：作为 EXIF 文本块的附加行渲染 */
  showLens: boolean
  /** 镜头型号文本（导入时自动解析 LensMake+LensModel 填充，可手改） */
  lensText: string
  /** 等效焦距显示：false=原始焦距；true=优先 EXIF 35mm 字段（缺失时用 cropFactor 换算） */
  eqFocal: boolean
  /** 手动画幅裁切系数（0=自动用 EXIF 35mm 字段；>0 时等效焦距 = 焦距 × 系数） */
  cropFactor: number
  /** 拍摄日期显示（EXIF DateTimeOriginal，可手改） */
  showDate: boolean
  /** 拍摄日期显示文本（由导入解析按 dateFormat 格式化，可手改） */
  dateText: string
  /** 日期格式：date=YYYY/MM/DD，datetime=含时分，zh=中文年月日 */
  dateFormat: 'date' | 'datetime' | 'zh' | 'dash'
  /** INFO 布局预设：classic=纵向堆叠（默认）；duo=杂志双栏（左：镜头/机型块 / 中：Logo / 右：参数+日期，竖线分隔）；
   *  inline=悬浮居中双行（行1：Logo+机型内联居中；行2：参数居中）；
   *  card=手机白底水印卡（左：机型+日期 / 右：参数+镜头 / 右端联名标块，配色随 infoCardTheme） */
  infoLayout: 'classic' | 'duo' | 'inline' | 'card'
  /** card 模式卡片底色：white=白底深字（默认），black=黑底浅字 */
  infoCardTheme: 'white' | 'black'
  /** card 模式是否显示日期行（左列下行） */
  cardShowDate: boolean
  fontFamily: string
  fontSize: number
  textWeight: number
  textOpacity: number

  // ===== EXIF / 镜头 / 日期 独立文本样式（null = 跟随整体 INFO 样式 fontSize/fontFamily/textWeight/textOpacity）=====
  exifFontFamily: string | null
  exifFontSize: number | null
  exifTextWeight: number | null
  exifTextOpacity: number | null
  lensFontFamily: string | null
  lensFontSize: number | null
  lensTextWeight: number | null
  lensTextOpacity: number | null
  dateFontFamily: string | null
  dateFontSize: number | null
  dateTextWeight: number | null
  dateTextOpacity: number | null
  // 各组独立文本颜色（null = 跟随整体自适应色，随背景明暗取黑/白）
  exifTextColor: string | null
  lensTextColor: string | null
  dateTextColor: string | null

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
  cameraModelColor: string | null
  cameraModelItalic: boolean
  cameraModelOffsetX: number
  cameraModelOffsetY: number

  /** 品牌 Logo / 相机型号 / EXIF / 拍摄日期 在 1200px 设计坐标系中的绝对位置（像素，左上角）。
   *  null 表示未手动拖动，由预览/导出按默认布局自动定位。各项可独立拖动。 */
  logoX: number | null
  logoY: number | null
  modelX: number | null
  modelY: number | null
  exifX: number | null
  exifY: number | null
  dateX: number | null
  dateY: number | null
  /** 镜头行位置（duo 布局左栏上行；classic 下镜头行随 EXIF 块，不使用） */
  lensX: number | null
  lensY: number | null

  /** 背景自由变换（缩放 + 平移），设计坐标 */
  bgScale: number // 背景缩放倍数（1 = cover 铺满）
  bgOffsetX: number // 背景平移 X（设计像素）
  bgOffsetY: number // 背景平移 Y（设计像素）
  /** 背景区域扩展量（设计 px，0 = 背景恰好覆盖内容区；>0 = 背景向外扩展，边框/画布同步跟随） */
  bgExpand: number
  /** 背景下边宽度（设计 px，>0 时在背景下边额外延长的宽度）：下边总扩展 = bgExpand + bgBottomRatio。0 = 等宽 */
  bgBottomRatio: number

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

  /** 原始 EXIF 字段（已由上传流程解析写入，供 EXIF 元素模板渲染） */
  exifRaw: { focalLength?: number; focalLength35?: number; fNumber?: number; exposureTime?: number; iso?: number; dateTimeOriginal?: string; lensModel?: string; lensMake?: string } | null

  /** 顶层 INFO 多元素容器层（自由拖拽排版） */
  infoLayer: InfoLayerConfig

  /** PS 式图层可见性：控制各图层是否参与预览与导出合成 */
  layerVisible: Record<LayerId, boolean>
}

export const defaultFrameConfig: FrameConfig = {
  bgMode: 'blur',
  customBgImage: null,
  bgColor: '#000000',
  overlayAlign: 'center',
  overlayBottom: 20,

  blur: 40,
  padding: 0,
  borderRatio: 0,
  borderColor: '#000000',
  borderRadius: 0,
  photoRadius: 0,
  frameRatio: null,
  scale: 100,
  shadow: 0.5,
  canvasH: 0,

  photoX: null,
  photoY: null,
  photoSrc: null,

  photoRotation: 0,
  photoCrop: { x: 0, y: 0, w: 1, h: 1 },

  brand: 'sony',
  showLogo: false,
  logoSize: 40,
  logoOpacity: 1,
  logoColor: 'auto',

  showExif: false,
  exifText: '200mm f/4 1/800s ISO400',
  showLens: false,
  lensText: '',
  eqFocal: false,
  cropFactor: 0,
  showDate: false,
  dateText: '',
  dateFormat: 'date',
  infoLayout: 'classic',
  infoCardTheme: 'white',
  cardShowDate: true,
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  fontSize: 30,
  textWeight: 600,
  textOpacity: 1,

  // EXIF / 镜头 / 日期 独立文本样式（默认跟随整体）
  exifFontFamily: null,
  exifFontSize: null,
  exifTextWeight: null,
  exifTextOpacity: null,
  lensFontFamily: null,
  lensFontSize: null,
  lensTextWeight: null,
  lensTextOpacity: null,
  dateFontFamily: null,
  dateFontSize: null,
  dateTextWeight: null,
  dateTextOpacity: null,
  exifTextColor: null,
  lensTextColor: null,
  dateTextColor: null,

  distPhotoLogo: 40,
  distLogoText: 15,
  distBottom: 60,

  showCameraModel: false,
  cameraModel: 'A7R V',
  cameraModelFont: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  cameraModelSize: 40,
  cameraModelWeight: 600,
  cameraModelGap: 8,
  cameraModelOpacity: 1,
  cameraModelColor: null,
  cameraModelItalic: false,
  cameraModelOffsetX: 0,
  cameraModelOffsetY: 0,

  logoX: null,
  logoY: null,
  modelX: null,
  modelY: null,
  exifX: null,
  exifY: null,
  dateX: null,
  dateY: null,
  lensX: null,
  lensY: null,

  bgScale: 1,
  bgOffsetX: 0,
  bgOffsetY: 0,
  bgExpand: 0,
  bgBottomRatio: 0,

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

  exifRaw: null,

  layerVisible: { artboard: true, bg: true, photo: true, info: true },

  // ==========================================================================
  // 顶层 INFO 多元素容器层（自由拖拽排版）
  // --------------------------------------------------------------------------
  // 数据结构规范：infoLayer 包含 bindTarget（绑定目标）与 elements（子元素数组）
  //  - bindTarget = 'photo'：info 容器整体继承 photo 旋转/缩放/平移，子元素坐标为
  //    照片局部坐标系（相对旋转后照片中心，单位设计 px）
  //  - bindTarget = 'canvas'：info 容器不继承 photo 变换，子元素坐标为画布坐标系
  //    （相对画布中心，单位设计 px）
  //  每个子元素拥有独立 id/type/enable/x/y/scale/rotate/zIndex/样式/资源内容
  // ==========================================================================
  infoLayer: {
    enabled: true,
    bindTarget: 'canvas',
    elements: [],
  } as InfoLayerConfig,
}

// ============================================================================
// 顶层 INFO 多元素数据结构定义
// ============================================================================
export type InfoElementType = 'text' | 'exif' | 'logo' | 'divider'

/** info 子元素公共字段 */
export interface InfoElementBase {
  id: string
  type: InfoElementType
  enable: boolean
  /** 定位坐标（设计 px，相对绑定坐标系原点：照片中心或画布中心） */
  x: number
  y: number
  /** 缩放系数（1 = 100%） */
  scale: number
  /** 旋转角度（度，顺时针） */
  rotate: number
  /** 层级，越大越靠上 */
  zIndex: number
  /** 是否参与导出（false 则仅预览，不进成片） */
  exportable: boolean
  /** 不透明度 0..1 */
  opacity: number
}

/** 自定义文字元素 */
export interface TextInfoElement extends InfoElementBase {
  type: 'text'
  text: string
  fontFamily: string
  fontSize: number // 基础字号（设计 px），再乘 scale
  fontWeight: number
  color: string
  align: 'left' | 'center' | 'right'
  letterSpacing: number
  lineHeight: number
}

/** EXIF 文本块元素：模板形如 "{model}  {focal}  1/{shutter}s  ISO{iso}"，缺字段自动跳过 */
export interface ExifInfoElement extends InfoElementBase {
  type: 'exif'
  template: string
  fontFamily: string
  fontSize: number
  fontWeight: number
  color: string
  align: 'left' | 'center' | 'right'
  letterSpacing: number
  lineHeight: number
}

/** Logo 图片元素：内置品牌字标（brand）或自定义上传 Logo（custom:id） */
export interface LogoInfoElement extends InfoElementBase {
  type: 'logo'
  logoId: string // 'brand' | 'custom:id' | 'none'
  /** 基准宽度（设计 px，再乘 scale），高度按比例 */
  baseWidth: number
  brandCmyk?: [number, number, number, number]
}

/** 分割线元素 */
export interface DividerInfoElement extends InfoElementBase {
  type: 'divider'
  width: number // 基准宽度（设计 px，再乘 scale）
  thickness: number // 线宽（设计 px）
  color: string
}

export type InfoElement =
  | TextInfoElement
  | ExifInfoElement
  | LogoInfoElement
  | DividerInfoElement

/** 顶层 info 容器层配置 */
export interface InfoLayerConfig {
  /** 总开关 */
  enabled: boolean
  /** 绑定目标：photo（继承照片变换）/ canvas（画布坐标系） */
  bindTarget: 'photo' | 'canvas'
  /** 子元素数组（按 zIndex 升序绘制） */
  elements: InfoElement[]
}
