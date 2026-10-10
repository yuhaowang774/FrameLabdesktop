// 第三批质量重做（2026-10-06）：联名卡 + 大师水印两族，完成后两分组取消隐藏恢复展示。
// 取代：白卡/黑卡联名、品牌行×3、大师水印×3、机身壳·带下八行/左缘六行（同 id 重做）。
// 联名卡语言：品牌徽标为视觉锚点 + 机型名醒目 + 参数灰字（学习主流手机联名水印的构成，
// 命名/文案/配色自有）；大师水印语言：铭牌式居中题字（衬线 + 字距 + 克制配色）。
import type { FrameTemplate } from '../composables/useTemplates'
import type {
  TextInfoElement,
  ExifInfoElement,
  LogoInfoElement,
  DividerInfoElement,
} from './types'

const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
const SERIF = "Georgia, 'Times New Roman', serif"
const MONO = "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace"

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

const PARAMS_LINE = '{focal}   {aperture}   {shutter}   {iso}'

type TextSpec = Omit<TextInfoElement, 'type' | 'enable' | 'scale' | 'rotate' | 'zIndex' | 'exportable' | 'lineHeight'>
type ExifSpec = Omit<ExifInfoElement, 'type' | 'enable' | 'scale' | 'rotate' | 'zIndex' | 'exportable' | 'lineHeight'>
type LogoSpec = Omit<LogoInfoElement, 'type' | 'enable' | 'scale' | 'rotate' | 'zIndex' | 'exportable' | 'opacity' | 'logoId'> & {
  opacity?: number
  /** 缺省 'brand'：跟随当前照片品牌 */
  logoId?: string
}
type DividerSpec = Omit<DividerInfoElement, 'type' | 'enable' | 'scale' | 'rotate' | 'zIndex' | 'exportable' | 'opacity'> & {
  opacity?: number
  rotate?: number
}

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
  const { opacity, rotate, ...rest } = e
  return { enable: true, scale: 1, rotate: rotate ?? 0, zIndex: 1, exportable: true, opacity: 1, ...rest, type: 'divider' } as DividerInfoElement
}

export const CO_BRAND_TEMPLATES: FrameTemplate[] = [
  // ============ 联名卡 1/4：白卡水印（取代 白卡联名·水印卡，card 引擎布局承载款）============
  {
    id: 'm_co3_card_note',
    group: '联名卡',
    name: '白卡联名·水印卡',
    desc: '照片上悬浮白卡：左机型+日期 / 右参数+镜头，联名标块随照片品牌官方配色',
    category: 'frame',
    builtin: true,
    config: {
      bgMode: 'blur',
      blur: 0,
      padding: 0,
      borderRatio: 0,
      photoRadius: 0,
      borderRadius: 0,
      scale: 100,
      shadow: 0,
      frameRatio: null,
      infoLayout: 'card',
      overlayAlign: 'center',
      overlayBottom: 26,
      showLogo: false,
      showCameraModel: true,
      cameraModelSize: 30,
      cameraModelWeight: 600,
      showExif: true,
      showLens: true,
      showDate: true,
      cardShowDate: true,
      fontSize: 24,
      textWeight: 500,
      textOpacity: 1,
      vignette: 0,
      grain: 0,
      showWatermark: false,
      deviceMockup: 'none',
    },
  },

  // ============ 联名卡 2/4：黑卡夜色（取代 黑卡联名·夜色，card 引擎布局承载款）============
  {
    id: 'm_co3_card_dark',
    group: '联名卡',
    name: '黑卡联名·夜色',
    desc: '黑底浅字水印卡，夜间街拍更有质感；联名标块随照片品牌官方配色',
    category: 'frame',
    builtin: true,
    config: {
      bgMode: 'blur',
      blur: 0,
      padding: 0,
      borderRatio: 0,
      photoRadius: 0,
      borderRadius: 0,
      scale: 100,
      shadow: 0,
      frameRatio: null,
      infoLayout: 'card',
      overlayAlign: 'center',
      overlayBottom: 26,
      infoCardTheme: 'black',
      showLogo: false,
      showCameraModel: true,
      cameraModelSize: 30,
      cameraModelWeight: 600,
      showExif: true,
      showLens: true,
      showDate: true,
      cardShowDate: true,
      fontSize: 24,
      textWeight: 500,
      textOpacity: 1,
      vignette: 0,
      grain: 0,
      showWatermark: false,
      deviceMockup: 'none',
    },
  },

  // ============ 联名卡 3/4：顶部字标（取代 联名卡·品牌行五行）============
  {
    id: 'm_co3_top_card',
    group: '联名卡',
    name: '联名·顶部字标',
    desc: '宽白卡顶部居中品牌字标，底部衬线机型名与标签式参数行，展陈装裱的联名卡',
    category: 'frame',
    builtin: true,
    config: {
      ...WHITE,
      padding: 119,
      borderRatio: 216,
      infoLayer: {
        enabled: true,
        bindTarget: 'canvas',
        elements: [
          logoEl({ id: 'el-co3-tc-logo', x: 0, y: 62, baseWidth: 270, anchorX: 'center', anchorY: 'top' }),
          exifEl({
            id: 'el-co3-tc-model', x: 0, y: -159, anchorX: 'center', anchorY: 'bottom',
            template: '{model}', fontFamily: SERIF, fontSize: 30, fontWeight: 600,
            color: '#1A1A1A', align: 'center', letterSpacing: 3, opacity: 1,
          }),
          exifEl({
            id: 'el-co3-tc-params', x: 0, y: -86, anchorX: 'center', anchorY: 'bottom',
            template: 'FL {focal}   Aperture {aperture}   Shutter {shutter}   {iso}',
            fontFamily: SANS, fontSize: 20, fontWeight: 500,
            color: '#8C8C8C', align: 'center', letterSpacing: 1, opacity: 1,
          }),
        ],
      },
    },
  },

  // ============ 联名卡 4/5：横排锁定（取代 联名卡·品牌行六行）============
  {
    id: 'm_co3_lockup_row',
    group: '联名卡',
    name: '联名·横排锁定',
    desc: '白底带横向锁定：品牌字标、竖线与机型参数并列，右端日期坐标，一行的联名条',
    category: 'frame',
    builtin: true,
    config: {
      ...WHITE,
      padding: 0,
      borderRatio: 203,
      infoLayer: {
        enabled: true,
        bindTarget: 'canvas',
        elements: [
          logoEl({ id: 'el-co3-lr-logo', x: -552, y: -101, baseWidth: 216, anchorX: 'center', anchorY: 'bottom' }),
          dividerEl({ id: 'el-co3-lr-vline', x: -425, y: -101, width: 103, thickness: 1, color: '#D5D5D5', rotate: 90 }),
          exifEl({
            id: 'el-co3-lr-model', x: -368, y: -127, anchorX: 'left', anchorY: 'bottom',
            template: '{model}', fontFamily: SANS, fontSize: 27, fontWeight: 600,
            color: '#1A1A1A', align: 'left', letterSpacing: 1, opacity: 1,
          }),
          exifEl({
            id: 'el-co3-lr-params', x: -368, y: -67, anchorX: 'left', anchorY: 'bottom',
            template: PARAMS_LINE, fontFamily: SANS, fontSize: 20, fontWeight: 500,
            color: '#8C8C8C', align: 'left', letterSpacing: 3, opacity: 1,
          }),
          exifEl({
            id: 'el-co3-lr-date', x: -74, y: -127, anchorX: 'right', anchorY: 'bottom',
            template: '{date}', fontFamily: SANS, fontSize: 19, fontWeight: 400,
            color: '#8C8C8C', align: 'right', letterSpacing: 3, opacity: 1,
          }),
          exifEl({
            id: 'el-co3-lr-gps', x: -74, y: -67, anchorX: 'right', anchorY: 'bottom',
            template: '{gps}', fontFamily: SANS, fontSize: 18, fontWeight: 400,
            color: '#8C8C8C', align: 'right', letterSpacing: 1, opacity: 0.9,
          }),
        ],
      },
    },
  },

  // ============ 大师水印 1/3：鎏金题字（取代 大师水印·居中七行）============
  {
    id: 'm_mw3_engraved',
    group: '大师水印',
    name: '大师·鎏金题字',
    desc: '深炭底带上鎏金衬线题字与字距副题，细金线与日期收尾，铜牌铭文的静气',
    category: 'frame',
    builtin: true,
    config: {
      bgMode: 'solid',
      bgColor: '#201D19',
      borderColor: '#201D19',
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
      fontFamily: SERIF,
      fontSize: 24,
      textWeight: 500,
      textOpacity: 1,
      vignette: 0,
      grain: 0,
      showWatermark: false,
      deviceMockup: 'none',
      padding: 0,
      borderRatio: 311,
      infoLayer: {
        enabled: true,
        bindTarget: 'canvas',
        elements: [
          textEl({
            id: 'el-mw3-en-title', x: 0, y: -202, anchorX: 'center', anchorY: 'bottom',
            text: 'LIGHT & TIME', fontFamily: SERIF, fontSize: 30, fontWeight: 600,
            color: '#C9A96A', align: 'center', letterSpacing: 11, opacity: 1,
          }),
          textEl({
            id: 'el-mw3-en-caps', x: 0, y: -140, anchorX: 'center', anchorY: 'bottom',
            text: 'MASTER COLLECTION', fontFamily: SANS, fontSize: 16, fontWeight: 500,
            color: '#8F8574', align: 'center', letterSpacing: 8, opacity: 1,
          }),
          dividerEl({ id: 'el-mw3-en-rule', x: 0, y: -97, width: 76, thickness: 1, color: '#6B5F4A' }),
          exifEl({
            id: 'el-mw3-en-date', x: 0, y: -49, anchorX: 'center', anchorY: 'bottom',
            template: '{date}', fontFamily: SERIF, fontSize: 20, fontWeight: 400,
            color: '#A99E8C', align: 'center', letterSpacing: 4, opacity: 1,
          }),
        ],
      },
    },
  },

  // ============ 大师水印 2/3：纸面宣言（取代 大师水印·衬线五行）============
  {
    id: 'm_mw3_paper_statement',
    group: '大师水印',
    name: '大师·纸面宣言',
    desc: '米纸色底带衬线机型名与宽字距版别小字，下衬灰字参数，画册扉页的宣言',
    category: 'frame',
    builtin: true,
    config: {
      bgMode: 'solid',
      bgColor: '#F6F2EA',
      borderColor: '#F6F2EA',
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
      fontFamily: SERIF,
      fontSize: 24,
      textWeight: 500,
      textOpacity: 1,
      vignette: 0,
      grain: 0,
      showWatermark: false,
      deviceMockup: 'none',
      padding: 0,
      borderRatio: 284,
      infoLayer: {
        enabled: true,
        bindTarget: 'canvas',
        elements: [
          exifEl({
            id: 'el-mw3-ps-model', x: 0, y: -189, anchorX: 'center', anchorY: 'bottom',
            template: '{model}', fontFamily: SERIF, fontSize: 26, fontWeight: 500,
            color: '#3A352C', align: 'center', letterSpacing: 4, opacity: 1,
          }),
          textEl({
            id: 'el-mw3-ps-caps', x: 0, y: -130, anchorX: 'center', anchorY: 'bottom',
            text: 'FINE PRINT EDITION', fontFamily: SANS, fontSize: 16, fontWeight: 500,
            color: '#97907E', align: 'center', letterSpacing: 8, opacity: 1,
          }),
          exifEl({
            id: 'el-mw3-ps-params', x: 0, y: -65, anchorX: 'center', anchorY: 'bottom',
            template: PARAMS_LINE, fontFamily: SANS, fontSize: 20, fontWeight: 500,
            color: '#97907E', align: 'center', letterSpacing: 3, opacity: 1,
          }),
        ],
      },
    },
  },

  // ============ 大师水印 3/3：玄黑铭文（取代 大师水印·白海报）============
  {
    id: 'm_mw3_glossy_black',
    group: '大师水印',
    name: '大师·玄黑铭文',
    desc: '玄黑底带衬线机型名与金色细线，版别小字与等宽参数，展厅铭文的郑重',
    category: 'frame',
    builtin: true,
    config: {
      bgMode: 'solid',
      bgColor: '#111111',
      borderColor: '#111111',
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
      fontFamily: SERIF,
      fontSize: 24,
      textWeight: 500,
      textOpacity: 1,
      vignette: 0,
      grain: 0,
      showWatermark: false,
      deviceMockup: 'none',
      padding: 0,
      borderRatio: 324,
      infoLayer: {
        enabled: true,
        bindTarget: 'canvas',
        elements: [
          exifEl({
            id: 'el-mw3-gb-model', x: 0, y: -216, anchorX: 'center', anchorY: 'bottom',
            template: '{model}', fontFamily: SERIF, fontSize: 28, fontWeight: 500,
            color: '#F2F0EA', align: 'center', letterSpacing: 4, opacity: 1,
          }),
          dividerEl({ id: 'el-mw3-gb-rule', x: 0, y: -157, width: 97, thickness: 1, color: '#C9A96A' }),
          textEl({
            id: 'el-mw3-gb-caps', x: 0, y: -113, anchorX: 'center', anchorY: 'bottom',
            text: 'COLLECTED WORKS', fontFamily: SANS, fontSize: 16, fontWeight: 500,
            color: '#8F8574', align: 'center', letterSpacing: 8, opacity: 1,
          }),
          exifEl({
            id: 'el-mw3-gb-params', x: 0, y: -54, anchorX: 'center', anchorY: 'bottom',
            template: PARAMS_LINE, fontFamily: MONO, fontSize: 20, fontWeight: 500,
            color: '#B9B3A6', align: 'center', letterSpacing: 3, opacity: 1,
          }),
        ],
      },
    },
  },

  // ============ 机身壳重做 1/2：带下铭牌三行（同 id 取代 机身壳·带下八行）============
  {
    id: 'm_cam_shell_port8',
    group: '联名卡',
    name: '机身壳·带下铭牌',
    desc: '银机身壳配白底厚带，带内居中三行：机型、参数与镜头日期，干净的铭牌收尾',
    category: 'frame',
    builtin: true,
    config: {
      ...WHITE,
      padding: 46,
      borderRatio: 277,
      deviceMockup: 'camera-silver',
      infoLayer: {
        enabled: true,
        bindTarget: 'canvas',
        elements: [
          exifEl({
            id: 'el-shell-p8-model', x: 0, y: -224, anchorX: 'center', anchorY: 'bottom',
            template: '{model}', fontFamily: SANS, fontSize: 32, fontWeight: 600,
            color: '#1A1A1A', align: 'center', letterSpacing: 1, opacity: 1,
          }),
          exifEl({
            id: 'el-shell-p8-params', x: 0, y: -157, anchorX: 'center', anchorY: 'bottom',
            template: PARAMS_LINE, fontFamily: SANS, fontSize: 22, fontWeight: 500,
            color: '#8C8C8C', align: 'center', letterSpacing: 3, opacity: 1,
          }),
          exifEl({
            id: 'el-shell-p8-lens', x: 0, y: -103, anchorX: 'center', anchorY: 'bottom',
            template: '{lens}', fontFamily: SANS, fontSize: 19, fontWeight: 400,
            color: '#8C8C8C', align: 'center', letterSpacing: 1, opacity: 1,
          }),
          exifEl({
            id: 'el-shell-p8-date', x: 0, y: -59, anchorX: 'center', anchorY: 'bottom',
            template: '{date}', fontFamily: SANS, fontSize: 19, fontWeight: 400,
            color: '#8C8C8C', align: 'center', letterSpacing: 3, opacity: 1,
          }),
        ],
      },
    },
  },
]
