// 多行文字块模板生成器（第 4 批，2026-09-16）
// ---------------------------------------------------------------------------
// 用途：按《多行文字块规范》（见 useTemplates.ts 第 3 批段落注释）把「紧凑规格表」批量展开为
//       FrameLab 模板字面量，写入 src/core/textBlockTemplates.ts（与 promotedTemplates.ts 同形的
//       冻结字面量，由 useTemplates 在运行时展开进内置清单）。
//
// 为什么用生成器：这一族模板的元素数量多（5~10 个自由元素）且几何必须遵守同一条规则——
//   块高 + 上下留白 ≤ 底色带高（padding + borderRatio）。手写时很容易像第 3 批那样把首行
//   顶到带外（压在照片上、深色字直接看不见）。这里改为**推导**：给出首行距下缘 baseY、
//   行距 pitch，脚本算带高 borderRatio = baseY + 首行半高 + 上留白 - padding。
//
// 用法：node scripts/gen-text-block-templates.mjs            # 写文件
//       node scripts/gen-text-block-templates.mjs --dry      # 只打印摘要与样张映射
import { writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const REPO = fileURLToPath(new URL('..', import.meta.url))
const OUT = join(REPO, 'src/core/textBlockTemplates.ts')
const DRY = process.argv.includes('--dry')

const SANS = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
const MONO = "'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, monospace"
const SERIF = "Didot, 'Bodoni MT', 'Playfair Display', Georgia, 'Times New Roman', serif"
const FONT = { sans: SANS, mono: MONO, serif: SERIF }

const DARK = '#1A1A1A'
const GREY = '#333333'
const WARM = '#6C6455'
const WHITE = '#FFFFFF'

/**
 * 行规格（数组顺序 = 从上到下）：
 *   { v: '{model}', size, weight, font, ls, op }         → exif 元素（数值行，缺字段自动跳过）
 *   { t: 'CAMERA', ... }                                 → 静态文本元素
 *   { pair: [label, value] }                             → 同一行左右两个元素（标签 + 数值）
 *   { rule: width }                                      → 分隔线
 *   { logo: baseWidth }                                  → 内置品牌字标
 * gap 为该行到下一行的距离（缺省用 spec.pitch）
 */
const SPECS = [
  // ===== 水印署名：全幅浮层多行（需投影压字）=====
  {
    id: 'm_wb_float_five_left',
    name: '浮层规格·左缘五行',
    desc: '照片铺满无边框，左缘五行规格浮层：机型 / 焦段光圈 / 快门感光 / 镜头 / 日期',
    group: '水印署名',
    anchor: 'bottom-left',
    baseY: 178,
    pitch: 32,
    align: 'left',
    color: WHITE,
    shadow: true,
    sample: 'clement-proust-XxK9RR09DIU',
    lines: [
      { v: '{model}', size: 30, weight: 700, font: 'sans' },
      { v: '{focal}   {aperture}', size: 18, font: 'mono' },
      { v: '{shutter}   {iso}', size: 18, font: 'mono' },
      { v: '{lens}', size: 18, font: 'mono', op: 0.9 },
      { v: '{date}', size: 16, font: 'mono', ls: 2, op: 0.7 },
    ],
  },
  {
    id: 'm_wb_float_top_eight',
    name: '浮层记录·左上八行',
    desc: '照片铺满，左上角八行拍摄记录：日期、坐标、机型、镜头与四段曝光参数',
    group: '水印署名',
    anchor: 'top-left',
    baseY: 78,
    pitch: 26,
    align: 'left',
    color: WHITE,
    shadow: true,
    sample: 'gabriela-PtCILZw-e4Y',
    lines: [
      { v: '{date}', size: 15, font: 'mono', ls: 2, op: 0.85 },
      { v: '{gps}', size: 14, font: 'mono', ls: 2, op: 0.7 },
      { v: '{model}', size: 22, weight: 700, font: 'sans', gap: 30 },
      { v: '{lens}', size: 14, font: 'mono', op: 0.9 },
      { v: '{focal}', size: 14, font: 'mono' },
      { v: '{aperture}', size: 14, font: 'mono' },
      { v: '{shutter}', size: 14, font: 'mono' },
      { v: '{iso}', size: 14, font: 'mono' },
    ],
  },
  {
    id: 'm_wb_float_six_center',
    name: '浮层参数·居中六行',
    desc: '照片铺满，底部居中六行参数浮层：机型、曝光两行、镜头、日期与坐标',
    group: '水印署名',
    anchor: 'bottom-center',
    baseY: 176,
    pitch: 30,
    align: 'center',
    color: WHITE,
    shadow: true,
    sample: 'rafael-peier-8yfCTr6ia18',
    lines: [
      { v: '{model}', size: 28, weight: 700, font: 'sans' },
      { v: '{focal}   {aperture}', size: 17, font: 'mono' },
      { v: '{shutter}   {iso}', size: 17, font: 'mono' },
      { v: '{lens}', size: 16, font: 'mono', op: 0.9 },
      { v: '{date}', size: 15, font: 'mono', ls: 2, op: 0.75 },
      { v: '{gps}', size: 13, font: 'mono', ls: 2, op: 0.65 },
    ],
  },
  {
    id: 'm_wb_float_ten_pairs',
    name: '浮层铭牌·左缘十行',
    desc: '照片铺满，左缘五行「标签 + 数值」浮层：机型、焦段、曝光、镜头、坐标',
    group: '水印署名',
    anchor: 'bottom-left',
    baseY: 168,
    pitch: 30,
    align: 'left',
    color: WHITE,
    shadow: true,
    sample: 'garvit-nama-_GXbkkSFcnE',
    lines: [
      { pair: [{ t: 'CAMERA', size: 12, weight: 600, ls: 5, op: 0.6 }, { v: '{model}', size: 19, weight: 600, font: 'sans' }] },
      { pair: [{ t: 'FOCAL', size: 12, weight: 600, ls: 5, op: 0.6 }, { v: '{focal}   {aperture}', size: 16, font: 'mono' }] },
      { pair: [{ t: 'EXPOSURE', size: 12, weight: 600, ls: 5, op: 0.6 }, { v: '{shutter}   {iso}', size: 16, font: 'mono' }] },
      { pair: [{ t: 'LENS', size: 12, weight: 600, ls: 5, op: 0.6 }, { v: '{lens}', size: 16, font: 'mono' }] },
      { pair: [{ t: 'PLACE', size: 12, weight: 600, ls: 5, op: 0.6 }, { v: '{gps}', size: 15, font: 'mono' }] },
    ],
  },
  {
    id: 'm_wb_float_top_six',
    name: '浮层刊头·顶部六行',
    desc: '照片铺满，顶部一行大写字标配细分隔线，下接日期、机型与两行参数',
    group: '创意排版',
    anchor: 'top-left',
    baseY: 76,
    pitch: 28,
    align: 'left',
    color: WHITE,
    shadow: true,
    sample: 'douglas-schneiders-iO9uHKMFiVU',
    lines: [
      { t: 'FIELD RECORD', size: 14, weight: 600, font: 'mono', ls: 6, op: 0.85 },
      { rule: 420, gap: 26 },
      { v: '{date}', size: 18, font: 'mono', ls: 2, op: 0.9, gap: 34 },
      { v: '{model}', size: 24, weight: 700, font: 'sans' },
      { v: '{focal}   {aperture}', size: 15, font: 'mono', op: 0.9 },
      { v: '{shutter}   {iso}', size: 15, font: 'mono', op: 0.9 },
    ],
  },
  {
    id: 'm_wb_float_big_four',
    name: '浮层大字·四行',
    desc: '照片铺满，底部大字四行：机型、焦段、快门感光与日期，重投影压字',
    group: '水印署名',
    anchor: 'bottom-left',
    baseY: 206,
    pitch: 42,
    align: 'left',
    color: WHITE,
    shadow: true,
    sample: 'rosalie-gdy-MAm8CTlyeI8',
    lines: [
      { v: '{model}', size: 34, weight: 700, font: 'sans' },
      { v: '{focal}', size: 26, weight: 600, font: 'mono', op: 0.95 },
      { v: '{shutter}   {iso}', size: 26, weight: 600, font: 'mono', op: 0.95 },
      { v: '{date}', size: 20, font: 'mono', ls: 2, op: 0.8 },
    ],
  },
  {
    id: 'm_wb_float_right_five',
    name: '浮层记录·右缘五行',
    desc: '照片铺满，右下贴右缘收排五行：机型、镜头、焦段光圈、快门感光与日期',
    group: '水印署名',
    anchor: 'bottom-right',
    baseY: 176,
    pitch: 32,
    align: 'right',
    color: WHITE,
    shadow: true,
    sample: 'julie-gaia-guzal-0IT4vwi1hZo',
    lines: [
      { v: '{model}', size: 28, weight: 700, font: 'sans' },
      { v: '{lens}', size: 17, font: 'mono', op: 0.9 },
      { v: '{focal}   {aperture}', size: 17, font: 'mono' },
      { v: '{shutter}   {iso}', size: 17, font: 'mono' },
      { v: '{date}', size: 15, font: 'mono', ls: 2, op: 0.7 },
    ],
  },

  // ===== 经典：白边带内多行（深字，不投影）=====
  {
    id: 'm_wb_band_six_left',
    name: '白边·六行记录',
    desc: '白底带内六行左对齐：机型、镜头、焦段、光圈、快门与感光，参数列走等宽字',
    group: '经典',
    padding: 30,
    anchor: 'bottom-left',
    baseY: 168,
    pitch: 30,
    align: 'left',
    color: DARK,
    sample: 'takashi-sakamoto-hXfCmfmUPt0',
    lines: [
      { v: '{model}', size: 28, weight: 700, font: 'sans' },
      { v: '{lens}', size: 17, font: 'mono', color: GREY },
      { v: '{focal}', size: 17, font: 'mono', color: GREY },
      { v: '{aperture}', size: 17, font: 'mono', color: GREY },
      { v: '{shutter}', size: 17, font: 'mono', color: GREY },
      { v: '{iso}', size: 17, font: 'mono', color: GREY },
    ],
  },
  {
    id: 'm_wb_band_numeric_eight',
    name: '数据卡·居中八行',
    desc: '白卡居中八行「数值 + 小字标」上下交替，两栏规格表的安静排版',
    group: '经典',
    padding: 30,
    anchor: 'bottom-center',
    baseY: 172,
    pitch: 28,
    align: 'center',
    color: DARK,
    sample: 'anton-shakirov-K1RmYc5pRks',
    lines: [
      { v: '{model}', size: 26, weight: 700, font: 'sans' },
      { t: 'CAMERA', size: 11, weight: 600, font: 'mono', ls: 4, op: 0.5 },
      { v: '{focal}', size: 24, weight: 700, font: 'sans' },
      { t: 'FOCAL', size: 11, weight: 600, font: 'mono', ls: 4, op: 0.5 },
      { v: '{shutter}', size: 24, weight: 700, font: 'sans' },
      { t: 'SHUTTER', size: 11, weight: 600, font: 'mono', ls: 4, op: 0.5 },
      { v: '{iso}', size: 24, weight: 700, font: 'sans' },
      { t: 'SENSITIVITY', size: 11, weight: 600, font: 'mono', ls: 4, op: 0.5 },
    ],
  },
  {
    id: 'm_wb_band_date_three',
    name: '白边·日期三行',
    desc: '白底窄带三行小字：日期、机型与镜头，安静的角标式记录',
    group: '极简轻量',
    padding: 26,
    anchor: 'bottom-left',
    baseY: 110,
    pitch: 28,
    align: 'left',
    color: GREY,
    sample: 'safiullah-oba-wzhqy-B1zxM',
    lines: [
      { v: '{date}', size: 16, font: 'mono', ls: 2, op: 0.75 },
      { v: '{model}', size: 22, weight: 700, font: 'sans', color: DARK },
      { v: '{lens}', size: 15, font: 'mono', op: 0.8 },
    ],
  },
  {
    id: 'm_wb_band_seven_left',
    name: '白边·七行记录',
    desc: '白底带七行左对齐：日期、坐标、机型、镜头与三段曝光参数',
    group: '经典',
    padding: 32,
    anchor: 'bottom-left',
    baseY: 186,
    pitch: 28,
    align: 'left',
    color: DARK,
    sample: 'alin-gavriliuc-PZ5HifLJcjo',
    lines: [
      { v: '{date}', size: 15, font: 'mono', ls: 2, color: GREY, op: 0.8 },
      { v: '{gps}', size: 14, font: 'mono', ls: 2, color: GREY, op: 0.7, gap: 34 },
      { v: '{model}', size: 26, weight: 700, font: 'sans' },
      { v: '{lens}', size: 16, font: 'mono', color: GREY },
      { v: '{focal}', size: 16, font: 'mono', color: GREY },
      { v: '{aperture}', size: 16, font: 'mono', color: GREY },
      { v: '{shutter}   {iso}', size: 16, font: 'mono', color: GREY },
    ],
  },
  {
    id: 'm_wb_band_pairs_six',
    name: '铭牌·六组字段',
    desc: '白底带六行「标签 + 数值」对照：日期、坐标、机型、镜头、焦段与曝光',
    group: '经典',
    padding: 28,
    anchor: 'bottom-left',
    baseY: 190,
    pitch: 28,
    align: 'left',
    color: DARK,
    sample: 'tsuyoshi-kozu-ukSDSF2oRA8',
    lines: [
      { pair: [{ t: 'DATE', size: 12, weight: 600, ls: 5, op: 0.45 }, { v: '{date}', size: 16, font: 'mono', color: GREY }] },
      { pair: [{ t: 'PLACE', size: 12, weight: 600, ls: 5, op: 0.45 }, { v: '{gps}', size: 15, font: 'mono', color: GREY }] },
      { pair: [{ t: 'CAMERA', size: 12, weight: 600, ls: 5, op: 0.45 }, { v: '{model}', size: 19, weight: 600, font: 'sans', color: DARK }] },
      { pair: [{ t: 'LENS', size: 12, weight: 600, ls: 5, op: 0.45 }, { v: '{lens}', size: 16, font: 'mono', color: GREY }] },
      { pair: [{ t: 'FOCAL', size: 12, weight: 600, ls: 5, op: 0.45 }, { v: '{focal}   {aperture}', size: 16, font: 'mono', color: GREY }] },
      { pair: [{ t: 'EXPOSURE', size: 12, weight: 600, ls: 5, op: 0.45 }, { v: '{shutter}   {iso}', size: 16, font: 'mono', color: GREY }] },
    ],
  },

  // ===== 联名卡：品牌字标 + 参数行（Logo 元素 = 内置自绘字标）=====
  {
    id: 'm_wb_credit_logo_five',
    name: '联名卡·品牌行五行',
    desc: '白底带内品牌字标领起，下接机型与四段参数，联名卡式的左对齐排布',
    group: '联名卡',
    padding: 30,
    anchor: 'bottom-left',
    baseY: 178,
    pitch: 30,
    align: 'left',
    color: DARK,
    sample: 'b-s-Q2Z6BnGn0ys',
    lines: [
      { logo: 132, gap: 40 },
      { v: '{model}', size: 24, weight: 700, font: 'sans' },
      { v: '{lens}', size: 16, font: 'mono', color: GREY },
      { v: '{focal}   {aperture}', size: 16, font: 'mono', color: GREY },
      { v: '{shutter}   {iso}', size: 16, font: 'mono', color: GREY },
    ],
  },
  {
    id: 'm_wb_credit_logo_six',
    name: '联名卡·品牌行六行',
    desc: '白底带内品牌字标与六行记录：日期、机型、镜头及三段曝光参数',
    group: '联名卡',
    padding: 30,
    anchor: 'bottom-left',
    baseY: 186,
    pitch: 28,
    align: 'left',
    color: DARK,
    sample: 'marcus-ganahl-Z2-lnDiixBM',
    lines: [
      { v: '{date}', size: 14, font: 'mono', ls: 2, color: GREY, op: 0.75, gap: 32 },
      { logo: 120, gap: 40 },
      { v: '{model}', size: 22, weight: 700, font: 'sans' },
      { v: '{lens}', size: 15, font: 'mono', color: GREY },
      { v: '{focal}   {aperture}', size: 15, font: 'mono', color: GREY },
      { v: '{shutter}   {iso}', size: 15, font: 'mono', color: GREY },
    ],
  },
  {
    id: 'm_wb_credit_logo_right',
    name: '联名卡·右对齐品牌行',
    desc: '白底带内右对齐收排：品牌字标与机型、参数行齐右缘，联名卡的镜像排布',
    group: '联名卡',
    padding: 30,
    anchor: 'bottom-right',
    baseY: 170,
    pitch: 30,
    align: 'right',
    color: DARK,
    sample: 'noppadon-manadee-4CFbtKdHch8',
    lines: [
      { logo: 120, gap: 40 },
      { v: '{model}', size: 24, weight: 700, font: 'sans' },
      { v: '{focal}   {aperture}', size: 16, font: 'mono', color: GREY },
      { v: '{shutter}   {iso}', size: 16, font: 'mono', color: GREY },
      { v: '{date}', size: 15, font: 'mono', ls: 2, color: GREY, op: 0.7 },
    ],
  },

  // ===== 大师水印：米白厚带 + 居中规格（衬线字标 + 分隔线）=====
  {
    id: 'm_wb_master_seven_center',
    name: '大师水印·居中七行',
    desc: '米白厚底带居中七行规格，机型用衬线字，参数行等宽，组间细分隔线',
    group: '大师水印',
    bgColor: '#F6F2EA',
    padding: 34,
    anchor: 'bottom-center',
    baseY: 198,
    pitch: 28,
    align: 'center',
    color: DARK,
    sample: 'tanya-prodaan-qB1dSYDISeA',
    lines: [
      { t: 'PHOTOGRAPHED BY', size: 12, weight: 600, font: 'mono', ls: 6, color: WARM, op: 0.75 },
      { v: '{model}', size: 26, weight: 700, font: 'serif', gap: 34 },
      { rule: 320, color: '#CFC6B4', gap: 26 },
      { v: '{focal}   {aperture}', size: 16, font: 'mono', color: GREY, gap: 32 },
      { v: '{shutter}   {iso}', size: 16, font: 'mono', color: GREY },
      { v: '{lens}', size: 15, font: 'mono', color: GREY, op: 0.85, gap: 32 },
      { v: '{date}', size: 14, font: 'mono', ls: 2, color: WARM, op: 0.75 },
    ],
  },
  {
    id: 'm_wb_master_five_serif',
    name: '大师水印·衬线五行',
    desc: '米白底带居中五行：衬线机型、两行参数、镜头与日期，画廊签署式排布',
    group: '大师水印',
    bgColor: '#F6F2EA',
    padding: 34,
    anchor: 'bottom-center',
    baseY: 178,
    pitch: 34,
    align: 'center',
    color: DARK,
    sample: 'mattia-revelant-Yh3alvVRvRA',
    lines: [
      { v: '{model}', size: 28, weight: 700, font: 'serif' },
      { v: '{focal}   {aperture}   {shutter}', size: 16, font: 'mono', color: GREY },
      { v: '{iso}', size: 16, font: 'mono', color: GREY },
      { v: '{lens}', size: 15, font: 'mono', color: GREY, op: 0.85 },
      { v: '{date}', size: 14, font: 'mono', ls: 3, color: WARM, op: 0.75 },
    ],
  },

  // ===== 创意排版 / 暗调影廊：顶部大字、模糊底带 =====
  {
    id: 'm_wb_top_five_center',
    name: '浮层刊头·顶部五行',
    desc: '照片铺满，顶部居中五行：日期、机型、两行参数与署名，刊头式压字',
    group: '创意排版',
    anchor: 'top-center',
    baseY: 92,
    pitch: 32,
    align: 'center',
    color: WHITE,
    shadow: true,
    sample: 'francesco-ungaro-EKakGSDJGCs',
    lines: [
      { v: '{date}', size: 16, font: 'mono', ls: 3, op: 0.9 },
      { v: '{model}', size: 30, weight: 700, font: 'sans', gap: 38 },
      { v: '{focal}   {aperture}', size: 16, font: 'mono', op: 0.9 },
      { v: '{shutter}   {iso}', size: 16, font: 'mono', op: 0.9 },
      { t: 'FRAMELAB', size: 13, weight: 600, font: 'mono', ls: 6, op: 0.7, gap: 34 },
    ],
  },
  {
    id: 'm_wb_top_big_two',
    name: '浮层刊头·顶部大字两行',
    desc: '照片铺满，顶部两行大字配细分隔线：日期行 + 机型行，极简刊头',
    group: '创意排版',
    anchor: 'top-left',
    baseY: 96,
    pitch: 30,
    align: 'left',
    color: WHITE,
    shadow: true,
    sample: 'zixi-lu-28_vmGQw36A',
    lines: [
      { v: '{date}', size: 18, font: 'mono', ls: 4, op: 0.9 },
      { t: 'PHOTOGRAPHY', size: 12, weight: 600, font: 'mono', ls: 7, op: 0.7, gap: 26 },
      { rule: 260, gap: 30 },
      { v: '{model}', size: 32, weight: 700, font: 'sans', gap: 40 },
    ],
  },
  {
    id: 'm_wb_blur_five_left',
    name: '模糊延展·五行参数',
    desc: '模糊延展底带上左对齐五行参数，白字压模糊底，画面同源的柔和记录',
    group: '暗调影廊',
    blur: true,
    padding: 30,
    anchor: 'bottom-left',
    baseY: 168,
    pitch: 32,
    align: 'left',
    color: WHITE,
    sample: 'greg-rosenke-uWGfchsnYD4',
    lines: [
      { v: '{model}', size: 28, weight: 700, font: 'sans' },
      { v: '{focal}   {aperture}', size: 17, font: 'mono', op: 0.95 },
      { v: '{shutter}   {iso}', size: 17, font: 'mono', op: 0.95 },
      { v: '{lens}', size: 16, font: 'mono', op: 0.9 },
      { v: '{date}', size: 15, font: 'mono', ls: 2, op: 0.75 },
    ],
  },

  // ===== 相机机身壳（第 3 阶段素材方案 a：自绘矢量机身，2026-09-17）=====
  // 语料 01_相机边框 是「真实相机照片做底、用户照片合成进机身屏幕」的素材拼贴；FrameLab 不用
  // 第三方素材，改为矢量机身壳：照片即机身背面 LCD（deviceMockup 沿照片边缘内收绘制），
  // 空 lines = 纯壳体模板（对应语料「浮动 + 相机壳×1 + 无文字」那几套）。
  {
    id: 'm_cam_shell_dark',
    name: '机身壳·黑银全幅',
    desc: '照片铺满，黑机身配银顶盖的相机机身壳：热靴、快门钮、模式拨盘与皮革握把齐备',
    group: '联名卡',
    mockup: 'camera-dark',
    sample: 'douglas-schneiders-iO9uHKMFiVU',
    lines: [],
  },
  {
    id: 'm_cam_shell_silver',
    name: '机身壳·银黑全幅',
    desc: '照片铺满，银色机身配黑握把，顶盖与按钮细节与黑款同源',
    group: '联名卡',
    mockup: 'camera-silver',
    sample: 'gabriela-PtCILZw-e4Y',
    lines: [],
  },
  {
    id: 'm_cam_shell_square',
    name: '机身壳·方画幅',
    desc: '1:1 方画幅配银机身壳，取景方窗的相机质感，适合方形构图',
    group: '联名卡',
    mockup: 'camera-silver',
    ratio: 1, // frameRatio 是数值（宽/高）：1:1 = 1（字符串会被 sanitize 丢弃）
    sample: 'anton-shakirov-K1RmYc5pRks',
    lines: [],
  },
  {
    id: 'm_cam_shell_brand3',
    name: '机身壳·品牌三行',
    desc: '机身壳下白底厚带内居中三行：品牌字标、机型与镜头署名，联名卡式收尾',
    group: '联名卡',
    mockup: 'camera-dark',
    padding: 30,
    anchor: 'bottom-center',
    baseY: 132,
    pitch: 34,
    align: 'center',
    color: DARK,
    sample: 'b-s-Q2Z6BnGn0ys',
    lines: [
      { logo: 124, gap: 44 },
      { v: '{model}', size: 26, weight: 700, font: 'sans' },
      { v: '{lens}', size: 15, font: 'mono', color: GREY },
    ],
  },
  {
    id: 'm_cam_shell_param8',
    name: '机身壳·参数八行',
    desc: '机身壳下白底厚带内居中八行「数值 + 小字标」交替，规格表式收尾',
    group: '联名卡',
    mockup: 'camera-dark',
    padding: 32,
    anchor: 'bottom-center',
    baseY: 172,
    pitch: 28,
    align: 'center',
    color: DARK,
    sample: 'tsuyoshi-kozu-ukSDSF2oRA8',
    lines: [
      { v: '{model}', size: 26, weight: 700, font: 'sans' },
      { t: 'CAMERA', size: 11, weight: 600, font: 'mono', ls: 4, op: 0.5 },
      { v: '{focal}', size: 24, weight: 700, font: 'sans' },
      { t: 'FOCAL', size: 11, weight: 600, font: 'mono', ls: 4, op: 0.5 },
      { v: '{shutter}', size: 24, weight: 700, font: 'sans' },
      { t: 'SHUTTER', size: 11, weight: 600, font: 'mono', ls: 4, op: 0.5 },
      { v: '{iso}', size: 24, weight: 700, font: 'sans' },
      { t: 'SENSITIVITY', size: 11, weight: 600, font: 'mono', ls: 4, op: 0.5 },
    ],
  },
  {
    id: 'm_cam_shell_mark4',
    name: '机身壳·左上四行',
    desc: '照片铺满机身壳，左上居中四行：机型、焦段光圈、镜头与日期',
    group: '联名卡',
    mockup: 'camera-silver',
    anchor: 'top-center',
    baseY: 112,
    pitch: 34,
    align: 'center',
    color: WHITE,
    shadow: true,
    sample: 'julie-gaia-guzal-0IT4vwi1hZo',
    lines: [
      { v: '{model}', size: 30, weight: 700, font: 'sans' },
      { v: '{focal}   {aperture}', size: 17, font: 'mono', op: 0.95 },
      { v: '{lens}', size: 16, font: 'mono', op: 0.9 },
      { v: '{date}', size: 15, font: 'mono', ls: 2, op: 0.75 },
    ],
  },
  {
    id: 'm_cam_shell_sign6',
    name: '机身壳·左缘六行',
    desc: '照片铺满机身壳，左缘六行：机型、署名与四段参数，贴机身内缘压字',
    group: '联名卡',
    mockup: 'camera-dark',
    inset: 96,
    anchor: 'bottom-left',
    baseY: 200,
    pitch: 30,
    align: 'left',
    color: WHITE,
    shadow: true,
    sample: 'clement-proust-XxK9RR09DIU',
    lines: [
      { v: '{model}', size: 28, weight: 700, font: 'sans' },
      { t: 'PHOTOGRAPHED BY FRAMELAB', size: 12, weight: 600, font: 'mono', ls: 3, op: 0.8 },
      { v: '{focal}   {aperture}', size: 16, font: 'mono' },
      { v: '{shutter}   {iso}', size: 16, font: 'mono' },
      { v: '{lens}', size: 15, font: 'mono', op: 0.9 },
      { v: '{date}', size: 14, font: 'mono', ls: 2, op: 0.7 },
    ],
  },
  {
    id: 'm_cam_shell_port8',
    name: '机身壳·带下八行',
    desc: '银机身壳配白底厚带，带内居中八行：机型、日期、四段参数、位置与署名',
    group: '联名卡',
    mockup: 'camera-silver',
    padding: 34,
    anchor: 'bottom-center',
    baseY: 176,
    pitch: 28,
    align: 'center',
    color: DARK,
    sample: 'rosalie-gdy-MAm8CTlyeI8',
    lines: [
      { v: '{model}', size: 26, weight: 700, font: 'sans' },
      { v: '{date}', size: 14, font: 'mono', ls: 2, color: GREY, op: 0.8, gap: 32 },
      { v: '{focal}   {aperture}', size: 16, font: 'mono', color: GREY },
      { v: '{shutter}   {iso}', size: 16, font: 'mono', color: GREY },
      { v: '{lens}', size: 15, font: 'mono', color: GREY, op: 0.9 },
      { v: '{gps}', size: 14, font: 'mono', ls: 2, color: GREY, op: 0.7 },
      { t: 'FRAMELAB STUDIO', size: 12, weight: 600, font: 'mono', ls: 5, color: WARM, op: 0.75, gap: 32 },
    ],
  },

  // ===== 胶片壳 / 拍立得 / 特效 / 票根（2026-09-17 第 3 阶段素材类最后 7 套）=====
  {
    id: 'm_film_dark_caps',
    name: '胶片·黑片基',
    desc: '3:2 画幅配黑片基胶片壳（上下齿孔与边缘记号），底部两行日期与署名',
    group: '胶片复古',
    mockup: 'film-dark',
    ratio: 1.5,
    anchor: 'bottom-center',
    baseY: 96,
    pitch: 26,
    align: 'center',
    color: WHITE,
    shadow: true,
    sample: 'rosalie-gdy-MAm8CTlyeI8',
    lines: [
      { v: '{date}', size: 15, font: 'mono', ls: 2, op: 0.9 },
      { t: 'SHOT ON FILM', size: 12, weight: 600, font: 'mono', ls: 5, op: 0.7 },
    ],
  },
  {
    id: 'm_film_warm_three',
    name: '胶片·暖褐片基',
    desc: '暖褐片基胶片壳，底部居中三行：机型、参数与署名',
    group: '胶片复古',
    mockup: 'film-warm',
    anchor: 'bottom-center',
    baseY: 104,
    pitch: 28,
    align: 'center',
    color: WHITE,
    shadow: true,
    sample: 'clement-proust-XxK9RR09DIU',
    lines: [
      { v: '{model}', size: 22, weight: 700, font: 'sans' },
      { v: '{focal}   {aperture}   {iso}', size: 15, font: 'mono', op: 0.9 },
      { t: 'FILM SIMULATION', size: 11, weight: 600, font: 'mono', ls: 4, op: 0.65 },
    ],
  },
  {
    id: 'm_pola_sign_one',
    name: '拍立得·署名一行',
    desc: '正方形白框配厚底带，底部居中一行署名，一次成像的经典留白',
    group: '胶片复古',
    ratio: 1,
    padding: 46,
    anchor: 'bottom-center',
    baseY: 86,
    pitch: 26,
    align: 'center',
    color: GREY,
    sample: 'julie-gaia-guzal-0IT4vwi1hZo',
    lines: [{ t: 'PHOTO BY FRAMELAB', size: 13, weight: 600, font: 'mono', ls: 4, op: 0.8 }],
  },
  {
    id: 'm_pola_four_lines',
    name: '拍立得·带下四行',
    desc: '正方形白框配厚底带，带下四行居中：机型、两行参数与日期',
    group: '胶片复古',
    ratio: 1,
    padding: 46,
    anchor: 'bottom-center',
    baseY: 150,
    pitch: 28,
    align: 'center',
    color: DARK,
    sample: 'mattia-revelant-Yh3alvVRvRA',
    lines: [
      { v: '{model}', size: 22, weight: 700, font: 'sans' },
      { v: '{focal}   {aperture}', size: 15, font: 'mono', color: GREY },
      { v: '{shutter}   {iso}', size: 15, font: 'mono', color: GREY },
      { v: '{date}', size: 14, font: 'mono', ls: 2, color: WARM },
    ],
  },
  {
    id: 'm_effect_strip_logo',
    name: '特效·厚带品牌',
    desc: '机身壳配底部特厚带，带内居左品牌字标与参数行，重暗角与颗粒模拟胶片漏光',
    group: '创意排版',
    mockup: 'camera-dark',
    padding: 30,
    vignette: 0.28,
    grain: 0.22,
    anchor: 'bottom-center',
    baseY: 150,
    pitch: 30,
    align: 'center',
    color: DARK,
    sample: 'douglas-schneiders-iO9uHKMFiVU',
    lines: [
      { logo: 128, gap: 42 },
      { v: '{focal}   {aperture}', size: 16, font: 'mono', color: GREY },
      { v: '{shutter}   {iso}', size: 16, font: 'mono', color: GREY },
    ],
  },
  {
    id: 'm_ticket_guide',
    name: '票根·竖长卡',
    desc: '竖长圆角票根卡：照片下方一道齿孔撕线，带内左对齐地名、日期与编号',
    group: '纸品印刷',
    // 不设 frameRatio：引擎保持照片自身比例，横构图照片下若强制 0.62 竖长比例会被撑出大片空白
    padding: 30,
    borderRadius: 8,
    anchor: 'bottom-left',
    baseY: 152,
    pitch: 30,
    align: 'left',
    color: DARK,
    sample: 'tsuyoshi-kozu-ukSDSF2oRA8',
    lines: [
      { sprocket: 420, hole: 14, thickness: 2, color: '#CFC7B6', gap: 54 },
      { v: '{gps}', size: 26, weight: 700, font: 'sans' },
      { v: '{date}', size: 16, font: 'mono', color: GREY, gap: 34 },
      { v: '{model}', size: 13, font: 'mono', ls: 3, color: WARM, op: 0.8 },
    ],
  },
  {
    id: 'm_ticket_stub',
    name: '票根·存根',
    desc: '票根卡：齿孔撕线下方右对齐四行（机型、参数两行、日期）与品牌字标',
    group: '纸品印刷',
    padding: 28,
    borderRadius: 8,
    anchor: 'bottom-right',
    baseY: 168,
    pitch: 30,
    align: 'right',
    color: DARK,
    sample: 'noppadon-manadee-4CFbtKdHch8',
    lines: [
      { sprocket: 380, hole: 13, thickness: 2, color: '#CFC7B6', gap: 50 },
      { logo: 116, gap: 40 },
      { v: '{model}', size: 20, weight: 700, font: 'sans' },
      { v: '{shutter}   {iso}', size: 15, font: 'mono', color: GREY },
      { v: '{date}', size: 14, font: 'mono', ls: 2, color: WARM },
    ],
  },

  // ===== 手机壳（02_手机边框）与社交尺寸（2026-09-17 收尾批）：手机壳此前引擎现成但无模板，分组为空 =====
  {
    id: 'm_ph_three_center',
    name: '手机壳·底部三行',
    desc: '深空灰手机壳配白底带居中三行：机型、焦段与日期',
    group: '设备样机',
    mockup: 'phone-dark',
    padding: 30,
    anchor: 'bottom-center',
    baseY: 150,
    pitch: 34,
    align: 'center',
    color: DARK,
    sample: 'rosalie-gdy-MAm8CTlyeI8',
    lines: [
      { v: '{model}', size: 30, weight: 700, font: 'sans' },
      { v: '{focal}   {aperture}', size: 17, font: 'mono', color: GREY },
      { v: '{date}', size: 15, font: 'mono', ls: 2, color: GREY },
    ],
  },
  {
    id: 'm_ph_five_left',
    name: '手机壳·左缘五行',
    desc: '照片铺满手机壳，左缘五行白字压字：机型、两段参数、镜头与日期',
    group: '设备样机',
    mockup: 'phone-dark',
    inset: 96,
    anchor: 'bottom-left',
    baseY: 200,
    pitch: 32,
    align: 'left',
    color: WHITE,
    shadow: true,
    sample: 'clement-proust-XxK9RR09DIU',
    lines: [
      { v: '{model}', size: 28, weight: 700, font: 'sans' },
      { v: '{focal}   {aperture}', size: 16, font: 'mono' },
      { v: '{shutter}   {iso}', size: 16, font: 'mono' },
      { v: '{lens}', size: 15, font: 'mono', op: 0.9 },
      { v: '{date}', size: 14, font: 'mono', ls: 2, op: 0.7 },
    ],
  },
  {
    id: 'm_ph_six_left',
    name: '手机壳·白带六行',
    desc: '银色手机壳配白底带六行左对齐：机型、镜头与四段曝光参数',
    group: '设备样机',
    mockup: 'phone-light',
    padding: 30,
    anchor: 'bottom-left',
    baseY: 200,
    pitch: 30,
    align: 'left',
    color: DARK,
    sample: 'tsuyoshi-kozu-ukSDSF2oRA8',
    lines: [
      { v: '{model}', size: 26, weight: 700, font: 'sans' },
      { v: '{lens}', size: 16, font: 'mono', color: GREY },
      { v: '{focal}', size: 16, font: 'mono', color: GREY },
      { v: '{aperture}', size: 16, font: 'mono', color: GREY },
      { v: '{shutter}', size: 16, font: 'mono', color: GREY },
      { v: '{iso}', size: 16, font: 'mono', color: GREY },
    ],
  },
  {
    id: 'm_ph_seven_center',
    name: '手机壳·居中七行',
    desc: '银色手机壳配白底带居中七行：品牌字标、机型、两段参数、镜头、日期与坐标',
    group: '设备样机',
    mockup: 'phone-light',
    padding: 32,
    anchor: 'bottom-center',
    baseY: 196,
    pitch: 28,
    align: 'center',
    color: DARK,
    sample: 'julie-gaia-guzal-0IT4vwi1hZo',
    lines: [
      { logo: 118, gap: 40 },
      { v: '{model}', size: 24, weight: 700, font: 'sans' },
      { v: '{focal}   {aperture}', size: 16, font: 'mono', color: GREY },
      { v: '{shutter}   {iso}', size: 16, font: 'mono', color: GREY },
      { v: '{lens}', size: 15, font: 'mono', color: GREY, op: 0.9 },
      { v: '{date}', size: 14, font: 'mono', ls: 2, color: WARM },
      { v: '{gps}', size: 13, font: 'mono', ls: 2, color: WARM, op: 0.75 },
    ],
  },
  {
    id: 'm_ph_nine_caps',
    name: '手机壳·居中九行',
    desc: '深空灰手机壳配白底厚带居中九行：字标、机型、分隔线与六段记录',
    group: '设备样机',
    mockup: 'phone-dark',
    padding: 30,
    anchor: 'bottom-center',
    baseY: 214,
    pitch: 26,
    align: 'center',
    color: DARK,
    sample: 'douglas-schneiders-iO9uHKMFiVU',
    lines: [
      { logo: 124, gap: 38 },
      { v: '{model}', size: 24, weight: 700, font: 'sans' },
      { rule: 300, color: '#CFC7B6', gap: 30 },
      { v: '{lens}', size: 15, font: 'mono', color: GREY },
      { v: '{focal}   {aperture}', size: 16, font: 'mono', color: GREY },
      { v: '{shutter}   {iso}', size: 16, font: 'mono', color: GREY },
      { v: '{date}', size: 14, font: 'mono', ls: 2, color: WARM },
      { v: '{gps}', size: 13, font: 'mono', ls: 2, color: WARM, op: 0.75 },
      { t: 'FRAMELAB', size: 12, weight: 600, font: 'mono', ls: 5, color: WARM, op: 0.7 },
    ],
  },
  {
    id: 'm_ph_pairs_six',
    name: '手机壳·六组字段',
    desc: '银色手机壳配白底带六组「标签 + 数值」：日期、坐标、机型、镜头、焦段与曝光',
    group: '设备样机',
    mockup: 'phone-light',
    padding: 28,
    anchor: 'bottom-left',
    baseY: 250,
    pitch: 28,
    align: 'left',
    color: DARK,
    sample: 'marcus-ganahl-Z2-lnDiixBM',
    lines: [
      { pair: [{ t: 'DATE', size: 12, weight: 600, ls: 5, op: 0.45 }, { v: '{date}', size: 16, font: 'mono', color: GREY }] },
      { pair: [{ t: 'PLACE', size: 12, weight: 600, ls: 5, op: 0.45 }, { v: '{gps}', size: 15, font: 'mono', color: GREY }] },
      { pair: [{ t: 'CAMERA', size: 12, weight: 600, ls: 5, op: 0.45 }, { v: '{model}', size: 19, weight: 600, font: 'sans', color: DARK }] },
      { pair: [{ t: 'LENS', size: 12, weight: 600, ls: 5, op: 0.45 }, { v: '{lens}', size: 16, font: 'mono', color: GREY }] },
      { pair: [{ t: 'FOCAL', size: 12, weight: 600, ls: 5, op: 0.45 }, { v: '{focal}   {aperture}', size: 16, font: 'mono', color: GREY }] },
      { pair: [{ t: 'EXPOSURE', size: 12, weight: 600, ls: 5, op: 0.45 }, { v: '{shutter}   {iso}', size: 16, font: 'mono', color: GREY }] },
    ],
  },
  {
    id: 'm_ph_night_five',
    name: '手机壳·暗调五行',
    desc: '深空灰手机壳配炭黑底带五行白字：机型、两段参数、镜头与日期',
    group: '设备样机',
    mockup: 'phone-dark',
    bgColor: '#141518',
    padding: 30,
    anchor: 'bottom-left',
    baseY: 180,
    pitch: 32,
    align: 'left',
    color: WHITE,
    sample: 'alin-gavriliuc-PZ5HifLJcjo',
    lines: [
      { v: '{model}', size: 26, weight: 700, font: 'sans' },
      { v: '{focal}   {aperture}', size: 16, font: 'mono', op: 0.9 },
      { v: '{shutter}   {iso}', size: 16, font: 'mono', op: 0.9 },
      { v: '{lens}', size: 15, font: 'mono', op: 0.85 },
      { v: '{date}', size: 14, font: 'mono', ls: 2, op: 0.7 },
    ],
  },
  {
    id: 'm_social_story_two',
    name: '社交·竖屏两行',
    desc: '9:16 竖屏画幅，底部居中两行：日期与字标，适配社媒长图',
    group: '社交尺寸',
    ratio: 0.5625,
    padding: 40,
    anchor: 'bottom-center',
    baseY: 130,
    pitch: 30,
    align: 'center',
    color: DARK,
    sample: 'anton-shakirov-K1RmYc5pRks',
    lines: [
      { v: '{date}', size: 18, font: 'mono', ls: 3, color: GREY },
      { t: 'FRAMELAB', size: 13, weight: 600, font: 'mono', ls: 6, color: WARM },
    ],
  },
]

// ===== 展开为模板字面量 =====
const halfHeight = (l) => {
  // 字标元素按内置品牌 Logo 的常见比例（宽:高 ≈ 2.5:1）估高；分隔线取 1px
  if (l.logo) return (l.logo * 0.4) / 2
  if (l.rule) return 1
  if (l.sprocket) return (l.hole ?? 10) / 2
  const sizes = l.pair ? l.pair.map((p) => p.size) : [l.size ?? 20]
  return Math.max(...sizes) / 2
}

function elementOf(l, ctx, y) {
  const base = {
    enable: true,
    y,
    anchorX: ctx.anchorX,
    anchorY: ctx.anchorY,
    scale: 1,
    rotate: 0,
    zIndex: 1,
    exportable: true,
  }
  if (l.rule) {
    return { ...base, type: 'divider', id: `${ctx.id}-rule-${ctx.seq}`, x: ctx.ruleX, opacity: l.op ?? 0.6, width: l.rule, thickness: 1, color: l.color ?? ctx.color }
  }
  if (l.sprocket) {
    // 齿孔线（票根撕线）：一排冲孔 + 横线，水平锚点语义同 divider
    return {
      ...base,
      type: 'sprocket',
      id: `${ctx.id}-spk-${ctx.seq}`,
      x: ctx.ruleX,
      opacity: l.op ?? 1,
      width: l.sprocket,
      holeSize: l.hole ?? 10,
      thickness: l.thickness ?? 1.5,
      color: l.color ?? ctx.color,
    }
  }
  if (l.logo) {
    // logo 元素以自身中心为原点绘制（无 align 支持）→ 按锚点把整块拉进留白内
    const x = ctx.anchorX === 'right' ? -ctx.inset - l.logo / 2 : ctx.anchorX === 'center' ? 0 : ctx.inset + l.logo / 2
    return { ...base, type: 'logo', id: `${ctx.id}-logo-${ctx.seq}`, x, opacity: l.op ?? 0.9, logoId: 'brand', baseWidth: l.logo }
  }
  const element = {
    ...base,
    id: `${ctx.id}-${ctx.seq}`,
    type: l.t != null ? 'text' : 'exif',
    x: ctx.textX,
    opacity: l.op ?? (l.t != null ? 0.55 : 0.92),
    fontFamily: FONT[l.font ?? 'mono'],
    fontSize: l.size,
    fontWeight: l.weight ?? 500,
    color: l.color ?? ctx.color,
    align: ctx.align,
    letterSpacing: l.ls ?? 1,
    lineHeight: 1.2,
  }
  if (l.t != null) element.text = l.t
  else element.template = l.v
  if (ctx.shadow) element.shadow = true
  return element
}

/** 各模板共用的默认配置（几何/配色/排版按 spec 覆盖） */
const BASE_CONFIG = {
  bgMode: 'solid',
  bgColor: '#FFFFFF',
  borderColor: '#FFFFFF',
  padding: 0,
  borderRatio: 0,
  photoRadius: 0,
  borderRadius: 0,
  scale: 100,
  shadow: 0,
  frameRatio: null,
  infoLayout: 'classic',
  overlayAlign: 'left',
  overlayAnchor: 'bottom',
  overlayBottom: 26,
  showLogo: false,
  showCameraModel: false,
  showExif: false,
  showLens: false,
  showDate: false,
  dateFormat: 'date',
  fontFamily: SANS,
  fontSize: 18,
  textWeight: 500,
  textOpacity: 0.9,
  vignette: 0,
  grain: 0,
  showWatermark: false,
  deviceMockup: 'none',
}

function buildEntry(spec) {
  const n = spec.lines.length
  // 纯设备壳模板（lines 为空）：不排版、不启用 infoLayer，只有照片 + 机身壳
  if (n === 0) {
    return {
      id: spec.id,
      name: spec.name,
      desc: spec.desc,
      group: spec.group,
      category: 'frame',
      builtin: true,
      config: {
        ...BASE_CONFIG,
        frameRatio: spec.ratio ?? null,
        bgColor: '#101114',
        borderColor: '#101114',
        deviceMockup: spec.mockup ?? 'none',
        infoLayer: { enabled: false, bindTarget: 'canvas', elements: [] },
      },
    }
  }
  const firstHalf = halfHeight(spec.lines[0])
  const lastHalf = halfHeight(spec.lines[n - 1])
  const gaps = spec.lines.map((l, i) => (i === n - 1 ? 0 : l.gap ?? spec.pitch ?? 28))
  const span = gaps.reduce((a, b) => a + b, 0) // 首行 → 末行的总落差
  const fullBleed = !spec.padding
  const padding = spec.padding ?? 0

  const anchorX = spec.anchor.endsWith('right') ? 'right' : spec.anchor.endsWith('center') ? 'center' : 'left'
  const anchorY = spec.anchor.startsWith('top') ? 'top' : 'bottom'

  // baseY = 首行距锚点边的距离。底锚块自动下压：保证末行离下缘 ≥ 半高 + 22（行数多时块会"长高"，
  // 带高随之变厚，而不是把末行顶出画布——第 4 批第一版就是踩了这个坑）。
  const baseY =
    anchorY === 'bottom' ? Math.max(spec.baseY, span + lastHalf + 22) : spec.baseY
  // 带高推导：首行距下缘 baseY + 首行半高 + 上留白 26，再减去 padding 得 borderRatio
  const borderRatio = fullBleed ? 0 : Math.max(28, Math.round(baseY + firstHalf + 26 - padding))
  if (anchorY === 'bottom' && baseY > spec.baseY) {
    console.log(`  · ${spec.id} 底锚块自动下压：首行距下缘 ${spec.baseY} → ${baseY}（块高 ${span}）`)
  }
  const align = spec.align ?? (anchorX === 'right' ? 'right' : anchorX === 'center' ? 'center' : 'left')
  const inset = spec.inset ?? 64
  const sign = anchorY === 'top' ? 1 : -1

  const ctx = {
    id: spec.id,
    seq: 0,
    anchorX,
    anchorY,
    align,
    inset,
    color: spec.color ?? DARK,
    shadow: spec.shadow && fullBleed,
    // 文本/线/字标的水平锚点内缩（右锚点用负值向内收）
    textX: anchorX === 'right' ? -inset : anchorX === 'center' ? 0 : inset,
    ruleX: anchorX === 'right' ? -inset : anchorX === 'center' ? 0 : inset,
  }

  // 行序：**首行 = 距锚点边最远的一行**（底锚即最靠上），逐行向锚点边靠拢。
  // 注意方向——底锚 y 为负且 |y| 递减；顶锚 y 为正且递增（写反会把文字块排到带外/照片上）。
  const elements = []
  let offset = 0
  for (const l of spec.lines) {
    const y = anchorY === 'top' ? baseY + offset : -(baseY - offset)
    elements.push(...lineElements(l, ctx, y))
    offset += l.gap ?? spec.pitch ?? 28
  }
  // 顶锚块落在照片上，块高不应超过常见画布的一半，否则小画幅下会顶到底部
  if (anchorY === 'top' && baseY + span > 560) {
    console.warn(`  ! ${spec.id} 顶锚块高 ${baseY + span}px，小画幅下可能过长`)
  }

  const config = {
    ...BASE_CONFIG,
    bgMode: spec.blur ? 'blur' : 'solid',
    ...(spec.blur ? { blur: 28 } : {}),
    bgColor: spec.blur ? '#000000' : spec.bgColor ?? '#FFFFFF',
    borderColor: spec.blur ? '#000000' : spec.bgColor ?? '#FFFFFF',
    padding,
    borderRatio,
    borderRadius: spec.borderRadius ?? 0,
    vignette: spec.vignette ?? 0,
    grain: spec.grain ?? 0,
    frameRatio: spec.ratio ?? null,
    overlayAlign: anchorX,
    overlayAnchor: anchorY,
    deviceMockup: spec.mockup ?? 'none',
    infoLayer: { enabled: true, bindTarget: 'canvas', elements },
  }

  return { id: spec.id, name: spec.name, desc: spec.desc, group: spec.group, category: 'frame', builtin: true, config }
}

/** 一「行」展开成 1~2 个元素（pair = 标签贴锚点边 + 数值贴对侧，行内左右分列） */
function lineElements(l, ctx, y) {
  if (l.pair) {
    const [label, value] = l.pair
    const flip = ctx.anchorX === 'right'
    ctx.seq += 1
    const a = elementOf(label, ctx, y)
    ctx.seq += 1
    const b = elementOf(value, ctx, y)
    a.x = flip ? -ctx.inset : ctx.inset
    b.x = flip ? ctx.inset : -ctx.inset
    a.align = flip ? 'right' : 'left'
    b.align = flip ? 'left' : 'right'
    return [a, b]
  }
  ctx.seq += 1
  return [elementOf(l, ctx, y)]
}

const entries = SPECS.map((spec) => buildEntry(spec))

if (DRY) {
  console.log(`模板 ${entries.length} 套：`)
  for (const e of entries) {
    const els = e.config.infoLayer.elements.length
    console.log(`  ${e.id.padEnd(26)} ${e.group.padEnd(6)} 元素 ${String(els).padStart(2)}  带高 ${String(e.config.padding + e.config.borderRatio).padStart(3)}  样张 ${SPECS.find((s) => s.id === e.id).sample}`)
  }
} else {
  const header = `// 多行文字块模板（2026-09-16 第 4 批，共 ${entries.length} 套）：按《多行文字块规范》由
// scripts/gen-text-block-templates.mjs 生成（config 已冻结为字面量，改动请改脚本后重跑以免被覆盖）。
// 骨架来源：FrameElf 语料中「5~10 行文字块」类（相机/手机边框、白边、无边水印、大师水印等），
// 命名、说明、文案、配色与几何全部自有；数值行一律用 exif 元素（缺字段自动跳过）。
import type { FrameTemplate } from '../composables/useTemplates'

export const TEXT_BLOCK_TEMPLATES: FrameTemplate[] = `
  writeFileSync(OUT, header + JSON.stringify(entries, null, 2) + '\n', 'utf8')
  console.log(`已生成 ${entries.length} 套 → ${OUT}`)
  console.log('--- 样张映射（追加到 scripts/gen-template-samples.ps1 的 $MAP）')
  for (const s of SPECS) console.log(`  '${s.id}'${' '.repeat(Math.max(1, 24 - s.id.length))}= '${s.sample}'`)
  console.log('--- 生成样张命令')
  console.log(`  powershell -NoProfile -ExecutionPolicy Bypass -File scripts/gen-template-samples.ps1 -Only ${SPECS.map((s) => s.id).join(',')}`)
}
