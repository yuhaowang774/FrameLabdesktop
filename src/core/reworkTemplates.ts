// 内置模板第二批质量重做（2026-10-06）：取代经典/创意排版/极简轻量里的 12 套
// 「小字多行堆叠」薄弱款（minFont 11~14px 的 6~8 行罗列）。config 冻结为独立字面量。
//
// 重做手法（延续水印署名族的设计语言）：
//   - 字号层级三档：刊头/机型 20~24、参数 15~18、标签小字 11~12（字距 3~6）
//   - 两色制：深灰 #1A1A1A 主体 + 中灰 #8C8C8C 次要，浅灰 #E3E3E3 细线
//   - 分区对齐：左缘堆叠 / 居中注脚 / 标签-值对照 / 三段单行，信息 ≤4 行不罗列
//   - 可选字段（{lens}/{gps}）整行自动消失，不留空槽
import type { FrameTemplate } from '../composables/useTemplates'
import type {
  TextInfoElement,
  ExifInfoElement,
  DividerInfoElement,
} from './types'

const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
const SERIF = "Georgia, 'Times New Roman', serif"
const MONO = "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace"

/** 白底卡公共底参数 */
const WHITE = {
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

/** 铺满款（浮层压字）公共底参数 */
const FULL = {
  ...WHITE,
  bgColor: '#000000',
  borderColor: '#000000',
  padding: 0,
  borderRatio: 0,
} as const

const PARAMS_LINE = '{focal}   {aperture}   {shutter}   {iso}'

type TextSpec = Omit<TextInfoElement, 'type' | 'enable' | 'scale' | 'rotate' | 'zIndex' | 'exportable' | 'lineHeight'>
type ExifSpec = Omit<ExifInfoElement, 'type' | 'enable' | 'scale' | 'rotate' | 'zIndex' | 'exportable' | 'lineHeight'>
type DividerSpec = Omit<DividerInfoElement, 'type' | 'enable' | 'scale' | 'rotate' | 'zIndex' | 'exportable' | 'opacity'> & {
  opacity?: number
  /** 竖线等旋转（度，顺时针）；缺省 0 */
  rotate?: number
}

function textEl(e: TextSpec): TextInfoElement {
  return { enable: true, scale: 1, rotate: 0, zIndex: 1, exportable: true, lineHeight: 1.2, ...e, type: 'text' } as TextInfoElement
}
function exifEl(e: ExifSpec): ExifInfoElement {
  return { enable: true, scale: 1, rotate: 0, zIndex: 1, exportable: true, lineHeight: 1.2, ...e, type: 'exif' } as ExifInfoElement
}
function dividerEl(e: DividerSpec): DividerInfoElement {
  const { opacity, rotate, ...rest } = e
  return { enable: true, scale: 1, rotate: rotate ?? 0, zIndex: 1, exportable: true, opacity: 1, ...rest, type: 'divider' } as DividerInfoElement
}

/** 标签小字（白底） */
function label(id: string, x: number, y: number, text: string, anchorX: 'left' | 'center' | 'right' = 'left', anchorY: 'bottom' | 'top' = 'bottom'): TextInfoElement {
  return textEl({
    id, x, y, anchorX, anchorY, text,
    fontFamily: SANS, fontSize: 15, fontWeight: 600,
    color: '#9A9A9A', align: anchorX, letterSpacing: 4, opacity: 1,
  })
}
/** 对照值（白底，深灰粗） */
function value(id: string, x: number, y: number, template: string, size = 17, anchorX: 'left' | 'center' | 'right' = 'left', anchorY: 'bottom' | 'top' = 'bottom'): ExifInfoElement {
  return exifEl({
    id, x, y, anchorX, anchorY, template,
    fontFamily: SANS, fontSize: size, fontWeight: 600,
    color: '#1A1A1A', align: anchorX, letterSpacing: 1, opacity: 1,
  })
}

export const REWORK_TEMPLATES: FrameTemplate[] = [
  // ===== 经典 1/8：居中装裱·衬线注脚（取代 白底居中·机型参数）=====
  {
    id: 'm_rw2_center_matte',
    group: '经典',
    name: '白底居中·衬线注脚',
    desc: '白底装裱底带居中三行：衬线机型名、细分隔线与灰字参数日期，安静的展陈注脚',
    category: 'frame',
    builtin: true,
    config: {
      ...WHITE,
      padding: 41,
      borderRatio: 257,
      infoLayer: {
        enabled: true,
        bindTarget: 'canvas',
        elements: [
          exifEl({
            id: 'el-rw2-cm-model', x: 0, y: -192, anchorX: 'center', anchorY: 'bottom',
            template: '{model}', fontFamily: SERIF, fontSize: 32, fontWeight: 600,
            color: '#1A1A1A', align: 'center', letterSpacing: 3, opacity: 1,
          }),
          dividerEl({ id: 'el-rw2-cm-rule', x: 0, y: -143, width: 76, thickness: 1, color: '#C9C9C9' }),
          exifEl({
            id: 'el-rw2-cm-params', x: 0, y: -78, anchorX: 'center', anchorY: 'bottom',
            template: PARAMS_LINE, fontFamily: SANS, fontSize: 22, fontWeight: 500,
            color: '#8C8C8C', align: 'center', letterSpacing: 3, opacity: 1,
          }),
          exifEl({
            id: 'el-rw2-cm-date', x: 0, y: -35, anchorX: 'center', anchorY: 'bottom',
            template: '{date}', fontFamily: SANS, fontSize: 19, fontWeight: 400,
            color: '#8C8C8C', align: 'center', letterSpacing: 4, opacity: 1,
          }),
        ],
      },
    },
  },

  // ===== 经典 2/8：数据卡·四组对照（取代 数据卡·四组对照）：左机型日期 / 右 2×2 标签格 =====
  {
    id: 'm_rw2_datacard_pairs',
    group: '经典',
    name: '数据卡·四组对照',
    desc: '白底带左列机型与日期、右片 2×2 标签值对照格，中间一道竖线分隔的规格卡',
    category: 'frame',
    builtin: true,
    config: {
      ...WHITE,
      padding: 46,
      borderRatio: 284,
      infoLayer: {
        enabled: true,
        bindTarget: 'canvas',
        elements: [
          exifEl({
            id: 'el-rw2-dp-model', x: 74, y: -230, anchorX: 'left', anchorY: 'bottom',
            template: '{model}', fontFamily: SANS, fontSize: 28, fontWeight: 600,
            color: '#1A1A1A', align: 'left', letterSpacing: 1, opacity: 1,
          }),
          exifEl({
            id: 'el-rw2-dp-date', x: 74, y: -181, anchorX: 'left', anchorY: 'bottom',
            template: '{date}', fontFamily: SANS, fontSize: 19, fontWeight: 400,
            color: '#8C8C8C', align: 'left', letterSpacing: 3, opacity: 1,
          }),
          dividerEl({ id: 'el-rw2-dp-vline', x: -575, y: -181, width: 157, thickness: 1, color: '#DDDDDD', rotate: 90 }),
          label('el-rw2-dp-l1', -420, -176, 'FOCAL LENGTH'),
          value('el-rw2-dp-v1', -420, -152, '{focal}'),
          label('el-rw2-dp-l2', -220, -176, 'APERTURE'),
          value('el-rw2-dp-v2', -220, -152, '{aperture}'),
          label('el-rw2-dp-l3', -420, -96, 'SHUTTER'),
          value('el-rw2-dp-v3', -420, -72, '{shutter}'),
          label('el-rw2-dp-l4', -220, -96, 'SENSITIVITY'),
          value('el-rw2-dp-v4', -220, -72, '{iso}'),
        ],
      },
    },
  },

  // ===== 经典 3/8：铭牌·字段行（取代 铭牌·五组字段）：标签左 / 值右的四行铭牌 =====
  {
    id: 'm_rw2_plaque_rows',
    group: '经典',
    name: '铭牌·字段行',
    desc: '白底铭牌四行对照：灰色小标签居左、参数值居右，行间细线分隔的展签排版',
    category: 'frame',
    builtin: true,
    config: {
      ...WHITE,
      padding: 41,
      borderRatio: 311,
      infoLayer: {
        enabled: true,
        bindTarget: 'canvas',
        elements: [
          label('el-rw2-pr-l1', 64, -192, 'MODEL'),
          value('el-rw2-pr-v1', -64, -192, '{model}', 17, 'right'),
          dividerEl({ id: 'el-rw2-pr-r1', x: 74, y: -224, width: 1052, thickness: 1, color: '#E8E8E8', anchorX: 'left' }),
          label('el-rw2-pr-l2', 64, -140, 'FOCAL'),
          value('el-rw2-pr-v2', -64, -140, '{focal}', 16, 'right'),
          dividerEl({ id: 'el-rw2-pr-r2', x: 74, y: -154, width: 1052, thickness: 1, color: '#E8E8E8', anchorX: 'left' }),
          label('el-rw2-pr-l3', 64, -88, 'EXPOSURE'),
          value('el-rw2-pr-v3', -64, -88, '{aperture}   {shutter}', 16, 'right'),
          dividerEl({ id: 'el-rw2-pr-r3', x: 74, y: -84, width: 1052, thickness: 1, color: '#E8E8E8', anchorX: 'left' }),
          label('el-rw2-pr-l4', 64, -36, 'DATE'),
          value('el-rw2-pr-v4', -64, -36, '{date}', 15, 'right'),
        ],
      },
    },
  },

  // ===== 经典 4/8：数值卡·居中大字（取代 数据卡·居中八行）=====
  {
    id: 'm_rw2_numeric_hero',
    group: '经典',
    name: '数值卡·居中大字',
    desc: '白底带居中大号参数行，上有机型小字、下有细线与日期，一眼读数的干净卡片',
    category: 'frame',
    builtin: true,
    config: {
      ...WHITE,
      padding: 41,
      borderRatio: 297,
      infoLayer: {
        enabled: true,
        bindTarget: 'canvas',
        elements: [
          exifEl({
            id: 'el-rw2-nh-model', x: 0, y: -265, anchorX: 'center', anchorY: 'bottom',
            template: '{model}', fontFamily: SANS, fontSize: 20, fontWeight: 600,
            color: '#8C8C8C', align: 'center', letterSpacing: 5, opacity: 1,
          }),
          exifEl({
            id: 'el-rw2-nh-hero', x: 0, y: -173, anchorX: 'center', anchorY: 'bottom',
            template: PARAMS_LINE, fontFamily: SANS, fontSize: 30, fontWeight: 600,
            color: '#1A1A1A', align: 'center', letterSpacing: 1, opacity: 1,
          }),
          dividerEl({ id: 'el-rw2-nh-rule', x: 0, y: -113, width: 97, thickness: 1, color: '#D0D0D0' }),
          exifEl({
            id: 'el-rw2-nh-date', x: 0, y: -59, anchorX: 'center', anchorY: 'bottom',
            template: '{date}', fontFamily: SANS, fontSize: 20, fontWeight: 400,
            color: '#8C8C8C', align: 'center', letterSpacing: 3, opacity: 1,
          }),
        ],
      },
    },
  },

  // ===== 经典 5/8：铭牌·四格横排（取代 铭牌·六组字段）：机型 + 横排四格标签值 =====
  {
    id: 'm_rw2_pairs_grid',
    group: '经典',
    name: '铭牌·四格横排',
    desc: '白底带左上机型名，下方横排四格「标签在上、数值在下」的参数铭牌',
    category: 'frame',
    builtin: true,
    config: {
      ...WHITE,
      padding: 41,
      borderRatio: 270,
      infoLayer: {
        enabled: true,
        bindTarget: 'canvas',
        elements: [
          exifEl({
            id: 'el-rw2-pg-model', x: 74, y: -265, anchorX: 'left', anchorY: 'bottom',
            template: '{model}', fontFamily: SANS, fontSize: 27, fontWeight: 600,
            color: '#1A1A1A', align: 'left', letterSpacing: 1, opacity: 1,
          }),
          dividerEl({ id: 'el-rw2-pg-rule', x: 74, y: -227, width: 1052, thickness: 1, color: '#E3E3E3', anchorX: 'left' }),
          label('el-rw2-pg-l1', -375, -110, 'FOCAL', 'center'),
          value('el-rw2-pg-v1', -375, -82, '{focal}', 18, 'center'),
          label('el-rw2-pg-l2', -125, -110, 'APERTURE', 'center'),
          value('el-rw2-pg-v2', -125, -82, '{aperture}', 18, 'center'),
          label('el-rw2-pg-l3', 125, -110, 'SHUTTER', 'center'),
          value('el-rw2-pg-v3', 125, -82, '{shutter}', 18, 'center'),
          label('el-rw2-pg-l4', 375, -110, 'DATE', 'center'),
          value('el-rw2-pg-v4', 375, -82, '{date}', 18, 'center'),
        ],
      },
    },
  },

  // ===== 经典 6/8：白边·三行记录（取代 白边·六行记录）=====
  {
    id: 'm_rw2_record_left',
    group: '经典',
    name: '白边·三行记录',
    desc: '白底带左对齐三行：机型、参数与镜头日期分列，克制的记录款',
    category: 'frame',
    builtin: true,
    config: {
      ...WHITE,
      padding: 43,
      borderRatio: 243,
      infoLayer: {
        enabled: true,
        bindTarget: 'canvas',
        elements: [
          exifEl({
            id: 'el-rw2-rl-model', x: 74, y: -213, anchorX: 'left', anchorY: 'bottom',
            template: '{model}', fontFamily: SANS, fontSize: 27, fontWeight: 600,
            color: '#1A1A1A', align: 'left', letterSpacing: 1, opacity: 1,
          }),
          exifEl({
            id: 'el-rw2-rl-params', x: 74, y: -154, anchorX: 'left', anchorY: 'bottom',
            template: PARAMS_LINE, fontFamily: SANS, fontSize: 22, fontWeight: 500,
            color: '#8C8C8C', align: 'left', letterSpacing: 3, opacity: 1,
          }),
          exifEl({
            id: 'el-rw2-rl-lens', x: 74, y: -78, anchorX: 'left', anchorY: 'bottom',
            template: '{lens}', fontFamily: SANS, fontSize: 19, fontWeight: 400,
            color: '#8C8C8C', align: 'left', letterSpacing: 1, opacity: 1,
          }),
          exifEl({
            id: 'el-rw2-rl-date', x: -74, y: -78, anchorX: 'right', anchorY: 'bottom',
            template: '{date}', fontFamily: SANS, fontSize: 19, fontWeight: 400,
            color: '#8C8C8C', align: 'right', letterSpacing: 3, opacity: 1,
          }),
        ],
      },
    },
  },

  // ===== 经典 7/8：白边·档案行（取代 白边·七行记录）：标签左/值右 + 行间细线 =====
  {
    id: 'm_rw2_archive_rows',
    group: '经典',
    name: '白边·档案行',
    desc: '白底档案卡四行：标签居左数值居右，行间细线贯穿如索引卡',
    category: 'frame',
    builtin: true,
    config: {
      ...WHITE,
      padding: 46,
      borderRatio: 324,
      infoLayer: {
        enabled: true,
        bindTarget: 'canvas',
        elements: [
          label('el-rw2-ar-l1', 64, -212, 'MODEL'),
          value('el-rw2-ar-v1', -64, -212, '{model}', 17, 'right'),
          dividerEl({ id: 'el-rw2-ar-r1', x: 74, y: -251, width: 1052, thickness: 1, color: '#E8E8E8', anchorX: 'left' }),
          label('el-rw2-ar-l2', 64, -160, 'FOCAL'),
          value('el-rw2-ar-v2', -64, -160, '{focal}', 16, 'right'),
          dividerEl({ id: 'el-rw2-ar-r2', x: 74, y: -181, width: 1052, thickness: 1, color: '#E8E8E8', anchorX: 'left' }),
          label('el-rw2-ar-l3', 64, -108, 'EXPOSURE'),
          value('el-rw2-ar-v3', -64, -108, '{aperture}   {shutter}', 16, 'right'),
          dividerEl({ id: 'el-rw2-ar-r3', x: 74, y: -111, width: 1052, thickness: 1, color: '#E8E8E8', anchorX: 'left' }),
          label('el-rw2-ar-l4', 64, -56, 'DATE'),
          value('el-rw2-ar-v4', -64, -56, '{date}', 15, 'right'),
        ],
      },
    },
  },

  // ===== 经典 8/8：白边·参数四行（取代 白边·参数四行）：左衬线机型 + 右 2×2 =====
  {
    id: 'm_rw2_border_four',
    group: '经典',
    name: '白边·参数四行',
    desc: '大下边白卡：左列衬线机型与镜头，右片 2×2 标签值格，展陈与参数并重',
    category: 'frame',
    builtin: true,
    config: {
      ...WHITE,
      padding: 49,
      borderRatio: 313,
      infoLayer: {
        enabled: true,
        bindTarget: 'canvas',
        elements: [
          exifEl({
            id: 'el-rw2-bf-model', x: 74, y: -283, anchorX: 'left', anchorY: 'bottom',
            template: '{model}', fontFamily: SERIF, fontSize: 32, fontWeight: 600,
            color: '#1A1A1A', align: 'left', letterSpacing: 1, opacity: 1,
          }),
          exifEl({
            id: 'el-rw2-bf-lens', x: 74, y: -232, anchorX: 'left', anchorY: 'bottom',
            template: '{lens}', fontFamily: SANS, fontSize: 19, fontWeight: 400,
            color: '#8C8C8C', align: 'left', letterSpacing: 1, opacity: 1,
          }),
          dividerEl({ id: 'el-rw2-bf-rule', x: 74, y: -189, width: 1052, thickness: 1, color: '#E3E3E3', anchorX: 'left' }),
          label('el-rw2-bf-l1', -420, -196, 'FOCAL LENGTH'),
          value('el-rw2-bf-v1', -420, -168, '{focal}'),
          label('el-rw2-bf-l2', -220, -196, 'APERTURE'),
          value('el-rw2-bf-v2', -220, -168, '{aperture}'),
          label('el-rw2-bf-l3', -420, -92, 'SHUTTER'),
          value('el-rw2-bf-v3', -420, -64, '{shutter}'),
          label('el-rw2-bf-l4', -220, -92, 'DATE'),
          value('el-rw2-bf-v4', -220, -64, '{date}'),
        ],
      },
    },
  },

  // ===== 创意排版 1/3：刊头·大字两行（取代 浮层刊头·顶部大字两行）=====
  {
    id: 'm_rw2_masthead_two',
    group: '创意排版',
    name: '刊头·大字两行',
    desc: '全幅照片左上衬线大字刊头与字距副题，底缘左右两角分列参数与日期',
    category: 'frame',
    builtin: true,
    config: {
      ...FULL,
      infoLayer: {
        enabled: true,
        bindTarget: 'canvas',
        elements: [
          textEl({
            id: 'el-rw2-mt-title', x: 74, y: 86, anchorX: 'left', anchorY: 'top',
            text: 'STILL FRAME', fontFamily: SERIF, fontSize: 34, fontWeight: 600,
            color: '#FFFFFF', align: 'left', letterSpacing: 14, opacity: 0.96, shadow: true,
          }),
          textEl({
            id: 'el-rw2-mt-caps', x: 74, y: 151, anchorX: 'left', anchorY: 'top',
            text: 'PHOTOGRAPHY JOURNAL', fontFamily: SANS, fontSize: 18, fontWeight: 500,
            color: '#FFFFFF', align: 'left', letterSpacing: 11, opacity: 0.8, shadow: true,
          }),
          exifEl({
            id: 'el-rw2-mt-params', x: 74, y: -65, anchorX: 'left', anchorY: 'bottom',
            template: PARAMS_LINE, fontFamily: MONO, fontSize: 20, fontWeight: 500,
            color: '#FFFFFF', align: 'left', letterSpacing: 1, opacity: 0.9, shadow: true,
          }),
          exifEl({
            id: 'el-rw2-mt-date', x: -74, y: -65, anchorX: 'right', anchorY: 'bottom',
            template: '{date}', fontFamily: MONO, fontSize: 20, fontWeight: 400,
            color: '#FFFFFF', align: 'right', letterSpacing: 3, opacity: 0.85, shadow: true,
          }),
        ],
      },
    },
  },

  // ===== 创意排版 2/3：四角·浮层记录（取代 浮层刊头·顶部六行）=====
  {
    id: 'm_rw2_corner_log',
    group: '创意排版',
    name: '四角·浮层记录',
    desc: '全幅照片四角记录：左上刊头、右上机型、左下参数、右下坐标，等宽字的取景器仪式感',
    category: 'frame',
    builtin: true,
    config: {
      ...FULL,
      infoLayer: {
        enabled: true,
        bindTarget: 'canvas',
        elements: [
          textEl({
            id: 'el-rw2-cl-head', x: 64, y: 70, anchorX: 'left', anchorY: 'top',
            text: 'STILL FRAME', fontFamily: MONO, fontSize: 22, fontWeight: 600,
            color: '#FFFFFF', align: 'left', letterSpacing: 7, opacity: 0.95, shadow: true,
          }),
          exifEl({
            id: 'el-rw2-cl-model', x: -64, y: 70, anchorX: 'right', anchorY: 'top',
            template: '{model}', fontFamily: MONO, fontSize: 20, fontWeight: 400,
            color: '#FFFFFF', align: 'right', letterSpacing: 3, opacity: 0.9, shadow: true,
          }),
          exifEl({
            id: 'el-rw2-cl-params', x: 64, y: -70, anchorX: 'left', anchorY: 'bottom',
            template: PARAMS_LINE, fontFamily: MONO, fontSize: 20, fontWeight: 500,
            color: '#FFFFFF', align: 'left', letterSpacing: 1, opacity: 0.9, shadow: true,
          }),
          exifEl({
            id: 'el-rw2-cl-gps', x: -64, y: -70, anchorX: 'right', anchorY: 'bottom',
            template: '{gps}', fontFamily: MONO, fontSize: 18, fontWeight: 400,
            color: '#FFFFFF', align: 'right', letterSpacing: 1, opacity: 0.8, shadow: true,
          }),
        ],
      },
    },
  },

  // ===== 创意排版 3/3：全景参数条·三段（取代 全景参数条·七行）=====
  {
    id: 'm_rw2_panorama_bar',
    group: '创意排版',
    name: '全景参数条·三段',
    desc: '宽幅白条三段单行：左机型、中参数、右日期，全景接片的利落收边',
    category: 'frame',
    builtin: true,
    config: {
      ...WHITE,
      padding: 0,
      borderRatio: 162,
      infoLayer: {
        enabled: true,
        bindTarget: 'canvas',
        elements: [
          exifEl({
            id: 'el-rw2-pb-model', x: 74, y: -81, anchorX: 'left', anchorY: 'bottom',
            template: '{model}', fontFamily: SANS, fontSize: 24, fontWeight: 600,
            color: '#1A1A1A', align: 'left', letterSpacing: 1, opacity: 1,
          }),
          exifEl({
            id: 'el-rw2-pb-params', x: 0, y: -81, anchorX: 'center', anchorY: 'bottom',
            template: PARAMS_LINE, fontFamily: SANS, fontSize: 20, fontWeight: 500,
            color: '#8C8C8C', align: 'center', letterSpacing: 3, opacity: 1,
          }),
          exifEl({
            id: 'el-rw2-pb-date', x: -74, y: -81, anchorX: 'right', anchorY: 'bottom',
            template: '{date}', fontFamily: SANS, fontSize: 20, fontWeight: 400,
            color: '#8C8C8C', align: 'right', letterSpacing: 3, opacity: 1,
          }),
        ],
      },
    },
  },

  // ===== 极简轻量 1/1：白边·日期注脚（取代 白边·日期三行）=====
  {
    id: 'm_rw2_date_edge',
    group: '极简轻量',
    name: '白边·日期注脚',
    desc: '窄白底带居中两行：衬线日期与宽字距小注，极简的时间署名',
    category: 'frame',
    builtin: true,
    config: {
      ...WHITE,
      padding: 35,
      borderRatio: 176,
      infoLayer: {
        enabled: true,
        bindTarget: 'canvas',
        elements: [
          exifEl({
            id: 'el-rw2-de-date', x: 0, y: -130, anchorX: 'center', anchorY: 'bottom',
            template: '{date}', fontFamily: SERIF, fontSize: 32, fontWeight: 500,
            color: '#1A1A1A', align: 'center', letterSpacing: 5, opacity: 1,
          }),
          textEl({
            id: 'el-rw2-de-caps', x: 0, y: -70, anchorX: 'center', anchorY: 'bottom',
            text: 'PHOTO RECORD', fontFamily: SANS, fontSize: 16, fontWeight: 500,
            color: '#8C8C8C', align: 'center', letterSpacing: 8, opacity: 1,
          }),
        ],
      },
    },
  },
]
