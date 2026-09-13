// 模板系统：内置预设 + 用户自定义模板（可导出/导入 JSON，支持多模板打包 .json 模板包）。
// 模板仅保存 FrameConfig 装饰参数（不含 photoSrc、照片变换与位置，避免污染用户主图）。
// 内置模板 40 套（2026-09-12 模板库扩充），按设计语言分 9 组（group 字段，弹窗分类 chips 过滤）：
// 前 10 套复刻自用户样例与「水印审美」样张（白框参数卡 / 圆角悬浮 / 极简装裱 / 居中机型 /
// 全幅铭牌条 / 工程测绘 / 胶片暗房 / 轻量悬浮 / 复古 CCD / 杂志编辑）；
// 扩充批 = 联名卡（card 布局）/ 经典黑白对仗 / 暗调影廊 / 胶片复古（颗粒+暗角）/
// 社交尺寸（画幅比例+画板圆角）/ 极简轻量（无信息纯边框）/ 水印署名 / 排版变体 /
// 创意排版（infoLayer 自由元素：右缘竖排参数、取景器十字、海报字幕块）/
// 引擎新能力示范（vertical 竖排布局、overlayAnchor 顶部锚点）。
// 画廊签名款（手写签名 + 数字/单位双行四栏参数）已由 m_vertical_leica / m_credit_block 近似落地。
// 列表缩略图由 core/templateThumb.ts 按 config 程序化生成，与成片几何一致。
import { reactive } from 'vue'
import type { FrameConfig } from '../core/types'
import { defaultFrameConfig } from '../core/types'
import { hexLuminance } from '../core/colorUtils'
import { useFrameConfig } from './useFrameConfig'
import { backfillInfoFromRaw, isInfoMissing, INFO_PLACEHOLDER, parseDisplayDate, formatDate } from './useExif'

const STORAGE_KEY = 'frame-templates'
const RECENT_KEY = 'frame-template-recent'
/** 最近使用记录容量：侧栏「最近使用」视图展示条数上限 */
const RECENT_LIMIT = 8

// 最近使用（模块级，跨弹窗打开次数持久）：recordRecentUsage 写入，recentIds 供侧栏过滤
const recentIds = reactive<string[]>(loadRecent())

function loadRecent(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : null
    if (Array.isArray(parsed)) {
      return parsed.filter((x): x is string => typeof x === 'string').slice(0, RECENT_LIMIT)
    }
  } catch {
    /* ignore */
  }
  return []
}

/** 记录一次模板应用（置顶去重，超限截断）：在弹窗单张应用与批量应用时调用 */
export function recordRecentUsage(id: string): void {
  const i = recentIds.indexOf(id)
  if (i >= 0) recentIds.splice(i, 1)
  recentIds.unshift(id)
  if (recentIds.length > RECENT_LIMIT) recentIds.length = RECENT_LIMIT
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify([...recentIds]))
  } catch {
    /* ignore */
  }
}

// 'background' 类别仅为兼容旧的自定义模板数据保留，已无独立 UI 入口
export type TemplateCategory = 'frame' | 'background' | 'all'

export interface FrameTemplate {
  id: string
  name: string
  category: TemplateCategory
  /** 预设配置（不含 photoSrc） */
  config: Partial<FrameConfig>
  builtin?: boolean
  /** 一句话说明（模板选择弹窗右侧展示）；自定义模板缺省 */
  desc?: string
  /** 模板库分组标签（弹窗分类 chips 过滤用）：经典 / 极简轻量 / 杂志编辑 / 胶片复古 / 暗调影廊 / 联名卡 / 社交尺寸 / 水印署名 / 创意排版 */
  group?: string
}

// 内置预设：与两张用户样例逐像素对齐（Desktop/相框样式，2026-08-28 实测），
// 见《相框风格分析与模板更新.md》；选择模板后右栏参数随之更新，用户可继续在右栏微调。
const BUILTIN: FrameTemplate[] = [
  {
    id: 'm_duo_card',
    name: '白框参数卡',
    desc: '经典白底等宽边框 + 左侧机型/右侧参数排布',
    category: 'frame',
    builtin: true,
    // 样例1：白底等宽边 26 + 底部加宽 66；INFO 左=镜头(20粗)+机型(17灰) / 中=Logo / 右=参数(20粗)+日期(17灰)，
    // 右栏右缘对齐照片右缘（内缩 20），竖线浅灰、Logo 右缘贴竖线；几何常量见 core/infoLayout.ts
    config: {
      bgMode: 'solid',
      bgColor: '#ffffff',
      borderColor: '#ffffff',
      padding: 27,
      // 下边留白由边框负责（borderRatio），背景纯色不下延（bgBottomRatio=0），
      // 避免「背景纯色下边」与「边框下边」两层职责重叠。
      borderRatio: 69,
      photoRadius: 0,
      borderRadius: 0,
      scale: 100,
      shadow: 0.12,
      frameRatio: null,
      infoLayout: 'duo',
      overlayAlign: 'center',
      overlayBottom: 18,
      showLogo: true,
      logoSize: 20,
      logoOpacity: 1,
      showCameraModel: true,
      // 样例实测机型行为 17px/#777 灰细小字；直接复刻后在深色区域几乎看不清，
      // 故微调为 18px / 0.75 —— 仍比参数行小且淡，但能看清
      // （日期样式已与机型解耦：这里显式指定日期样式，保持原复刻观感）
      cameraModelSize: 18,
      cameraModelWeight: 400,
      cameraModelOpacity: 0.75,
      dateFontSize: 18,
      dateTextWeight: 400,
      dateTextOpacity: 0.75,
      showExif: true,
      showLens: true,
      showDate: true,
      dateFormat: 'dash',
      fontSize: 20,
      textWeight: 700,
      textOpacity: 1,
    },
  },
  {
    id: 'm_float_round',
    name: '圆角悬浮·模糊延展',
    desc: '圆角悬浮照片 + 背景模糊向外延展',
    category: 'frame',
    builtin: true,
    // 样例2：照片大圆角+阴影悬浮，四周原图模糊延展（四边 100 / 底部 190）；
    // INFO 悬浮居中双行：行1 = Logo(白,高20)+机型(20) 内联、行2 = 参数(18)，底边距 29
    config: {
      bgMode: 'blur',
      blur: 60,
      bgExpand: 100,
      bgBottomRatio: 90,
      padding: 0,
      borderRatio: 0,
      photoRadius: 35,
      shadow: 0.45,
      scale: 100,
      frameRatio: null,
      infoLayout: 'inline',
      overlayAlign: 'center',
      overlayBottom: 29,
      showLogo: true,
      logoSize: 20,
      logoOpacity: 1,
      logoColor: '#ffffff',
      showCameraModel: true,
      cameraModelSize: 20,
      cameraModelWeight: 400,
      cameraModelOpacity: 1,
      showExif: true,
      showLens: false,
      showDate: false,
      fontSize: 18,
      textWeight: 400,
      textOpacity: 1,
    },
  },
  {
    id: 'm_matte_serif',
    name: '白卡装裱·衬线字标',
    desc: '白卡装裱 + 衬线字标 INFO 排版',
    category: 'frame',
    builtin: true,
    // 样张「HASSELBLAD」：大幅白卡纸装裱（四边留白 22 / 底部 152），仅底部一行斜体衬线字，
    // 克制、高级。机型行用 Didot 斜体呈现"字标感"（随照片 EXIF 型号）；classic 布局
    // 只为显示行分配位置，overlayBottom 60 让单行机型落在底部留白的视觉中点。
    config: {
      bgMode: 'solid',
      bgColor: '#ffffff',
      borderColor: '#ffffff',
      padding: 22,
      borderRatio: 130,
      photoRadius: 0,
      borderRadius: 0,
      scale: 100,
      shadow: 0,
      frameRatio: null,
      infoLayout: 'classic',
      overlayAlign: 'center',
      overlayBottom: 60,
      showLogo: false,
      showCameraModel: true,
      cameraModelFont: "Didot, 'Bodoni MT', 'Times New Roman', serif",
      cameraModelSize: 26,
      cameraModelWeight: 600,
      cameraModelItalic: true,
      showExif: false,
      showLens: false,
      showDate: false,
      fontFamily: "'Helvetica Neue', Arial, sans-serif",
      fontSize: 15,
      textWeight: 400,
      textOpacity: 0.6,
    },
  },
  {
    id: 'm_center_params',
    name: '白底居中·机型参数',
    desc: '白底居中布局 + 机型参数居中排布',
    category: 'frame',
    builtin: true,
    // 样张「XIAOMI 15 | LEICA」/「OPPO Find X8 Ultra」：白底加宽下边带，居中两行——
    // 上行机型（黑、粗）、下行参数（灰、细），无 Logo 不抢戏，官方水印的通用形制。
    config: {
      bgMode: 'solid',
      bgColor: '#ffffff',
      borderColor: '#ffffff',
      padding: 27,
      borderRatio: 159,
      photoRadius: 0,
      borderRadius: 0,
      scale: 100,
      shadow: 0,
      frameRatio: null,
      infoLayout: 'classic',
      overlayAlign: 'center',
      overlayBottom: 85,
      showLogo: false,
      showCameraModel: true,
      cameraModelSize: 24,
      cameraModelWeight: 700,
      showExif: true,
      showLens: false,
      showDate: false,
      fontSize: 18,
      textWeight: 400,
      textOpacity: 0.7,
    },
  },
  {
    id: 'm_strip_plate',
    name: '全幅白条·铭牌',
    desc: '全幅白条 + 底部铭牌式信息栏',
    category: 'frame',
    builtin: true,
    // 样张「iPhone 16 Pro」：照片全幅铺满，仅在底部压一条窄白带（118），
    // 左机型 / 中 Logo / 右日期三段式，像机身铭牌。duo 布局右缘自动对齐照片右缘。
    config: {
      bgMode: 'solid',
      bgColor: '#ffffff',
      borderColor: '#ffffff',
      padding: 0,
      borderRatio: 118,
      photoRadius: 0,
      borderRadius: 0,
      scale: 100,
      shadow: 0,
      frameRatio: null,
      infoLayout: 'duo',
      overlayAlign: 'center',
      overlayBottom: 44,
      showLogo: true,
      logoSize: 22,
      logoOpacity: 1,
      logoColor: '#1a1a1a',
      showCameraModel: true,
      cameraModelSize: 26,
      cameraModelWeight: 500,
      dateFontSize: 26,
      dateTextWeight: 500,
      showExif: false,
      showLens: false,
      showDate: true,
      dateFormat: 'date',
      fontSize: 18,
      textWeight: 400,
      textOpacity: 1,
    },
  },
  {
    id: 'm_tech_silver',
    name: '银灰测绘·等宽参数',
    desc: '银灰测绘风格 + 等宽参数行',
    category: 'frame',
    builtin: true,
    // 样张「XIAOMI 14 | LEICA」：银灰底色 + 等宽字体的数据美学；信息分居下边两角——
    // 左镜头+机型、右参数+日期（原样张右下为 GPS 坐标，引擎暂无 GPS 字段，以日期替代；
    // 左上角品牌标同样超出布局引擎能力，未复刻）。
    config: {
      bgMode: 'solid',
      bgColor: '#C9C5CD',
      borderColor: '#C9C5CD',
      padding: 77,
      borderRatio: 143,
      photoRadius: 0,
      borderRadius: 0,
      scale: 100,
      shadow: 0,
      frameRatio: null,
      infoLayout: 'duo',
      overlayAlign: 'center',
      overlayBottom: 118,
      showLogo: false,
      showCameraModel: true,
      cameraModelFont: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
      cameraModelSize: 22,
      cameraModelWeight: 600,
      dateFontSize: 22,
      dateTextWeight: 600,
      dateTextOpacity: 1,
      showExif: true,
      showLens: true,
      showDate: true,
      dateFormat: 'dash',
      fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
      fontSize: 20,
      textWeight: 400,
      textOpacity: 0.8,
    },
  },
  {
    id: 'm_film_noir',
    name: '胶片暗房·黑框',
    desc: '胶片暗房 + 深色底黑框展示',
    category: 'frame',
    builtin: true,
    // 样张「XIAOMI 13 PRO | LEICA」：纯黑边框营造暗房出片感，左下白色机型、右下浅灰参数；
    // 原样张照片四周的胶片毛边（不规则白边）超出照片层渲染能力，以直边照片近似。
    config: {
      bgMode: 'solid',
      bgColor: '#000000',
      borderColor: '#000000',
      padding: 60,
      borderRatio: 126,
      photoRadius: 0,
      borderRadius: 0,
      scale: 100,
      shadow: 0,
      frameRatio: null,
      infoLayout: 'duo',
      overlayAlign: 'center',
      overlayBottom: 66,
      showLogo: false,
      showCameraModel: true,
      cameraModelSize: 24,
      cameraModelWeight: 700,
      showExif: true,
      showLens: false,
      showDate: false,
      fontSize: 20,
      textWeight: 400,
      textOpacity: 0.75,
    },
  },
  {
    id: 'm_float_badge',
    name: '轻量悬浮·型号水印',
    desc: '轻量悬浮 + 型号水印式标注',
    category: 'frame',
    builtin: true,
    // 样张「DJI OSMO POCKET 4P」：不做画框，照片全幅，底部中央一行 Logo+型号半透明白字，
    // 不干扰画面。bgMode 用 blur(0) 使悬浮文字获得与 inline 悬浮款一致的可读性投影。
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
      infoLayout: 'inline',
      overlayAlign: 'center',
      overlayBottom: 22,
      showLogo: true,
      logoSize: 22,
      logoOpacity: 0.92,
      logoColor: '#ffffff',
      showCameraModel: true,
      cameraModelSize: 22,
      cameraModelWeight: 500,
      cameraModelOpacity: 0.92,
      showExif: false,
      showLens: false,
      showDate: false,
      fontSize: 18,
      textWeight: 400,
      textOpacity: 1,
    },
  },
  {
    id: 'm_ccd_stamp',
    name: '复古CCD·日期戳',
    desc: '复古 CCD + 日期戳点缀',
    category: 'frame',
    builtin: true,
    // 样张「2008/10/04」：无边框全幅照片，右下角一枚等宽粗体橙色数字日期，模拟 2000 年代
    // CCD 相机的机内日期打印。等宽字体由全局字体下发；右下角 = classic 布局右对齐
    // （overlayAlign right，行宽由引擎实测，换日期格式也不会出界）；橙色为 CCD 日期戳标志性配色。
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
      infoLayout: 'classic',
      overlayAlign: 'right',
      overlayBottom: 46,
      showLogo: false,
      showCameraModel: false,
      showExif: false,
      showLens: false,
      showDate: true,
      dateFormat: 'date',
      fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
      fontSize: 30,
      textWeight: 700,
      textOpacity: 1,
      dateTextColor: '#FFB43B',
    },
  },
  {
    id: 'm_magazine_edit',
    name: '杂志编辑·标题色卡',
    desc: '杂志双栏 + 标题与取色色卡',
    category: 'frame',
    builtin: true,
    // 样张重构版：白框非对称杂志排版——顶部衬线斜体刊头标题（Didot 系，与原参考样张的
    // 无衬线粗体拉开区分度）+ "PHOTOGRAPHED IN : 日期" 副标题，底部左侧从照片取色的五格
    // 色卡、右侧大号机型 + 灰色参数。对称大留白 padding 120 容纳标题区，下边加宽 71 放
    // 色卡与信息块。标题文本可自定义（INFO 面板），色卡随照片换色。
    config: {
      bgMode: 'solid',
      bgColor: '#ffffff',
      borderColor: '#ffffff',
      padding: 120,
      borderRatio: 71,
      photoRadius: 0,
      borderRadius: 0,
      scale: 100,
      shadow: 0,
      frameRatio: null,
      infoLayout: 'magazine',
      overlayAlign: 'center',
      overlayBottom: 40,
      infoTitle: 'Fragments of Light',
      showPalette: true,
      showLogo: false,
      showCameraModel: true,
      cameraModelSize: 30,
      cameraModelWeight: 600,
      showExif: true,
      showLens: false,
      showDate: true,
      dateFormat: 'en',
      fontSize: 17,
      textWeight: 500,
      textOpacity: 1,
    },
  },
  // ========================================================================
  // 模板库扩充（2026-09-12，三批：纯参数组合 / infoLayer 自由元素 / 引擎新能力）。
  // 系列划分见 BUILTIN_GROUPS；效果字段（vignette/grain/watermark）在不用时显式归零，
  // 避免应用模板后残留上一套的颗粒/暗角/水印。
  // ========================================================================

  // ===== 联名卡系列（card 手机白底水印卡，对标小米/徕卡官方水印排版）=====
  {
    id: 'm_card_white',
    name: '白卡联名·水印卡',
    desc: '照片上悬浮白卡：左机型+日期 / 右参数+镜头，手机品牌带官方配色联名标块',
    group: '联名卡',
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
      cameraModelSize: 20,
      cameraModelWeight: 500,
      showExif: true,
      showLens: true,
      showDate: true,
      cardShowDate: true,
      fontSize: 16,
      textWeight: 500,
      textOpacity: 1,
      vignette: 0,
      grain: 0,
      showWatermark: false,
    },
  },
  {
    id: 'm_card_black',
    name: '黑卡联名·夜色',
    desc: '黑底浅字水印卡，夜间街拍更有质感；联名标块随手机品牌官方配色',
    group: '联名卡',
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
      cameraModelSize: 20,
      cameraModelWeight: 500,
      showExif: true,
      showLens: true,
      showDate: true,
      cardShowDate: true,
      fontSize: 16,
      textWeight: 500,
      textOpacity: 1,
      vignette: 0,
      grain: 0,
      showWatermark: false,
    },
  },
  {
    id: 'm_card_gold',
    name: '黑卡金标·联名',
    desc: '黑卡 + 金色联名标块（对手机品牌生效），发布页仪式感款式',
    group: '联名卡',
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
      cardBadgeBg: '#C9A96A',
      cardBadgeFg: '#1A1A1A',
      showLogo: false,
      showCameraModel: true,
      cameraModelSize: 20,
      cameraModelWeight: 500,
      showExif: true,
      showLens: true,
      showDate: true,
      cardShowDate: true,
      fontSize: 16,
      textWeight: 500,
      textOpacity: 1,
      vignette: 0,
      grain: 0,
      showWatermark: false,
    },
  },
  {
    id: 'm_card_min',
    name: '白卡极简·无日期',
    desc: '白卡只留机型与参数，去掉日期与镜头行，信息过载轻量版',
    group: '联名卡',
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
      cameraModelSize: 20,
      cameraModelWeight: 500,
      showExif: true,
      showLens: false,
      showDate: false,
      cardShowDate: false,
      fontSize: 16,
      textWeight: 500,
      textOpacity: 1,
      vignette: 0,
      grain: 0,
      showWatermark: false,
    },
  },

  // ===== 经典黑白对仗补全（现有白框款的纯黑镜像，Logo 随底色自动反色）=====
  {
    id: 'm_black_duo',
    name: '黑框参数卡',
    desc: '「白框参数卡」的纯黑镜像：双栏参数 + 浅灰分隔线，暗调影调照片首选',
    group: '经典',
    category: 'frame',
    builtin: true,
    config: {
      bgMode: 'solid',
      bgColor: '#0A0A0A',
      borderColor: '#0A0A0A',
      padding: 27,
      borderRatio: 69,
      photoRadius: 0,
      borderRadius: 0,
      scale: 100,
      shadow: 0.12,
      frameRatio: null,
      infoLayout: 'duo',
      overlayAlign: 'center',
      overlayBottom: 18,
      showLogo: true,
      logoSize: 20,
      logoOpacity: 1,
      showCameraModel: true,
      cameraModelSize: 18,
      cameraModelWeight: 400,
      cameraModelOpacity: 0.75,
      dateFontSize: 18,
      dateTextWeight: 400,
      dateTextOpacity: 0.75,
      showExif: true,
      showLens: true,
      showDate: true,
      dateFormat: 'dash',
      fontSize: 20,
      textWeight: 700,
      textOpacity: 1,
      vignette: 0,
      grain: 0,
      showWatermark: false,
    },
  },
  {
    id: 'm_black_strip',
    name: '黑幅铭牌·黑条',
    desc: '「全幅白条·铭牌」的黑色版：底部黑带三段式（机型/Logo/日期）',
    group: '经典',
    category: 'frame',
    builtin: true,
    config: {
      bgMode: 'solid',
      bgColor: '#0A0A0A',
      borderColor: '#0A0A0A',
      padding: 0,
      borderRatio: 118,
      photoRadius: 0,
      borderRadius: 0,
      scale: 100,
      shadow: 0,
      frameRatio: null,
      infoLayout: 'duo',
      overlayAlign: 'center',
      overlayBottom: 44,
      showLogo: true,
      logoSize: 22,
      logoOpacity: 1,
      showCameraModel: true,
      cameraModelSize: 26,
      cameraModelWeight: 500,
      dateFontSize: 26,
      dateTextWeight: 500,
      showExif: false,
      showLens: false,
      showDate: true,
      dateFormat: 'date',
      fontSize: 18,
      textWeight: 400,
      textOpacity: 1,
      vignette: 0,
      grain: 0,
      showWatermark: false,
    },
  },

  // ===== 暗调影廊系列（美术馆暗色装裱）=====
  {
    id: 'm_obsidian_matte',
    name: '曜石装裱·白字标',
    desc: '「白卡装裱」的曜石黑版：大幅黑卡纸 + 底部一行斜体衬线机型',
    group: '暗调影廊',
    category: 'frame',
    builtin: true,
    config: {
      bgMode: 'solid',
      bgColor: '#101010',
      borderColor: '#101010',
      padding: 22,
      borderRatio: 130,
      photoRadius: 0,
      borderRadius: 0,
      scale: 100,
      shadow: 0,
      frameRatio: null,
      infoLayout: 'classic',
      overlayAlign: 'center',
      overlayBottom: 60,
      showLogo: false,
      showCameraModel: true,
      cameraModelFont: "Didot, 'Bodoni MT', 'Times New Roman', serif",
      cameraModelSize: 26,
      cameraModelWeight: 600,
      cameraModelItalic: true,
      cameraModelColor: '#E8E6E1',
      cameraModelOpacity: 0.92,
      showExif: false,
      showLens: false,
      showDate: false,
      fontFamily: "'Helvetica Neue', Arial, sans-serif",
      fontSize: 15,
      textWeight: 400,
      textOpacity: 0.6,
      vignette: 0,
      grain: 0,
      showWatermark: false,
    },
  },
  {
    id: 'm_graphite_frame',
    name: '石墨影廊·灰细框',
    desc: '石墨灰细边影廊：Logo + 机型 + 参数居中排布，中性底色不抢画面',
    group: '暗调影廊',
    category: 'frame',
    builtin: true,
    config: {
      bgMode: 'solid',
      bgColor: '#2B2D30',
      borderColor: '#2B2D30',
      padding: 40,
      borderRatio: 46,
      photoRadius: 0,
      borderRadius: 0,
      scale: 100,
      shadow: 0.3,
      frameRatio: null,
      infoLayout: 'classic',
      overlayAlign: 'center',
      overlayBottom: 30,
      showLogo: true,
      logoSize: 18,
      logoOpacity: 1,
      showCameraModel: true,
      cameraModelSize: 20,
      cameraModelWeight: 600,
      showExif: true,
      showLens: false,
      showDate: true,
      dateFormat: 'dash',
      dateFontSize: 16,
      dateTextWeight: 400,
      dateTextOpacity: 0.6,
      fontSize: 16,
      textWeight: 400,
      textOpacity: 0.75,
      vignette: 0,
      grain: 0,
      showWatermark: false,
    },
  },
  {
    id: 'm_data_deep',
    name: '数据档案·深空',
    desc: '「银灰测绘」的深空黑版：等宽字体数据美学，参数分居下边两角',
    group: '暗调影廊',
    category: 'frame',
    builtin: true,
    config: {
      bgMode: 'solid',
      bgColor: '#101214',
      borderColor: '#101214',
      padding: 60,
      borderRatio: 120,
      photoRadius: 0,
      borderRadius: 0,
      scale: 100,
      shadow: 0,
      frameRatio: null,
      infoLayout: 'duo',
      overlayAlign: 'center',
      overlayBottom: 54,
      showLogo: false,
      showCameraModel: true,
      cameraModelFont: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
      cameraModelSize: 22,
      cameraModelWeight: 600,
      dateFontSize: 18,
      dateTextWeight: 500,
      dateTextOpacity: 0.7,
      showExif: true,
      showLens: true,
      showDate: true,
      dateFormat: 'dash',
      fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
      fontSize: 18,
      textWeight: 400,
      textOpacity: 0.8,
      vignette: 0,
      grain: 0,
      showWatermark: false,
    },
  },
  {
    id: 'm_cinema_wide',
    name: '电影黑场·1:1画幅',
    desc: '方形黑场画幅：照片上下留黑（宽银幕既视感），等宽字体场记信息',
    group: '暗调影廊',
    category: 'frame',
    builtin: true,
    config: {
      bgMode: 'solid',
      bgColor: '#000000',
      borderColor: '#000000',
      padding: 0,
      borderRatio: 0,
      photoRadius: 0,
      borderRadius: 0,
      scale: 100,
      shadow: 0.3,
      frameRatio: 1,
      infoLayout: 'classic',
      overlayAlign: 'center',
      overlayBottom: 56,
      showLogo: false,
      showCameraModel: true,
      cameraModelFont: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
      cameraModelSize: 20,
      cameraModelWeight: 500,
      showExif: false,
      showLens: false,
      showDate: true,
      dateFormat: 'dash',
      dateFontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
      dateFontSize: 16,
      dateTextWeight: 400,
      dateTextOpacity: 0.7,
      fontSize: 16,
      textWeight: 400,
      textOpacity: 0.8,
      vignette: 0,
      grain: 0,
      showWatermark: false,
    },
  },

  // ===== 胶片复古系列（grain 颗粒 / vignette 暗角首次登场）=====
  {
    id: 'm_kodak_years',
    name: '柯达岁月·米白边',
    desc: '米白暖边 + 颗粒 + 轻暗角，橙色等宽日期戳致敬胶片年代',
    group: '胶片复古',
    category: 'frame',
    builtin: true,
    config: {
      bgMode: 'solid',
      bgColor: '#F3EAD3',
      borderColor: '#F3EAD3',
      padding: 26,
      borderRatio: 96,
      photoRadius: 0,
      borderRadius: 0,
      scale: 100,
      shadow: 0.18,
      frameRatio: null,
      infoLayout: 'classic',
      overlayAlign: 'center',
      overlayBottom: 40,
      showLogo: false,
      showCameraModel: true,
      cameraModelSize: 22,
      cameraModelWeight: 600,
      showExif: true,
      showLens: false,
      showDate: true,
      dateFormat: 'date',
      dateFontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
      dateFontSize: 18,
      dateTextWeight: 700,
      dateTextColor: '#C97B2D',
      exifFontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
      fontSize: 18,
      textWeight: 400,
      textOpacity: 0.8,
      vignette: 0.18,
      grain: 0.28,
      showWatermark: false,
    },
  },
  {
    id: 'm_polaroid',
    name: '宝丽来·拍立得',
    desc: '超宽下边白框模拟拍立得相纸，手写体日期写在相纸下缘',
    group: '胶片复古',
    category: 'frame',
    builtin: true,
    config: {
      bgMode: 'solid',
      bgColor: '#FFFFFF',
      borderColor: '#FFFFFF',
      padding: 16,
      borderRatio: 190,
      photoRadius: 0,
      borderRadius: 6,
      scale: 100,
      shadow: 0.3,
      frameRatio: null,
      infoLayout: 'classic',
      overlayAlign: 'center',
      // 日期行在 190 白带内垂直居中：行盒底边 = 画布底缘 - 83
      overlayBottom: 83,
      showLogo: false,
      showCameraModel: false,
      showExif: false,
      showLens: false,
      showDate: true,
      dateFormat: 'date',
      dateFontFamily: "'Segoe Script', 'Bradley Hand', 'Comic Sans MS', cursive",
      dateFontSize: 24,
      dateTextWeight: 400,
      dateTextOpacity: 0.8,
      dateTextColor: '#3A3A3A',
      fontFamily: "'Helvetica Neue', Arial, sans-serif",
      fontSize: 15,
      textWeight: 400,
      textOpacity: 0.6,
      vignette: 0.08,
      grain: 0.15,
      showWatermark: false,
    },
  },
  {
    id: 'm_darkroom_contact',
    name: '暗房印相·胶片编号',
    desc: '纯黑边 + 重颗粒暗角，照片上盖一枚「ROLL · FRAME」胶片编号戳',
    group: '胶片复古',
    category: 'frame',
    builtin: true,
    config: {
      bgMode: 'solid',
      bgColor: '#0A0A0A',
      borderColor: '#0A0A0A',
      padding: 46,
      borderRatio: 84,
      photoRadius: 0,
      borderRadius: 0,
      scale: 100,
      shadow: 0,
      frameRatio: null,
      infoLayout: 'classic',
      overlayAlign: 'center',
      overlayBottom: 34,
      showLogo: false,
      showCameraModel: false,
      showExif: true,
      showLens: false,
      showDate: true,
      dateFormat: 'date',
      fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
      dateFontSize: 16,
      dateTextWeight: 500,
      dateTextOpacity: 0.6,
      fontSize: 16,
      textWeight: 500,
      textOpacity: 0.85,
      vignette: 0.25,
      grain: 0.35,
      showWatermark: true,
      watermarkText: 'ROLL 03 · FRAME 12',
      watermarkTile: false,
      watermarkOpacity: 0.45,
      watermarkSize: 7,
      watermarkAngle: 0,
      watermarkAlign: 'right',
      watermarkBottom: 130,
    },
  },
  {
    id: 'm_ccd_flash',
    name: 'CCD夜闪·时刻戳',
    desc: '「复古CCD日期戳」加强版：暗角 + 颗粒模拟机内闪光灯，右下角精确到时分',
    group: '胶片复古',
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
      infoLayout: 'classic',
      overlayAlign: 'right',
      overlayBottom: 40,
      showLogo: false,
      showCameraModel: false,
      showExif: false,
      showLens: false,
      showDate: true,
      dateFormat: 'datetime',
      fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
      fontSize: 28,
      textWeight: 700,
      textOpacity: 1,
      dateTextColor: '#FFB43B',
      vignette: 0.35,
      grain: 0.22,
      showWatermark: false,
    },
  },

  // ===== 社交尺寸系列（frameRatio 画幅比例 + borderRadius 画板圆角首次登场）=====
  {
    id: 'm_square_white',
    name: '方形白框·1:1',
    desc: '1:1 方形画幅 + 白框，社交平台头像/九宫格发布尺寸',
    group: '社交尺寸',
    category: 'frame',
    builtin: true,
    config: {
      bgMode: 'solid',
      bgColor: '#ffffff',
      borderColor: '#ffffff',
      padding: 30,
      borderRatio: 110,
      photoRadius: 0,
      borderRadius: 0,
      scale: 100,
      shadow: 0.15,
      frameRatio: 1,
      infoLayout: 'classic',
      overlayAlign: 'center',
      overlayBottom: 40,
      showLogo: false,
      showCameraModel: true,
      cameraModelSize: 20,
      cameraModelWeight: 600,
      showExif: true,
      showLens: false,
      showDate: false,
      fontSize: 16,
      textWeight: 400,
      textOpacity: 0.7,
      vignette: 0,
      grain: 0,
      showWatermark: false,
    },
  },
  {
    id: 'm_story_portrait',
    name: '竖版故事·9:16',
    desc: '9:16 竖版画幅：横版照片悬浮于自身模糊延展上，直接适配短视频封面',
    group: '社交尺寸',
    category: 'frame',
    builtin: true,
    config: {
      bgMode: 'blur',
      blur: 40,
      padding: 0,
      borderRatio: 0,
      photoRadius: 18,
      borderRadius: 0,
      scale: 100,
      shadow: 0.4,
      frameRatio: 9 / 16,
      infoLayout: 'inline',
      overlayAlign: 'center',
      overlayBottom: 34,
      showLogo: false,
      showCameraModel: true,
      cameraModelSize: 20,
      cameraModelWeight: 500,
      showExif: true,
      showLens: false,
      showDate: false,
      fontSize: 16,
      textWeight: 400,
      textOpacity: 1,
      vignette: 0,
      grain: 0,
      showWatermark: false,
    },
  },
  {
    id: 'm_card_round',
    name: '圆角卡片·悬浮',
    desc: '画板与照片双圆角 + 立体阴影，App 卡片质感的现代白框',
    group: '社交尺寸',
    category: 'frame',
    builtin: true,
    config: {
      bgMode: 'solid',
      bgColor: '#ffffff',
      borderColor: '#ffffff',
      padding: 30,
      borderRatio: 30,
      photoRadius: 14,
      borderRadius: 36,
      scale: 100,
      shadow: 0.35,
      frameRatio: null,
      infoLayout: 'classic',
      overlayAlign: 'center',
      // 机型行（20px）在 30px 下边带内垂直居中：行盒底边 = 画布底缘 - 5
      overlayBottom: 5,
      showLogo: false,
      showCameraModel: true,
      cameraModelSize: 20,
      cameraModelWeight: 600,
      showExif: false,
      showLens: false,
      showDate: false,
      fontSize: 16,
      textWeight: 400,
      textOpacity: 0.7,
      vignette: 0,
      grain: 0,
      showWatermark: false,
    },
  },

  // ===== 轻量无信息系列（评论区高频诉求：纯边框不带任何参数）=====
  {
    id: 'm_pure_white',
    name: '纯白·无字装裱',
    desc: '纯白等宽边框，不带任何文字信息（Logo/参数/日期全关）',
    group: '极简轻量',
    category: 'frame',
    builtin: true,
    config: {
      bgMode: 'solid',
      bgColor: '#ffffff',
      borderColor: '#ffffff',
      padding: 44,
      borderRatio: 44,
      photoRadius: 0,
      borderRadius: 0,
      scale: 100,
      shadow: 0.12,
      frameRatio: null,
      infoLayout: 'classic',
      overlayAlign: 'center',
      overlayBottom: 20,
      showLogo: false,
      showCameraModel: false,
      showExif: false,
      showLens: false,
      showDate: false,
      vignette: 0,
      grain: 0,
      showWatermark: false,
    },
  },
  {
    id: 'm_pure_black',
    name: '纯黑·无字装裱',
    desc: '纯黑等宽边框，不带任何文字信息，暗房出片感',
    group: '极简轻量',
    category: 'frame',
    builtin: true,
    config: {
      bgMode: 'solid',
      bgColor: '#000000',
      borderColor: '#000000',
      padding: 44,
      borderRatio: 44,
      photoRadius: 0,
      borderRadius: 0,
      scale: 100,
      shadow: 0.15,
      frameRatio: null,
      infoLayout: 'classic',
      overlayAlign: 'center',
      overlayBottom: 20,
      showLogo: false,
      showCameraModel: false,
      showExif: false,
      showLens: false,
      showDate: false,
      vignette: 0,
      grain: 0,
      showWatermark: false,
    },
  },
  {
    id: 'm_cream_round',
    name: '奶白圆角·无字',
    desc: '奶白圆角画框 + 照片微圆角，相册页质感，不带任何文字信息',
    group: '极简轻量',
    category: 'frame',
    builtin: true,
    config: {
      bgMode: 'solid',
      bgColor: '#F7F2E9',
      borderColor: '#F7F2E9',
      padding: 36,
      borderRatio: 36,
      photoRadius: 8,
      borderRadius: 30,
      scale: 100,
      shadow: 0.2,
      frameRatio: null,
      infoLayout: 'classic',
      overlayAlign: 'center',
      overlayBottom: 20,
      showLogo: false,
      showCameraModel: false,
      showExif: false,
      showLens: false,
      showDate: false,
      vignette: 0,
      grain: 0,
      showWatermark: false,
    },
  },
  {
    id: 'm_poster_big',
    name: '大字海报·参数',
    desc: '只留一行放大加粗的参数文字，海报式排版焦点',
    group: '极简轻量',
    category: 'frame',
    builtin: true,
    config: {
      bgMode: 'solid',
      bgColor: '#ffffff',
      borderColor: '#ffffff',
      padding: 30,
      borderRatio: 110,
      photoRadius: 0,
      borderRadius: 0,
      scale: 100,
      shadow: 0,
      frameRatio: null,
      infoLayout: 'classic',
      overlayAlign: 'center',
      // 单行 34px 在 110 白带内垂直居中：行盒底边 = 画布底缘 - 38
      overlayBottom: 38,
      showLogo: false,
      showCameraModel: false,
      showExif: true,
      showLens: false,
      showDate: false,
      fontSize: 34,
      textWeight: 700,
      textOpacity: 1,
      vignette: 0,
      grain: 0,
      showWatermark: false,
    },
  },

  // ===== 水印署名系列（水印系统首次进入模板库）=====
  {
    id: 'm_watermark_tile',
    name: '平铺水印·署名',
    desc: '全幅照片平铺半透明署名水印（发图防盗），把 @YOURNAME 改成自己的 ID',
    group: '水印署名',
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
      infoLayout: 'classic',
      overlayAlign: 'center',
      overlayBottom: 20,
      showLogo: false,
      showCameraModel: false,
      showExif: false,
      showLens: false,
      showDate: false,
      vignette: 0,
      grain: 0,
      showWatermark: true,
      watermarkText: '@YOURNAME',
      watermarkTile: true,
      watermarkOpacity: 0.16,
      watermarkSize: 10,
      watermarkAngle: 30,
      watermarkAlign: 'center',
      watermarkBottom: 40,
    },
  },
  {
    id: 'm_watermark_corner',
    name: '角标署名·全幅',
    desc: '全幅照片 + 右下角一行署名水印与机型标注，最轻的存在感',
    group: '水印署名',
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
      infoLayout: 'classic',
      overlayAlign: 'right',
      overlayBottom: 76,
      showLogo: false,
      showCameraModel: true,
      cameraModelSize: 18,
      cameraModelWeight: 500,
      showExif: false,
      showLens: false,
      showDate: false,
      fontSize: 16,
      textWeight: 400,
      textOpacity: 1,
      vignette: 0,
      grain: 0,
      showWatermark: true,
      watermarkText: '@YOURNAME',
      watermarkTile: false,
      watermarkOpacity: 0.8,
      watermarkSize: 8,
      watermarkAngle: 0,
      watermarkAlign: 'right',
      watermarkBottom: 34,
    },
  },

  // ===== 排版变体系列（中英文日期 / 暗调刊头等字体与格式差异款）=====
  {
    id: 'm_zh_elegant',
    name: '中文雅集·宋体',
    desc: '宋体衬线 + 「2026年8月30日」中文日期，米白底雅致装裱',
    group: '杂志编辑',
    category: 'frame',
    builtin: true,
    config: {
      bgMode: 'solid',
      bgColor: '#F8F5EF',
      borderColor: '#F8F5EF',
      padding: 26,
      borderRatio: 100,
      photoRadius: 0,
      borderRadius: 0,
      scale: 100,
      shadow: 0,
      frameRatio: null,
      infoLayout: 'classic',
      overlayAlign: 'center',
      overlayBottom: 38,
      showLogo: false,
      showCameraModel: true,
      cameraModelFont: "'Songti SC', SimSun, 'Noto Serif SC', serif",
      cameraModelSize: 24,
      cameraModelWeight: 600,
      showExif: true,
      showLens: false,
      showDate: true,
      dateFormat: 'zh',
      fontFamily: "'Songti SC', SimSun, 'Noto Serif SC', serif",
      fontSize: 18,
      textWeight: 400,
      textOpacity: 0.75,
      vignette: 0,
      grain: 0,
      showWatermark: false,
    },
  },
  {
    id: 'm_masthead_dark',
    name: '暗调刊头·杂志黑',
    desc: '「杂志编辑」的暗色版：黑底衬线刊头 + 取色色卡，夜色专题页气质',
    group: '杂志编辑',
    category: 'frame',
    builtin: true,
    config: {
      bgMode: 'solid',
      bgColor: '#17181B',
      borderColor: '#17181B',
      padding: 110,
      borderRatio: 80,
      photoRadius: 0,
      borderRadius: 0,
      scale: 100,
      shadow: 0,
      frameRatio: null,
      infoLayout: 'magazine',
      overlayAlign: 'center',
      overlayBottom: 40,
      infoTitle: 'Midnight Frames',
      showPalette: true,
      showLogo: false,
      showCameraModel: true,
      cameraModelSize: 30,
      cameraModelWeight: 600,
      showExif: true,
      showLens: false,
      showDate: true,
      dateFormat: 'en',
      fontSize: 17,
      textWeight: 500,
      textOpacity: 1,
      vignette: 0,
      grain: 0,
      showWatermark: false,
    },
  },

  // ===== 创意排版（infoLayer 自由元素模板）=====
  // 坐标系：bindTarget='canvas' 时元素 (x,y) 相对画布中心，画布宽固定 1200（x 可精确贴缘），
  // 高随照片变化——因此元素只做「水平贴缘 / 垂直居中」两类锚定，保证任意照片不错位。
  {
    id: 'm_edge_vertical',
    name: '边缘竖排·参数列',
    desc: '参数列旋转 90° 贴照片右缘竖排（随 EXIF 自动填充），轻暗角压暗画面',
    group: '创意排版',
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
      infoLayout: 'classic',
      overlayAlign: 'center',
      overlayBottom: 20,
      showLogo: false,
      showCameraModel: false,
      showExif: false,
      showLens: false,
      showDate: false,
      vignette: 0.25,
      grain: 0,
      showWatermark: false,
      infoLayer: {
        enabled: true,
        bindTarget: 'canvas',
        elements: [
          {
            id: 'el-vparams',
            type: 'exif',
            enable: true,
            x: 546,
            y: 0,
            scale: 1,
            rotate: 90,
            zIndex: 1,
            exportable: true,
            opacity: 0.92,
            template: '{model}   {focal}  {aperture}  {shutter}  ISO{iso}',
            fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
            fontSize: 20,
            fontWeight: 500,
            color: '#ffffff',
            align: 'center',
            letterSpacing: 3,
            lineHeight: 1.2,
          },
        ],
      },
    },
  },
  {
    id: 'm_finder_cross',
    name: '取景器·中心十字',
    desc: '画面中心取景十字 + 机型/参数居中标注，模拟光学取景器界面',
    group: '创意排版',
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
      infoLayout: 'classic',
      overlayAlign: 'center',
      overlayBottom: 20,
      showLogo: false,
      showCameraModel: false,
      showExif: false,
      showLens: false,
      showDate: false,
      vignette: 0.3,
      grain: 0,
      showWatermark: false,
      infoLayer: {
        enabled: true,
        bindTarget: 'canvas',
        elements: [
          {
            id: 'el-cross-h',
            type: 'divider',
            enable: true,
            x: 0,
            y: 0,
            scale: 1,
            rotate: 0,
            zIndex: 1,
            exportable: true,
            opacity: 0.85,
            width: 64,
            thickness: 2,
            color: '#ffffff',
          },
          {
            id: 'el-cross-v',
            type: 'divider',
            enable: true,
            x: 0,
            y: 0,
            scale: 1,
            rotate: 90,
            zIndex: 1,
            exportable: true,
            opacity: 0.85,
            width: 64,
            thickness: 2,
            color: '#ffffff',
          },
          {
            id: 'el-finder-model',
            type: 'exif',
            enable: true,
            x: 0,
            y: -44,
            scale: 1,
            rotate: 0,
            zIndex: 2,
            exportable: true,
            opacity: 0.92,
            template: '{model}',
            fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
            fontSize: 18,
            fontWeight: 500,
            color: '#ffffff',
            align: 'center',
            letterSpacing: 5,
            lineHeight: 1.2,
          },
          {
            id: 'el-finder-params',
            type: 'exif',
            enable: true,
            x: 0,
            y: 40,
            scale: 1,
            rotate: 0,
            zIndex: 2,
            exportable: true,
            opacity: 0.85,
            template: '{focal}  {aperture}  ISO{iso}',
            fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
            fontSize: 15,
            fontWeight: 400,
            color: '#ffffff',
            align: 'center',
            letterSpacing: 2,
            lineHeight: 1.2,
          },
        ],
      },
    },
  },
  {
    id: 'm_credit_block',
    name: '海报字幕·居中款',
    desc: '照片正中压一排电影海报式字幕块（上下细线夹机型与参数），暗角聚焦',
    group: '创意排版',
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
      infoLayout: 'classic',
      overlayAlign: 'center',
      overlayBottom: 20,
      showLogo: false,
      showCameraModel: false,
      showExif: false,
      showLens: false,
      showDate: false,
      vignette: 0.35,
      grain: 0,
      showWatermark: false,
      infoLayer: {
        enabled: true,
        bindTarget: 'canvas',
        elements: [
          {
            id: 'el-credit-line-top',
            type: 'divider',
            enable: true,
            x: 0,
            y: -78,
            scale: 1,
            rotate: 0,
            zIndex: 1,
            exportable: true,
            opacity: 0.7,
            width: 110,
            thickness: 1.5,
            color: '#ffffff',
          },
          {
            id: 'el-credit-model',
            type: 'exif',
            enable: true,
            x: 0,
            y: -36,
            scale: 1,
            rotate: 0,
            zIndex: 2,
            exportable: true,
            opacity: 0.95,
            template: '{model}',
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
            fontSize: 24,
            fontWeight: 600,
            color: '#ffffff',
            align: 'center',
            letterSpacing: 8,
            lineHeight: 1.2,
          },
          {
            id: 'el-credit-params',
            type: 'exif',
            enable: true,
            x: 0,
            y: 18,
            scale: 1,
            rotate: 0,
            zIndex: 2,
            exportable: true,
            opacity: 0.8,
            template: '{focal} · {aperture} · ISO{iso}',
            fontFamily: "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace",
            fontSize: 14,
            fontWeight: 400,
            color: '#ffffff',
            align: 'center',
            letterSpacing: 3,
            lineHeight: 1.2,
          },
          {
            id: 'el-credit-line-bottom',
            type: 'divider',
            enable: true,
            x: 0,
            y: 66,
            scale: 1,
            rotate: 0,
            zIndex: 1,
            exportable: true,
            opacity: 0.7,
            width: 110,
            thickness: 1.5,
            color: '#ffffff',
          },
        ],
      },
    },
  },

  // ===== 引擎新能力示范（vertical 竖排布局 / overlayAnchor 顶部锚点）=====
  {
    id: 'm_vertical_leica',
    name: '竖排装裱·左缘题记',
    desc: '文字旋转 90° 沿照片左缘竖排（机型/参数/日期），画廊签名款版式',
    group: '创意排版',
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
      infoLayout: 'vertical',
      overlayAlign: 'center',
      overlayBottom: 30,
      showLogo: false,
      showCameraModel: true,
      cameraModelSize: 24,
      cameraModelWeight: 600,
      showExif: true,
      showLens: false,
      showDate: true,
      dateFormat: 'dash',
      dateFontSize: 16,
      dateTextWeight: 400,
      dateTextOpacity: 0.75,
      fontSize: 18,
      textWeight: 500,
      textOpacity: 1,
      vignette: 0,
      grain: 0,
      showWatermark: false,
    },
  },
  {
    id: 'm_masthead_top',
    name: '报头式·顶部题注',
    desc: '信息块落在顶边留白带内的报头式排版（机型+日期），四边等宽留白收底',
    group: '创意排版',
    category: 'frame',
    builtin: true,
    config: {
      bgMode: 'solid',
      bgColor: '#ffffff',
      borderColor: '#ffffff',
      padding: 90,
      borderRatio: 90,
      photoRadius: 0,
      borderRadius: 0,
      scale: 100,
      shadow: 0,
      frameRatio: null,
      infoLayout: 'classic',
      overlayAnchor: 'top',
      overlayAlign: 'center',
      // 信息块（22+16+16=54）在 90 顶边带内垂直居中：锚位 = 画布顶缘 + 18
      overlayBottom: 18,
      showLogo: false,
      showCameraModel: true,
      cameraModelSize: 22,
      cameraModelWeight: 600,
      showExif: false,
      showLens: false,
      showDate: true,
      dateFormat: 'dash',
      dateFontSize: 16,
      dateTextWeight: 400,
      dateTextOpacity: 0.6,
      fontSize: 16,
      textWeight: 400,
      textOpacity: 1,
      vignette: 0,
      grain: 0,
      showWatermark: false,
    },
  },

  // ========================================================================
  // FrameElf（边框水印精灵）样式学习批（2026-09-14）：
  // ① 多彩色卡——大面积极简彩色边框（莫兰迪色系）+ 取色色卡/极简深字标注；
  // ② 旅行杂志——白色竖卡 + 衬线刊头标题 + PHOTOGRAPHED IN 副标题；
  // ③ 画册署名——全幅照片 + 左/右下角小号署名（对标 Hasselblad 月亮款）。
  // 多彩系列底色均为浅中调（hexLuminance > 0.6），文字自动取深色，无需显式指定。
  // ========================================================================

  // ===== 多彩色卡系列 =====
  {
    id: 'm_colorwalk_yellow',
    name: '色卡·明黄',
    desc: '大面积极简明黄边框 + 照片自动取色色卡（学习 FrameElf ColorWalk，无 hex 标注）',
    group: '多彩色卡',
    category: 'frame',
    builtin: true,
    config: {
      bgMode: 'solid',
      bgColor: '#F2C94C',
      borderColor: '#F2C94C',
      padding: 100,
      borderRatio: 150,
      photoRadius: 0,
      borderRadius: 0,
      scale: 100,
      shadow: 0,
      frameRatio: 4 / 5,
      infoLayout: 'magazine',
      overlayAlign: 'center',
      overlayBottom: 40,
      infoTitle: 'COLOR WALK · 01',
      showPalette: true,
      showLogo: false,
      showCameraModel: true,
      cameraModelSize: 22,
      cameraModelWeight: 600,
      showExif: true,
      showLens: false,
      showDate: false,
      fontSize: 16,
      textWeight: 500,
      textOpacity: 1,
      vignette: 0,
      grain: 0,
      showWatermark: false,
    },
  },
  {
    id: 'm_colorwalk_sage',
    name: '色卡·抹茶',
    desc: '抹茶绿极简边框 + 取色色卡，植物/静物主题的清新画框',
    group: '多彩色卡',
    category: 'frame',
    builtin: true,
    config: {
      bgMode: 'solid',
      bgColor: '#B8C4AC',
      borderColor: '#B8C4AC',
      padding: 100,
      borderRatio: 150,
      photoRadius: 0,
      borderRadius: 0,
      scale: 100,
      shadow: 0,
      frameRatio: 4 / 5,
      infoLayout: 'magazine',
      overlayAlign: 'center',
      overlayBottom: 40,
      infoTitle: 'SAGE FIELD',
      showPalette: true,
      showLogo: false,
      showCameraModel: true,
      cameraModelSize: 22,
      cameraModelWeight: 600,
      showExif: true,
      showLens: false,
      showDate: false,
      fontSize: 16,
      textWeight: 500,
      textOpacity: 1,
      vignette: 0,
      grain: 0,
      showWatermark: false,
    },
  },
  {
    id: 'm_morandi_blue',
    name: '多彩·雾霾蓝',
    desc: '雾霾蓝大边框 + 底部极简标注，无边框存在的「融入式」彩色装裱',
    group: '多彩色卡',
    category: 'frame',
    builtin: true,
    config: {
      bgMode: 'solid',
      bgColor: '#8FA8B8',
      borderColor: '#8FA8B8',
      padding: 110,
      borderRatio: 70,
      photoRadius: 0,
      borderRadius: 0,
      scale: 100,
      shadow: 0,
      frameRatio: null,
      infoLayout: 'classic',
      overlayAlign: 'center',
      overlayBottom: 30,
      showLogo: false,
      showCameraModel: true,
      cameraModelSize: 18,
      cameraModelWeight: 500,
      showExif: false,
      showLens: false,
      showDate: true,
      dateFormat: 'dash',
      dateFontSize: 14,
      dateTextWeight: 400,
      dateTextOpacity: 0.7,
      fontSize: 14,
      textWeight: 400,
      textOpacity: 1,
      vignette: 0,
      grain: 0,
      showWatermark: false,
    },
  },
  {
    id: 'm_morandi_pink',
    name: '多彩·豆沙粉',
    desc: '豆沙粉大边框 + 底部极简标注，人像/花植主题柔感装裱',
    group: '多彩色卡',
    category: 'frame',
    builtin: true,
    config: {
      bgMode: 'solid',
      bgColor: '#C9A9A0',
      borderColor: '#C9A9A0',
      padding: 110,
      borderRatio: 70,
      photoRadius: 0,
      borderRadius: 0,
      scale: 100,
      shadow: 0,
      frameRatio: null,
      infoLayout: 'classic',
      overlayAlign: 'center',
      overlayBottom: 30,
      showLogo: false,
      showCameraModel: true,
      cameraModelSize: 18,
      cameraModelWeight: 500,
      showExif: false,
      showLens: false,
      showDate: true,
      dateFormat: 'dash',
      dateFontSize: 14,
      dateTextWeight: 400,
      dateTextOpacity: 0.7,
      fontSize: 14,
      textWeight: 400,
      textOpacity: 1,
      vignette: 0,
      grain: 0,
      showWatermark: false,
    },
  },
  {
    id: 'm_morandi_mauve',
    name: '多彩·灰紫',
    desc: '灰紫大边框 + 底部极简标注，街拍/建筑主题的高级灰调装裱',
    group: '多彩色卡',
    category: 'frame',
    builtin: true,
    config: {
      bgMode: 'solid',
      bgColor: '#A79E9C',
      borderColor: '#A79E9C',
      padding: 110,
      borderRatio: 70,
      photoRadius: 0,
      borderRadius: 0,
      scale: 100,
      shadow: 0,
      frameRatio: null,
      infoLayout: 'classic',
      overlayAlign: 'center',
      overlayBottom: 30,
      showLogo: false,
      showCameraModel: true,
      cameraModelSize: 18,
      cameraModelWeight: 500,
      showExif: false,
      showLens: false,
      showDate: true,
      dateFormat: 'dash',
      dateFontSize: 14,
      dateTextWeight: 400,
      dateTextOpacity: 0.7,
      fontSize: 14,
      textWeight: 400,
      textOpacity: 1,
      vignette: 0,
      grain: 0,
      showWatermark: false,
    },
  },

  // ===== 旅行杂志系列（{SUNSET} 白卡刊头款）=====
  {
    id: 'm_magazine_sunset',
    name: '旅行刊头·SUNSET',
    desc: '竖版白卡 + 衬线刊头标题 + 英文日期副标题（学习 FrameElf {SUNSET} 款）',
    group: '杂志编辑',
    category: 'frame',
    builtin: true,
    config: {
      bgMode: 'solid',
      bgColor: '#ffffff',
      borderColor: '#ffffff',
      padding: 110,
      borderRatio: 80,
      photoRadius: 0,
      borderRadius: 0,
      scale: 100,
      shadow: 0,
      frameRatio: 3 / 4,
      infoLayout: 'magazine',
      overlayAlign: 'center',
      overlayBottom: 40,
      infoTitle: '{ SUNSET }',
      showPalette: false,
      showLogo: false,
      showCameraModel: true,
      cameraModelSize: 24,
      cameraModelWeight: 600,
      showExif: true,
      showLens: false,
      showDate: true,
      dateFormat: 'en',
      fontSize: 15,
      textWeight: 500,
      textOpacity: 1,
      vignette: 0,
      grain: 0,
      showWatermark: false,
    },
  },
  {
    id: 'm_magazine_field',
    name: '旅行刊头·原野',
    desc: '白卡横幅刊头 + 取色色卡 + 英文杂志式日期，旅行日志气质',
    group: '杂志编辑',
    category: 'frame',
    builtin: true,
    config: {
      bgMode: 'solid',
      bgColor: '#FDFBF7',
      borderColor: '#FDFBF7',
      padding: 110,
      borderRatio: 80,
      photoRadius: 0,
      borderRadius: 0,
      scale: 100,
      shadow: 0,
      frameRatio: null,
      infoLayout: 'magazine',
      overlayAlign: 'center',
      overlayBottom: 40,
      infoTitle: 'Into the Field',
      showPalette: true,
      showLogo: false,
      showCameraModel: true,
      cameraModelSize: 24,
      cameraModelWeight: 600,
      showExif: true,
      showLens: false,
      showDate: true,
      dateFormat: 'en',
      fontSize: 15,
      textWeight: 500,
      textOpacity: 1,
      vignette: 0,
      grain: 0,
      showWatermark: false,
    },
  },

  // ===== 画册署名系列（全幅 + 角落小署名，对标 Hasselblad 月亮款）=====
  {
    id: 'm_album_caption_l',
    name: '画册署名·左下',
    desc: '全幅照片 + 左下角两行小署名（机型 + 拍摄日期），画册页脚气质',
    group: '极简轻量',
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
      infoLayout: 'classic',
      overlayAlign: 'left',
      overlayBottom: 44,
      showLogo: false,
      showCameraModel: true,
      cameraModelSize: 20,
      cameraModelWeight: 600,
      showExif: false,
      showLens: false,
      showDate: true,
      dateFormat: 'dash',
      dateFontSize: 14,
      dateTextWeight: 400,
      dateTextOpacity: 0.75,
      fontSize: 14,
      textWeight: 400,
      textOpacity: 1,
      vignette: 0,
      grain: 0,
      showWatermark: false,
    },
  },
  {
    id: 'm_album_caption_r',
    name: '画册署名·右下',
    desc: '全幅照片 + 右下角两行小署名（机型 + 拍摄日期），对称的右缘版式',
    group: '极简轻量',
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
      infoLayout: 'classic',
      overlayAlign: 'right',
      overlayBottom: 44,
      showLogo: false,
      showCameraModel: true,
      cameraModelSize: 20,
      cameraModelWeight: 600,
      showExif: false,
      showLens: false,
      showDate: true,
      dateFormat: 'dash',
      dateFontSize: 14,
      dateTextWeight: 400,
      dateTextOpacity: 0.75,
      fontSize: 14,
      textWeight: 400,
      textOpacity: 1,
      vignette: 0,
      grain: 0,
      showWatermark: false,
    },
  },
]

// 前 10 套初代模板的分组归属（扩充批模板在各自条目内直接写 group）。
// id → group；缺失归「经典」。useTemplates.test.ts 校验覆盖完整性。
const LEGACY_GROUPS: Record<string, string> = {
  m_duo_card: '经典',
  m_float_round: '经典',
  m_matte_serif: '极简轻量',
  m_center_params: '经典',
  m_strip_plate: '经典',
  m_tech_silver: '创意排版',
  m_film_noir: '胶片复古',
  m_float_badge: '水印署名',
  m_ccd_stamp: '胶片复古',
  m_magazine_edit: '杂志编辑',
}
for (const t of BUILTIN) {
  if (!t.group) t.group = LEGACY_GROUPS[t.id] ?? '经典'
}

const templates = reactive<FrameTemplate[]>([])

function load(): FrameTemplate[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as FrameTemplate[] | null
      // 合并内置（内置始终存在），用户自定义追加；持久化值可能为 "null"/损坏，须判空
      if (Array.isArray(parsed)) {
        // 审查报告 S9：结构校验——损坏条目（config 缺失 / name 非字符串）直接丢弃，
        // 避免进入列表后点击即崩溃
        const custom = parsed.filter(
          (t) =>
            t &&
            !t.builtin &&
            typeof t.name === 'string' &&
            t.config &&
            typeof t.config === 'object' &&
            !Array.isArray(t.config),
        )
        return [...BUILTIN, ...custom]
      }
    }
  } catch {
    /* ignore */
  }
  return [...BUILTIN]
}

function persist() {
  const custom = templates.filter((t) => !t.builtin)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(custom))
  } catch {
    /* ignore */
  }
}

(() => {
  templates.push(...load())
})()

function makeId(): string {
  return `tpl_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`
}

/**
 * 仅导出与装饰/排版相关的字段：排除主图与位置/变换，
 * 并剔除当前照片的 EXIF 内容（型号 / EXIF 文本 / 日期 / 镜头 / 品牌）。
 * 后者属于每张照片自身数据，存进模板会把 A 照片的型号带到 B 照片上。
 * 显示开关（showXxx）属于模板设计的一部分，正常保留。
 */
function toTemplateConfig(cfg: FrameConfig): Partial<FrameConfig> {
  const { photoSrc, photoX, photoY, photoRotation, photoCrop, bgScale, bgOffsetX, bgOffsetY, ...rest } = cfg
  void photoSrc
  void photoX
  void photoY
  void photoRotation
  void photoCrop
  void bgScale
  void bgOffsetX
  void bgOffsetY
  // 照片自身内容：不进模板
  const {
    cameraModel,
    exifText,
    exifRaw,
    dateText,
    lensText,
    brand,
    ...tpl
  } = rest
  void cameraModel
  void exifText
  void exifRaw
  void dateText
  void lensText
  void brand
  return { ...tpl }
}

/**
 * 应用模板到「当前编辑状态」（与模板面板点击行为一致，供首选项「启动默认模板」复用）：
 * - 模板只覆盖装饰/布局参数；照片内容/变换/位置与 EXIF 语义参数（eqFocal/cropFactor）保留当前照片的；
 * - INFO 文本缺失（空或「自定义」占位）时从照片 exifRaw 自动回填（含型号/品牌占位恢复），
 *   模板开启显示仍无数据的字段才落「自定义」占位并汇总返回；
 * - INFO 文本字体/字号/粗细/透明度的用户独立设置保留；颜色随模板背景自适应：
 *   模板显式定义优先，未定义时文字回「自动」（null → 渲染端按底色黑白），Logo 按底色明暗取黑/白，
 *   白框模板自动得到深色 Logo，用户无需手动调节。
 *
 * @returns 缺失的 INFO 字段中文名列表（模板开启了显示但无内容，已用「自定义」占位）；
 *          空数组 = 信息齐全。调用方可据此弹框提示。
 */
/**
 * 输入净化（审查报告 S9/S10）：模板导入 / 剪贴板参数 / 本地存储均为不可信来源。
 * 按 defaultFrameConfig 的类型模板逐键校验：未知键丢弃、类型不符丢弃、
 * null 仅保留给原本可为 null 的字段；防止 null.id 类崩溃与 `abcpx` 非法 CSS
 * 进入渲染、历史链与持久化。
 * 修正：默认值为 null 的可空字段（类型均为「具体类型 | null」）显式赋具体值时必须保留——
 * 此前 typeof null === 'object' 导致这些字段的值被误判丢弃，模板的日期样式 /
 * 独立字体 / 标块配色 / 装裱画幅比在应用时静默失效（回归 2026-09-12）。
 * 可空字段的非空成员类型无法从默认值 null 推导，按 types.ts 显式登记；
 * photoSrc（照片内容，非装饰参数）保持一律丢弃。
 */
const NULLABLE_STRING_FIELDS = new Set([
  'customBgImage',
  'exifFontFamily', 'lensFontFamily', 'dateFontFamily',
  'exifTextColor', 'lensTextColor', 'dateTextColor',
  'cameraModelColor', 'cardBadgeBg', 'cardBadgeFg',
])
const NULLABLE_NUMBER_FIELDS = new Set([
  'frameRatio', 'photoX', 'photoY',
  'logoX', 'logoY', 'modelX', 'modelY', 'exifX', 'exifY', 'dateX', 'dateY', 'lensX', 'lensY',
  'infoDividerX', 'infoDividerTop', 'infoDividerBottom',
  'exifFontSize', 'lensFontSize', 'dateFontSize',
  'exifTextWeight', 'lensTextWeight', 'dateTextWeight',
  'exifTextOpacity', 'lensTextOpacity', 'dateTextOpacity',
])
export function sanitizeTemplateConfig(raw: Partial<FrameConfig>): Partial<FrameConfig> {
  const def = defaultFrameConfig as unknown as Record<string, unknown>
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(raw)) {
    const base = def[k]
    if (base === undefined) continue // 未知键：丢弃
    if (v === null) {
      if (base === null) out[k] = null
      continue
    }
    if (typeof v === 'object') {
      if (!Array.isArray(v) && base !== null && typeof base === 'object') out[k] = v
      continue
    }
    // 可空字段（默认值 null）：按登记的非空成员类型严格校验
    if (base === null) {
      if (NULLABLE_STRING_FIELDS.has(k) && typeof v === 'string') out[k] = v
      else if (NULLABLE_NUMBER_FIELDS.has(k) && typeof v === 'number' && Number.isFinite(v)) out[k] = v
      continue
    }
    if (typeof v === typeof base) {
      if (typeof v === 'number' && !Number.isFinite(v)) continue
      out[k] = v
    }
  }
  return out as Partial<FrameConfig>
}

export function applyTemplateToState(rawConfig: Partial<FrameConfig>): string[] {
  const { state, loadConfig } = useFrameConfig()
  // 审查报告 S9/S10：不可信输入统一在此净化（未知键/类型不符/null 污染均被拦截）
  const config = sanitizeTemplateConfig(rawConfig ?? {})
  // 模板背景明暗（模板未指定背景时沿用当前背景）：浅色纯色底 → 深色 Logo
  const bgMode = config.bgMode ?? state.bgMode
  const bgColor = config.bgColor ?? state.bgColor
  const lightSolid = bgMode === 'solid' && hexLuminance(bgColor) > 0.6
  const next: FrameConfig = {
    ...defaultFrameConfig,
    ...config,
    // ===== 照片自身内容 / 变换 / 位置：永远保留当前照片的 =====
    photoSrc: state.photoSrc,
    photoX: state.photoX,
    photoY: state.photoY,
    photoRotation: state.photoRotation,
    photoCrop: state.photoCrop,
    bgScale: state.bgScale,
    bgOffsetX: state.bgOffsetX,
    bgOffsetY: state.bgOffsetY,
    canvasH: state.canvasH,
    exifRaw: state.exifRaw,
    eqFocal: state.eqFocal,
    cropFactor: state.cropFactor,
    // ===== 层显示开关（showBackground/showBorder/showInfo）：保留用户当前值，
    // 不被 defaultFrameConfig 兜底 true 覆盖——应用模板不应把用户手动关闭的层悄悄打开，
    // 否则开关被重置为 on 而面板未必展开，造成「切开不展开」的错乱。 =====
    showBackground: state.showBackground,
    showBorder: state.showBorder,
    showInfo: state.showInfo,
    // ===== INFO 文本独立样式：模板显式定义的字段以模板为准（保存模板 = 保存这套参数，
    // 应用结果须与模板缩略图一致）；模板未定义的保留用户当前值 =====
    exifFontFamily: config.exifFontFamily ?? state.exifFontFamily,
    exifFontSize: config.exifFontSize ?? state.exifFontSize,
    exifTextWeight: config.exifTextWeight ?? state.exifTextWeight,
    exifTextOpacity: config.exifTextOpacity ?? state.exifTextOpacity,
    lensFontFamily: config.lensFontFamily ?? state.lensFontFamily,
    lensFontSize: config.lensFontSize ?? state.lensFontSize,
    lensTextWeight: config.lensTextWeight ?? state.lensTextWeight,
    lensTextOpacity: config.lensTextOpacity ?? state.lensTextOpacity,
    dateFontFamily: config.dateFontFamily ?? state.dateFontFamily,
    dateFontSize: config.dateFontSize ?? state.dateFontSize,
    dateTextWeight: config.dateTextWeight ?? state.dateTextWeight,
    dateTextOpacity: config.dateTextOpacity ?? state.dateTextOpacity,
    exifTextColor: config.exifTextColor ?? null,
    lensTextColor: config.lensTextColor ?? null,
    dateTextColor: config.dateTextColor ?? null,
    cameraModelColor: config.cameraModelColor ?? null,
    // 机型字标开关：模板未显式定义时保留用户当前值（不被 defaultFrameConfig 的默认 true 覆盖）
    modelMark: config.modelMark ?? state.modelMark,
    logoColor: config.logoColor ?? (lightSolid ? '#1a1a1a' : '#ffffff'),
    // ===== INFO 文本：先保留现值，缺失的从 exifRaw 回填 =====
    exifText: state.exifText,
    dateText: state.dateText,
    lensText: state.lensText,
    cameraModel: state.cameraModel,
    brand: state.brand,
    dateFormat: config.dateFormat ?? state.dateFormat,
  }
  backfillInfoFromRaw(next)
  // 模板开启显示但内容仍缺失的字段：用「自定义」占位并汇总，供调用方弹框提示。
  // 无 EXIF 的照片：品牌/型号也视为未识别（brand 残留的只是全局默认值，如 sony）
  const missing: string[] = []
  if ((config.showExif ?? state.showExif) && isInfoMissing(next.exifText)) {
    next.exifText = INFO_PLACEHOLDER
    missing.push('EXIF 参数')
  }
  if ((config.showLens ?? state.showLens) && isInfoMissing(next.lensText)) {
    next.lensText = INFO_PLACEHOLDER
    missing.push('镜头信息')
  }
  if ((config.showDate ?? state.showDate) && isInfoMissing(next.dateText)) {
    next.dateText = INFO_PLACEHOLDER
    missing.push('拍摄日期')
  }
  if ((config.showCameraModel ?? state.showCameraModel) && isInfoMissing(next.cameraModel)) {
    next.cameraModel = INFO_PLACEHOLDER
    missing.push('相机型号')
  }
  if ((config.showLogo ?? state.showLogo) && !next.exifRaw) {
    next.brand = INFO_PLACEHOLDER
    missing.push('品牌信息')
  }
  recalcCanvasHAfterTemplate(state, next)
  // 模板自带 dateFormat：dateText 若为旧格式文本，反解日期后按模板格式重拼
  // （无 EXIF 原始日期的照片用 parseDisplayDate 从展示文本反解；解析失败保留原文本）
  if (config.dateFormat && config.dateFormat !== state.dateFormat) {
    const rawDate = next.exifRaw?.dateTimeOriginal ?? parseDisplayDate(next.dateText)
    if (rawDate) next.dateText = formatDate(rawDate, next.dateFormat)
  }
  loadConfig(next)
  return missing
}

/**
 * 模板应用后按新边框参数重算画布总高：内容区高不变（照片不随模板缩放），
 * 画布 = 内容高 + 上下 padding×2 + 底边 borderRatio。旧 canvasH 为 0（未初始化）时跳过。
 * 不重算会导致大 padding 模板（银灰测绘/杂志编辑等）把内容区错误压缩、INFO 锚点整体错位。
 */
export function recalcCanvasHAfterTemplate(old: FrameConfig, next: FrameConfig): void {
  if (!old.canvasH) return
  const contentH = old.canvasH - old.padding - (old.padding + old.borderRatio)
  next.canvasH = Math.max(0, contentH + next.padding * 2 + next.borderRatio)
}

export function useTemplates() {
  function saveCurrent(name: string, cfg: FrameConfig, category: TemplateCategory = 'all'): void {
    const trimmed = name.trim()
    if (!trimmed) return
    templates.unshift({
      id: makeId(),
      name: trimmed,
      category,
      config: toTemplateConfig(cfg),
    })
    persist()
  }

  function remove(id: string): void {
    const idx = templates.findIndex((t) => t.id === id)
    if (idx >= 0 && !templates[idx].builtin) {
      templates.splice(idx, 1)
      persist()
    }
  }

  /** 重命名自定义模板（内置模板不可改）；空名 / 同名直接忽略 */
  function rename(id: string, name: string): boolean {
    const t = templates.find((x) => x.id === id)
    if (!t || t.builtin) return false
    const trimmed = name.trim()
    if (!trimmed || trimmed === t.name) return false
    t.name = trimmed
    persist()
    return true
  }

  function exportJson(id: string): string {
    const t = templates.find((x) => x.id === id)
    if (!t) return ''
    return JSON.stringify({ kind: 'frame-template', version: 1, template: t }, null, 2)
  }

  /**
   * 导出模板包：把指定 id（缺省 = 全部自定义模板）打包成一个 JSON 文件。
   * 内置模板不参与打包（随应用分发）；包内条目复用 FrameTemplate 结构。
   */
  function exportPack(ids?: string[]): string {
    const src =
      ids && ids.length ? templates.filter((t) => ids.includes(t.id) && !t.builtin) : templates.filter((t) => !t.builtin)
    return JSON.stringify({ kind: 'frame-template-pack', version: 1, templates: src }, null, 2)
  }

  /** 校验单条模板载荷：名称与 config 齐全即视为合法（config 内容再经 sanitize 净化） */
  function validatePackEntry(t: unknown): t is FrameTemplate {
    const e = t as FrameTemplate
    return !!e && typeof e.name === 'string' && !!e.name.trim() && !!e.config && typeof e.config === 'object' && !Array.isArray(e.config)
  }

  function importJson(text: string): { ok: boolean; error?: string; count?: number } {
    try {
      const obj = JSON.parse(text)
      // 模板包：批量导入（条目逐个净化校验，全部非法才算失败）
      if (obj && obj.kind === 'frame-template-pack') {
        const list = Array.isArray(obj.templates) ? obj.templates : []
        const valid = list.filter(validatePackEntry)
        if (!valid.length) return { ok: false, error: '模板包为空或格式不正确' }
        for (const t of valid) {
          templates.unshift({
            id: makeId(),
            name: t.name + ' (导入)',
            category: typeof t.category === 'string' && t.category ? t.category : 'all',
            group: typeof t.group === 'string' && t.group ? t.group : undefined,
            config: sanitizeTemplateConfig(t.config),
          })
        }
        persist()
        return { ok: true, count: valid.length }
      }
      if (obj.kind !== 'frame-template' || !obj.template) {
        return { ok: false, error: '不是有效的模板文件' }
      }
      // 审查报告 S9：结构校验——损坏/手改文件的 config 缺失或非法会导致应用时崩溃
      const t = obj.template as FrameTemplate
      const name = typeof t?.name === 'string' ? t.name.trim() : ''
      if (!name || !t?.config || typeof t.config !== 'object' || Array.isArray(t.config)) {
        return { ok: false, error: '模板内容不完整（缺少名称或参数）' }
      }
      templates.unshift({
        id: makeId(),
        name: name + ' (导入)',
        category: typeof t.category === 'string' && t.category ? t.category : 'all',
        config: sanitizeTemplateConfig(t.config),
      })
      persist()
      return { ok: true, count: 1 }
    } catch {
      return { ok: false, error: '解析失败' }
    }
  }

  /** 清除全部自定义模板（保留内置），供「首选项 → 数据」清理 */
  function clearCustom(): void {
    for (let i = templates.length - 1; i >= 0; i--) {
      if (!templates[i].builtin) templates.splice(i, 1)
    }
    persist()
  }

  return {
    templates,
    recentIds,
    saveCurrent,
    remove,
    rename,
    exportJson,
    exportPack,
    importJson,
    toTemplateConfig,
    clearCustom,
  }
}
