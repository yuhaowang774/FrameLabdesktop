// 水印署名族重写版（2026-10-06）：参考主流手机相机水印的版式语言重做整套 10 套，
// 取代原「浮层规格行」族（4 套 BUILTIN + 6 套文字块）。config 冻结为独立字面量（同 promotedTemplates 惯例）。
//
// 版式范式（学习思路、自主表达，命名/文案/配色全部自有）：
//   1. brand_band      白底签名带：居中品牌字标 + 灰字参数行
//   2. brand_statement 大留白品牌宣言：超宽白带只留一枚居中字标
//   3. three_zone      三段底栏：左机型 / 中字标 / 右拍摄坐标
//   4. sign_script     手写签名 + 字距副题 + 参数行（影集扉页注脚）
//   5. sign_dark       黑底签名带：签名居左、参数日期居右
//   6. tech_two_corner 模糊延展 + 顶部刊头 + 底缘两角参数/坐标
//   7. model_label     宽白卡装裱：顶部字标 + 底部机型名 + 标签式参数行
//   8. accent_stack    白底堆叠：徽标 + 强调色参数 + 坐标 + 日期
//   9. zone_two_line   三段两行底栏：左机型日期 / 中徽标 / 右参数坐标
//  10. serif_corner    方幅右下角衬线日期角标
//
// 通用约束：品牌字标/logo 元素只放在实底带上（自动取色可靠）；浮在照片/模糊底上的
// 文字一律白色 + shadow；{gps}/{model}/{date} 缺数据时整元素自动消失，不打乱布局。
import type { FrameTemplate } from '../composables/useTemplates'
import type {
  TextInfoElement,
  ExifInfoElement,
  LogoInfoElement,
  DividerInfoElement,
} from './types'

const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
const MONO = "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace"
const SERIF = "Georgia, 'Times New Roman', serif"
const SCRIPT = "'Segoe Script', 'Brush Script MT', 'Comic Sans MS', cursive"

/** 白底签名带的公共底参数 */
const WHITE_BAND = {
  bgMode: 'solid',
  bgColor: '#FFFFFF',
  borderColor: '#FFFFFF',
  photoRadius: 0,
  borderRadius: 0,
  scale: 100,
  shadow: 0,
  frameRatio: null,
  infoLayout: 'classic',
  showLogo: false,
  showCameraModel: false,
  showExif: false,
  showLens: false,
  showDate: false,
  dateFormat: 'date',
  fontFamily: SANS,
  fontSize: 24,
  textWeight: 500,
  textOpacity: 1,
  vignette: 0,
  grain: 0,
  showWatermark: false,
  deviceMockup: 'none',
} as const

/** 暗底/铺满款的公共底参数 */
const DARK_BASE = {
  ...WHITE_BAND,
  bgColor: '#0A0A0A',
  borderColor: '#0A0A0A',
} as const

/** 居中参数行（四段合一行，缺字段自动跳过） */
const PARAMS_LINE = '{focal}   {aperture}   {shutter}   {iso}'

// 元素工厂：入参按真实元素接口全量校验（id/x/y/样式必填），仅公共字段与返回值收窄。
type TextSpec = Omit<TextInfoElement, 'type' | 'enable' | 'scale' | 'rotate' | 'zIndex' | 'exportable' | 'lineHeight'>
type ExifSpec = Omit<ExifInfoElement, 'type' | 'enable' | 'scale' | 'rotate' | 'zIndex' | 'exportable' | 'lineHeight'>
type LogoSpec = Omit<LogoInfoElement, 'type' | 'enable' | 'scale' | 'rotate' | 'zIndex' | 'exportable' | 'opacity' | 'logoId'> & {
  opacity?: number
  /** 缺省 'brand'：跟随当前照片品牌 */
  logoId?: string
}
type DividerSpec = Omit<DividerInfoElement, 'type' | 'enable' | 'scale' | 'rotate' | 'zIndex' | 'exportable' | 'opacity'> & { opacity?: number }

function textEl(e: TextSpec): TextInfoElement {
  return { enable: true, scale: 1, rotate: 0, zIndex: 1, exportable: true, lineHeight: 1.2, ...e, type: 'text' } as TextInfoElement
}
function exifEl(e: ExifSpec): ExifInfoElement {
  return { enable: true, scale: 1, rotate: 0, zIndex: 1, exportable: true, lineHeight: 1.2, ...e, type: 'exif' } as ExifInfoElement
}
function logoEl(e: LogoSpec): LogoInfoElement {
  const { opacity, logoId, ...rest } = e
  return { enable: true, scale: 1, rotate: 0, zIndex: 1, exportable: true, opacity: 1, logoId: logoId ?? 'brand', ...rest, type: 'logo' } as LogoInfoElement
}
function dividerEl(e: DividerSpec): DividerInfoElement {
  const { opacity, ...rest } = e
  return { enable: true, scale: 1, rotate: 0, zIndex: 1, exportable: true, opacity: 1, ...rest, type: 'divider' } as DividerInfoElement
}

export const WATERMARK_SIGNATURE_TEMPLATES: FrameTemplate[] = [
  // ===== 1. 品牌签名带·居中：白带 + 居中字标 + 灰字参数行 =====
  {
    id: 'm_wm2_brand_band',
    group: '水印署名',
    name: '品牌签名带·居中',
    desc: '白底下边带居中排布品牌字标与灰字参数行，克制干净的签名款',
    category: 'frame',
    builtin: true,
    config: {
      ...WHITE_BAND,
      padding: 0,
      borderRatio: 203,
      infoLayer: {
        enabled: true,
        bindTarget: 'canvas',
        elements: [
          logoEl({ id: 'el-wm2-bb-logo', x: 0, y: -132, baseWidth: 257, anchorX: 'center', anchorY: 'bottom' }),
          exifEl({
            id: 'el-wm2-bb-params', x: 0, y: -57, anchorX: 'center', anchorY: 'bottom',
            template: PARAMS_LINE, fontFamily: SANS, fontSize: 23, fontWeight: 500,
            color: '#8C8C8C', align: 'center', letterSpacing: 3, opacity: 1,
          }),
        ],
      },
    },
  },

  // ===== 2. 品牌宣言·大留白：超宽白带只留一枚居中字标 =====
  {
    id: 'm_wm2_brand_statement',
    group: '水印署名',
    name: '品牌宣言·大留白',
    desc: '超宽白底下边带只保留一枚居中品牌字标，大留白的极简宣言',
    category: 'frame',
    builtin: true,
    config: {
      ...WHITE_BAND,
      padding: 0,
      borderRatio: 324,
      infoLayer: {
        enabled: true,
        bindTarget: 'canvas',
        elements: [
          logoEl({ id: 'el-wm2-bs-logo', x: 0, y: -162, baseWidth: 311, anchorX: 'center', anchorY: 'bottom' }),
        ],
      },
    },
  },

  // ===== 3. 三段底栏·机型地点：左机型 / 中字标 / 右坐标 =====
  {
    id: 'm_wm2_three_zone',
    group: '水印署名',
    name: '三段底栏·机型地点',
    desc: '细白底栏三段式：左机型、中字标、右拍摄坐标，单行收纳的记录款',
    category: 'frame',
    builtin: true,
    config: {
      ...WHITE_BAND,
      padding: 0,
      borderRatio: 119,
      infoLayer: {
        enabled: true,
        bindTarget: 'canvas',
        elements: [
          exifEl({
            id: 'el-wm2-tz-model', x: 74, y: -59, anchorX: 'left', anchorY: 'bottom',
            template: '{model}', fontFamily: SANS, fontSize: 26, fontWeight: 600,
            color: '#1A1A1A', align: 'left', letterSpacing: 1, opacity: 1,
          }),
          logoEl({ id: 'el-wm2-tz-logo', x: 0, y: -59, baseWidth: 70, anchorX: 'center', anchorY: 'bottom' }),
          exifEl({
            id: 'el-wm2-tz-gps', x: -74, y: -59, anchorX: 'right', anchorY: 'bottom',
            template: '{gps}', fontFamily: SANS, fontSize: 22, fontWeight: 500,
            color: '#1A1A1A', align: 'right', letterSpacing: 1, opacity: 0.92,
          }),
        ],
      },
    },
  },

  // ===== 4. 手写签名·注脚：签名 + 字距副题 + 参数行 =====
  {
    id: 'm_wm2_sign_script',
    group: '水印署名',
    name: '手写签名·注脚',
    desc: '白底带上手写签名与宽字距副题，下衬一行拍摄参数，影集扉页式注脚',
    category: 'frame',
    builtin: true,
    config: {
      ...WHITE_BAND,
      padding: 0,
      borderRatio: 284,
      infoLayer: {
        enabled: true,
        bindTarget: 'canvas',
        elements: [
          textEl({
            id: 'el-wm2-ss-sign', x: 0, y: -205, anchorX: 'center', anchorY: 'bottom',
            text: 'Ever Glow', fontFamily: SCRIPT, fontSize: 40, fontWeight: 400,
            color: '#34435E', align: 'center', letterSpacing: 1, opacity: 0.95,
          }),
          textEl({
            id: 'el-wm2-ss-caps', x: 0, y: -146, anchorX: 'center', anchorY: 'bottom',
            text: 'STILL FRAME · PHOTO RECORD', fontFamily: SANS, fontSize: 19, fontWeight: 500,
            color: '#8C8C8C', align: 'center', letterSpacing: 9, opacity: 1,
          }),
          exifEl({
            id: 'el-wm2-ss-params', x: 0, y: -62, anchorX: 'center', anchorY: 'bottom',
            template: PARAMS_LINE, fontFamily: SANS, fontSize: 23, fontWeight: 500,
            color: '#1A1A1A', align: 'center', letterSpacing: 3, opacity: 1,
          }),
        ],
      },
    },
  },

  // ===== 5. 暗调签名带：黑底，签名居左、参数日期居右 =====
  {
    id: 'm_wm2_sign_dark',
    group: '水印署名',
    name: '暗调签名带·黑底',
    desc: '黑底签名带：手写签名居左、等宽参数与日期居右，暗调影展署名',
    category: 'frame',
    builtin: true,
    config: {
      ...DARK_BASE,
      padding: 0,
      borderRatio: 176,
      infoLayer: {
        enabled: true,
        bindTarget: 'canvas',
        elements: [
          textEl({
            id: 'el-wm2-sd-sign', x: 74, y: -94, anchorX: 'left', anchorY: 'bottom',
            text: 'Ever Glow', fontFamily: SCRIPT, fontSize: 34, fontWeight: 400,
            color: '#F2F2F2', align: 'left', letterSpacing: 1, opacity: 0.95,
          }),
          exifEl({
            id: 'el-wm2-sd-params', x: -74, y: -113, anchorX: 'right', anchorY: 'bottom',
            template: PARAMS_LINE, fontFamily: MONO, fontSize: 22, fontWeight: 500,
            color: '#9A9A9A', align: 'right', letterSpacing: 1, opacity: 1,
          }),
          exifEl({
            id: 'el-wm2-sd-date', x: -74, y: -62, anchorX: 'right', anchorY: 'bottom',
            template: '{date}', fontFamily: MONO, fontSize: 19, fontWeight: 400,
            color: '#9A9A9A', align: 'right', letterSpacing: 3, opacity: 0.9,
          }),
        ],
      },
    },
  },

  // ===== 6. 刊头字标·两角遥测：模糊延展 + 顶部刊头 + 底缘两角 =====
  {
    id: 'm_wm2_tech_two_corner',
    group: '水印署名',
    name: '刊头字标·两角遥测',
    desc: '照片模糊延展成底，顶部字距刊头，底缘左右两角分列参数与拍摄坐标',
    category: 'frame',
    builtin: true,
    config: {
      bgMode: 'blur',
      blur: 40,
      bgExpand: 113,
      bgBottomRatio: 89,
      bgColor: '#0A0A0A',
      borderColor: '#0A0A0A',
      padding: 0,
      borderRatio: 0,
      photoRadius: 0,
      borderRadius: 0,
      scale: 100,
      shadow: 0,
      frameRatio: null,
      infoLayout: 'classic',
      showLogo: false,
      showCameraModel: false,
      showExif: false,
      showLens: false,
      showDate: false,
      dateFormat: 'date',
      fontFamily: MONO,
      fontSize: 22,
      textWeight: 500,
      textOpacity: 1,
      vignette: 0,
      grain: 0,
      showWatermark: false,
      deviceMockup: 'none',
      infoLayer: {
        enabled: true,
        bindTarget: 'canvas',
        elements: [
          textEl({
            id: 'el-wm2-tc-head', x: 46, y: 57, anchorX: 'left', anchorY: 'top',
            text: 'STILL FRAME', fontFamily: MONO, fontSize: 24, fontWeight: 600,
            color: '#FFFFFF', align: 'left', letterSpacing: 8, opacity: 0.95, shadow: true,
          }),
          exifEl({
            id: 'el-wm2-tc-params', x: 46, y: -146, anchorX: 'left', anchorY: 'bottom',
            template: PARAMS_LINE, fontFamily: MONO, fontSize: 22, fontWeight: 500,
            color: '#F2F2F2', align: 'left', letterSpacing: 1, opacity: 1, shadow: true,
          }),
          exifEl({
            id: 'el-wm2-tc-gps', x: -46, y: -146, anchorX: 'right', anchorY: 'bottom',
            template: '{gps}', fontFamily: MONO, fontSize: 20, fontWeight: 400,
            color: '#F2F2F2', align: 'right', letterSpacing: 1, opacity: 0.85, shadow: true,
          }),
        ],
      },
    },
  },

  // ===== 7. 顶部字标·型号注脚：宽白卡装裱，顶部字标 + 底部机型 + 标签参数行 =====
  {
    id: 'm_wm2_model_label',
    group: '水印署名',
    name: '顶部字标·型号注脚',
    desc: '宽白卡装裱：顶部品牌字标，底部机型名与标签式参数行（FL/Aperture/Shutter/ISO）',
    category: 'frame',
    builtin: true,
    config: {
      ...WHITE_BAND,
      padding: 119,
      borderRatio: 203,
      infoLayer: {
        enabled: true,
        bindTarget: 'canvas',
        elements: [
          logoEl({ id: 'el-wm2-ml-logo', x: 0, y: 59, baseWidth: 257, anchorX: 'center', anchorY: 'top' }),
          exifEl({
            id: 'el-wm2-ml-model', x: 0, y: -197, anchorX: 'center', anchorY: 'bottom',
            template: '{model}', fontFamily: SANS, fontSize: 28, fontWeight: 600,
            color: '#1A1A1A', align: 'center', letterSpacing: 1, opacity: 1,
          }),
          exifEl({
            id: 'el-wm2-ml-params', x: 0, y: -139, anchorX: 'center', anchorY: 'bottom',
            template: 'FL {focal}   Aperture {aperture}   Shutter {shutter}   {iso}',
            fontFamily: SANS, fontSize: 20, fontWeight: 500,
            color: '#8C8C8C', align: 'center', letterSpacing: 1, opacity: 1,
          }),
        ],
      },
    },
  },

  // ===== 8. 品牌徽标·强调参数：白底堆叠（徽标 / 强调色参数 / 坐标 / 日期） =====
  {
    id: 'm_wm2_accent_stack',
    group: '水印署名',
    name: '品牌徽标·强调参数',
    desc: '白底带居中堆叠：徽标、强调色参数行、拍摄坐标与日期，层次分明的签名款',
    category: 'frame',
    builtin: true,
    config: {
      ...WHITE_BAND,
      padding: 0,
      borderRatio: 270,
      infoLayer: {
        enabled: true,
        bindTarget: 'canvas',
        elements: [
          logoEl({ id: 'el-wm2-as-logo', x: 0, y: -213, baseWidth: 76, anchorX: 'center', anchorY: 'bottom' }),
          exifEl({
            id: 'el-wm2-as-params', x: 0, y: -140, anchorX: 'center', anchorY: 'bottom',
            template: PARAMS_LINE, fontFamily: SANS, fontSize: 23, fontWeight: 600,
            color: '#C0392B', align: 'center', letterSpacing: 3, opacity: 1,
          }),
          exifEl({
            id: 'el-wm2-as-gps', x: 0, y: -89, anchorX: 'center', anchorY: 'bottom',
            template: '{gps}', fontFamily: SANS, fontSize: 20, fontWeight: 400,
            color: '#8C8C8C', align: 'center', letterSpacing: 1, opacity: 1,
          }),
          exifEl({
            id: 'el-wm2-as-date', x: 0, y: -49, anchorX: 'center', anchorY: 'bottom',
            template: '{date}', fontFamily: SANS, fontSize: 20, fontWeight: 400,
            color: '#8C8C8C', align: 'center', letterSpacing: 1, opacity: 1,
          }),
        ],
      },
    },
  },

  // ===== 9. 三段两行·信息底栏：左机型日期 / 中徽标 / 右参数坐标 =====
  {
    id: 'm_wm2_zone_two_line',
    group: '水印署名',
    name: '三段两行·信息底栏',
    desc: '细白底栏两行三段：左机型与日期、中徽标、右参数与坐标，信息密度从容',
    category: 'frame',
    builtin: true,
    config: {
      ...WHITE_BAND,
      padding: 0,
      borderRatio: 135,
      infoLayer: {
        enabled: true,
        bindTarget: 'canvas',
        elements: [
          exifEl({
            id: 'el-wm2-zt-model', x: 74, y: -92, anchorX: 'left', anchorY: 'bottom',
            template: '{model}', fontFamily: SANS, fontSize: 24, fontWeight: 600,
            color: '#1A1A1A', align: 'left', letterSpacing: 1, opacity: 1,
          }),
          exifEl({
            id: 'el-wm2-zt-date', x: 74, y: -43, anchorX: 'left', anchorY: 'bottom',
            template: '{date}', fontFamily: SANS, fontSize: 19, fontWeight: 400,
            color: '#8C8C8C', align: 'left', letterSpacing: 1, opacity: 1,
          }),
          logoEl({ id: 'el-wm2-zt-logo', x: 0, y: -67, baseWidth: 62, anchorX: 'center', anchorY: 'bottom' }),
          exifEl({
            id: 'el-wm2-zt-params', x: -74, y: -92, anchorX: 'right', anchorY: 'bottom',
            template: PARAMS_LINE, fontFamily: SANS, fontSize: 22, fontWeight: 500,
            color: '#1A1A1A', align: 'right', letterSpacing: 1, opacity: 1,
          }),
          exifEl({
            id: 'el-wm2-zt-gps', x: -74, y: -43, anchorX: 'right', anchorY: 'bottom',
            template: '{gps}', fontFamily: SANS, fontSize: 19, fontWeight: 400,
            color: '#8C8C8C', align: 'right', letterSpacing: 1, opacity: 1,
          }),
        ],
      },
    },
  },

  // ===== 10. 衬线角标·日期：方幅右下角细线 + 衬线日期 + 小刊头 =====
  {
    id: 'm_wm2_serif_corner',
    group: '水印署名',
    name: '衬线角标·日期',
    desc: '方形画幅右下角：细线、小字距刊头与衬线日期，安静的胶片角落署名',
    category: 'frame',
    builtin: true,
    config: {
      ...DARK_BASE,
      padding: 0,
      borderRatio: 0,
      frameRatio: 1,
      infoLayer: {
        enabled: true,
        bindTarget: 'canvas',
        elements: [
          textEl({
            id: 'el-wm2-sc-caps', x: -74, y: -186, anchorX: 'right', anchorY: 'bottom',
            text: 'STILL FRAME', fontFamily: SANS, fontSize: 18, fontWeight: 500,
            color: '#FFFFFF', align: 'right', letterSpacing: 11, opacity: 0.8, shadow: true,
          }),
          dividerEl({
            id: 'el-wm2-sc-rule', x: -74, y: -148, anchorX: 'right', anchorY: 'bottom',
            width: 297, thickness: 1, color: '#FFFFFF', opacity: 0.55,
          }),
          exifEl({
            id: 'el-wm2-sc-date', x: -74, y: -86, anchorX: 'right', anchorY: 'bottom',
            template: '{date}', fontFamily: SERIF, fontSize: 32, fontWeight: 500,
            color: '#FFFFFF', align: 'right', letterSpacing: 7, opacity: 0.95, shadow: true,
          }),
        ],
      },
    },
  },
]
