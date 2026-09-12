// 机型字标生成脚本：按 MARKS 表生成 src/assets/models/*.svg。
//
// 字标为「单色文字字标」（SVG <text> + tspan 分段样式），由运行时管线统一处理：
//   src/core/svgMark.ts —— 解析实际图形边界（getBBox）→ 重写 viewBox（统一 4% 内边距）
//   → 渲染 → 单色套色（source-in）→ 预览 dataURL / 导出画布。
// 因此这里无需精确控制画布尺寸与字形位置：字标会被自动裁剪到墨迹边界。
//
// 字体说明：字标使用系统字体栈渲染（与软件默认 INFO 字体同源，零外置资源）。
//
// Nikon Z 系列与 D850/D780 为官方矢量：
//   - MANUAL_FILES（Z 6 / Z 7 / Z 50 / Z 50II / Z 9 / Z f / Z fc / D780 / D850）为官方
//     锁排版矢量（来源 Wikimedia Commons，手工维护），本脚本永不写入（含 --force）。
//   - 其余 Z 机型（Z 5 / Z 5II / Z 6II / Z 6III / Z 7II / Z 8 / Z 30）无官方单机锁排版，
//     由本脚本按官方字形（Z 9 徽标的 Z + 各官方文件中的数字 + Z 50II 的 II）与实测
//     排版比例（数字高 ≈ 0.69×Z、首字距 0.36×H、字距 0.098×H）合成，见 Z_COMPOSITES。
//
// 新增机型：在 MARKS 追加一行后重跑：node scripts/gen-model-marks.mjs
import { mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'src', 'assets', 'models')
const FORCE = process.argv.includes('--force')

// 与软件默认 INFO 字体同源（WebView2 / 浏览器均内置解析，保证跨设备可用）
const APP_FONT = `-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif`

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// ===== 官方锁排版文件（手工维护，本脚本永不写入）=====
// 全部为官方矢量（来源 Wikimedia Commons「Nikon logos」与 Canon 单反 logo，已剥离隐藏 TM 组）。
const MANUAL_FILES = new Set([
  'nikon-z6', 'nikon-z7', 'nikon-z50', 'nikon-z50m2', 'nikon-z9', 'nikon-zf', 'nikon-zfc',
  'nikon-d780', 'nikon-d850', 'canon-eos5d', 'canon-eos7d',
])

// ===== 字标表（文字型）=====
// 字段：
//   file    资源名（src/assets/models/<file>.svg；registry 键见 src/core/modelMarks.ts）
//   label   维护说明（品牌 + 机型）
//   size    基准字号（默认 120）
//   weight  基准字重（默认 600）
//   spacing letter-spacing（品牌字距风格）
//   text    单段文本（与 parts 二选一）
//   parts   分段（tspan）：{ t, size?, weight?, italic? } —— 用于品牌特征分段
const MARKS = [
  // ===== Sony α（α 符号放大一档）=====
  { file: 'sony-a1', label: 'Sony α1', spacing: 2, parts: [{ t: 'α', size: 138 }, { t: '1' }] },
  { file: 'sony-a1m2', label: 'Sony α1 II', spacing: 2, parts: [{ t: 'α', size: 138 }, { t: '1 II' }] },
  { file: 'sony-a9', label: 'Sony α9', spacing: 2, parts: [{ t: 'α', size: 138 }, { t: '9' }] },
  { file: 'sony-a9m2', label: 'Sony α9 II', spacing: 2, parts: [{ t: 'α', size: 138 }, { t: '9 II' }] },
  { file: 'sony-a9m3', label: 'Sony α9 III', spacing: 2, parts: [{ t: 'α', size: 138 }, { t: '9 III' }] },
  { file: 'sony-a7', label: 'Sony α7', spacing: 2, parts: [{ t: 'α', size: 138 }, { t: '7' }] },
  { file: 'sony-a7r', label: 'Sony α7R', spacing: 2, parts: [{ t: 'α', size: 138 }, { t: '7R' }] },
  { file: 'sony-a7s', label: 'Sony α7S', spacing: 2, parts: [{ t: 'α', size: 138 }, { t: '7S' }] },
  { file: 'sony-a7m2', label: 'Sony α7 II', spacing: 2, parts: [{ t: 'α', size: 138 }, { t: '7 II' }] },
  { file: 'sony-a7m3', label: 'Sony α7 III', spacing: 2, parts: [{ t: 'α', size: 138 }, { t: '7 III' }] },
  { file: 'sony-a7m4', label: 'Sony α7 IV', spacing: 2, parts: [{ t: 'α', size: 138 }, { t: '7 IV' }] },
  { file: 'sony-a7m5', label: 'Sony α7 V', spacing: 2, parts: [{ t: 'α', size: 138 }, { t: '7 V' }] },
  { file: 'sony-a7rm2', label: 'Sony α7R II', spacing: 2, parts: [{ t: 'α', size: 138 }, { t: '7R II' }] },
  { file: 'sony-a7rm3', label: 'Sony α7R III', spacing: 2, parts: [{ t: 'α', size: 138 }, { t: '7R III' }] },
  { file: 'sony-a7rm4', label: 'Sony α7R IV', spacing: 2, parts: [{ t: 'α', size: 138 }, { t: '7R IV' }] },
  { file: 'sony-a7r5', label: 'Sony α7R V', spacing: 2, parts: [{ t: 'α', size: 138 }, { t: '7R V' }] },
  { file: 'sony-a7rm6', label: 'Sony α7R VI', spacing: 2, parts: [{ t: 'α', size: 138 }, { t: '7R VI' }] },
  { file: 'sony-a7sm2', label: 'Sony α7S II', spacing: 2, parts: [{ t: 'α', size: 138 }, { t: '7S II' }] },
  { file: 'sony-a7sm3', label: 'Sony α7S III', spacing: 2, parts: [{ t: 'α', size: 138 }, { t: '7S III' }] },
  { file: 'sony-a7c', label: 'Sony α7C', spacing: 2, parts: [{ t: 'α', size: 138 }, { t: '7C' }] },
  { file: 'sony-a7cm2', label: 'Sony α7C II', spacing: 2, parts: [{ t: 'α', size: 138 }, { t: '7C II' }] },
  { file: 'sony-a7cr', label: 'Sony α7C R', spacing: 2, parts: [{ t: 'α', size: 138 }, { t: '7C R' }] },
  { file: 'sony-a6000', label: 'Sony α6000', spacing: 2, parts: [{ t: 'α', size: 138 }, { t: '6000' }] },
  { file: 'sony-a6100', label: 'Sony α6100', spacing: 2, parts: [{ t: 'α', size: 138 }, { t: '6100' }] },
  { file: 'sony-a6300', label: 'Sony α6300', spacing: 2, parts: [{ t: 'α', size: 138 }, { t: '6300' }] },
  { file: 'sony-a6400', label: 'Sony α6400', spacing: 2, parts: [{ t: 'α', size: 138 }, { t: '6400' }] },
  { file: 'sony-a6500', label: 'Sony α6500', spacing: 2, parts: [{ t: 'α', size: 138 }, { t: '6500' }] },
  { file: 'sony-a6600', label: 'Sony α6600', spacing: 2, parts: [{ t: 'α', size: 138 }, { t: '6600' }] },
  { file: 'sony-a6700', label: 'Sony α6700', spacing: 2, parts: [{ t: 'α', size: 138 }, { t: '6700' }] },
  { file: 'sony-a5000', label: 'Sony α5000', spacing: 2, parts: [{ t: 'α', size: 138 }, { t: '5000' }] },
  { file: 'sony-a5100', label: 'Sony α5100', spacing: 2, parts: [{ t: 'α', size: 138 }, { t: '5100' }] },
  { file: 'sony-fx2', label: 'Sony FX2', spacing: 2, text: 'FX2' },
  { file: 'sony-fx3', label: 'Sony FX3', spacing: 2, text: 'FX3' },
  { file: 'sony-fx30', label: 'Sony FX30', spacing: 2, text: 'FX30' },
  { file: 'sony-zve10', label: 'Sony ZV-E10', spacing: 2, text: 'ZV-E10' },
  { file: 'sony-zve10m2', label: 'Sony ZV-E10 II', spacing: 2, text: 'ZV-E10 II' },
  { file: 'sony-zv1', label: 'Sony ZV-1', spacing: 2, text: 'ZV-1' },
  { file: 'sony-zv1m2', label: 'Sony ZV-1 II', spacing: 2, text: 'ZV-1 II' },
  { file: 'sony-zv1f', label: 'Sony ZV-1F', spacing: 2, text: 'ZV-1F' },
  { file: 'sony-rx100m2', label: 'Sony RX100 II', spacing: 2, text: 'RX100 II' },
  { file: 'sony-rx100m3', label: 'Sony RX100 III', spacing: 2, text: 'RX100 III' },
  { file: 'sony-rx100m4', label: 'Sony RX100 IV', spacing: 2, text: 'RX100 IV' },
  { file: 'sony-rx100m5', label: 'Sony RX100 V', spacing: 2, text: 'RX100 V' },
  { file: 'sony-rx100m6', label: 'Sony RX100 VI', spacing: 2, text: 'RX100 VI' },
  { file: 'sony-rx100m7', label: 'Sony RX100 VII', spacing: 2, text: 'RX100 VII' },
  { file: 'sony-rx100', label: 'Sony RX100', spacing: 2, text: 'RX100' },
  { file: 'sony-rx10m2', label: 'Sony RX10 II', spacing: 2, text: 'RX10 II' },
  { file: 'sony-rx10m3', label: 'Sony RX10 III', spacing: 2, text: 'RX10 III' },
  { file: 'sony-rx10m4', label: 'Sony RX10 IV', spacing: 2, text: 'RX10 IV' },
  { file: 'sony-rx1rm2', label: 'Sony RX1R II', spacing: 2, text: 'RX1R II' },
  { file: 'sony-rx1rm3', label: 'Sony RX1R III', spacing: 2, text: 'RX1R III' },

  // ===== Sony NEX 系 / A-mount 单电（老款，EXIF 常见）=====
  { file: 'sony-nex7', label: 'Sony NEX-7', spacing: 2, text: 'NEX-7' },
  { file: 'sony-nex6', label: 'Sony NEX-6', spacing: 2, text: 'NEX-6' },
  { file: 'sony-nex5t', label: 'Sony NEX-5T', spacing: 2, text: 'NEX-5T' },
  { file: 'sony-nex5n', label: 'Sony NEX-5N', spacing: 2, text: 'NEX-5N' },
  { file: 'sony-nex5r', label: 'Sony NEX-5R', spacing: 2, text: 'NEX-5R' },
  { file: 'sony-nex5', label: 'Sony NEX-5', spacing: 2, text: 'NEX-5' },
  { file: 'sony-nex3', label: 'Sony NEX-3', spacing: 2, text: 'NEX-3' },
  { file: 'sony-nexc3', label: 'Sony NEX-C3', spacing: 2, text: 'NEX-C3' },
  { file: 'sony-nexf3', label: 'Sony NEX-F3', spacing: 2, text: 'NEX-F3' },
  { file: 'sony-a77', label: 'Sony α77', spacing: 2, parts: [{ t: 'α', size: 138 }, { t: '77' }] },
  { file: 'sony-a77m2', label: 'Sony α77 II', spacing: 2, parts: [{ t: 'α', size: 138 }, { t: '77 II' }] },
  { file: 'sony-a99', label: 'Sony α99', spacing: 2, parts: [{ t: 'α', size: 138 }, { t: '99' }] },
  { file: 'sony-a99m2', label: 'Sony α99 II', spacing: 2, parts: [{ t: 'α', size: 138 }, { t: '99 II' }] },

  // ===== Canon EOS（EOS 斜体 + 型号分段）=====
  // 官方矢量锁排版（Commons「Canon EOS 5D logo」「EOS 7D logo」，脚本不覆盖）
  { file: 'canon-eos5d', label: 'Canon EOS 5D', manual: true },
  { file: 'canon-eos7d', label: 'Canon EOS 7D', manual: true },
  // 生成辅助：EOS 斜体前缀 + 型号 + 可选小号尾段（Mark II / III / IV）
  ...[
    ['canon-eosr1', 'Canon EOS R1', 'R1'],
    ['canon-eosr3', 'Canon EOS R3', 'R3'],
    ['canon-eosr5', 'Canon EOS R5', 'R5'],
    ['canon-eosr6', 'Canon EOS R6', 'R6'],
    ['canon-eosr8', 'Canon EOS R8', 'R8'],
    ['canon-eosr7', 'Canon EOS R7', 'R7'],
    ['canon-eosr10', 'Canon EOS R10', 'R10'],
    ['canon-eosr100', 'Canon EOS R100', 'R100'],
    ['canon-eosr50', 'Canon EOS R50', 'R50'],
    ['canon-eosrp', 'Canon EOS RP', 'RP'],
    ['canon-eosr', 'Canon EOS R', 'R'],
    ['canon-eosr5m2', 'Canon EOS R5 Mark II', 'R5', 'Mark II'],
    ['canon-eosr6m2', 'Canon EOS R6 Mark II', 'R6', 'Mark II'],
    ['canon-eos5dm4', 'Canon EOS 5D Mark IV', '5D', 'Mark IV'],
    ['canon-eos5dm3', 'Canon EOS 5D Mark III', '5D', 'Mark III'],
    ['canon-eos5dm2', 'Canon EOS 5D Mark II', '5D', 'Mark II'],
    ['canon-eos5ds', 'Canon EOS 5Ds', '5Ds'],
    ['canon-eos5dsr', 'Canon EOS 5Ds R', '5Ds R'],
    ['canon-eos1dxm3', 'Canon EOS-1D X Mark III', '1D X', 'Mark III'],
    ['canon-eos1dxm2', 'Canon EOS-1D X Mark II', '1D X', 'Mark II'],
    ['canon-eos1dx', 'Canon EOS-1D X', '1D X'],
    ['canon-eos200d', 'Canon EOS 200D', '200D'],
    ['canon-eosm100', 'Canon EOS M100', 'M100'],
    ['canon-eos6dm2', 'Canon EOS 6D Mark II', '6D', 'Mark II'],
    ['canon-eos6d', 'Canon EOS 6D', '6D'],
    ['canon-eos7dm2', 'Canon EOS 7D Mark II', '7D', 'Mark II'],
    ['canon-eos90d', 'Canon EOS 90D', '90D'],
    ['canon-eos80d', 'Canon EOS 80D', '80D'],
    ['canon-eos800d', 'Canon EOS 800D', '800D'],
    ['canon-eos850d', 'Canon EOS 850D', '850D'],
    ['canon-eos200dm2', 'Canon EOS 200D II', '200D', 'II'],
    ['canon-eosm50', 'Canon EOS M50', 'M50'],
    ['canon-eosm50m2', 'Canon EOS M50 Mark II', 'M50', 'Mark II'],
    ['canon-eosm6', 'Canon EOS M6', 'M6'],
    ['canon-eosm6m2', 'Canon EOS M6 Mark II', 'M6', 'Mark II'],
    ['canon-eosm5', 'Canon EOS M5', 'M5'],
    // PowerShot 便携机（G 系，vlog 常见）
    ['canon-g7xm2', 'Canon PowerShot G7 X Mark II', 'G7 X', 'Mark II'],
    ['canon-g7xm3', 'Canon PowerShot G7 X Mark III', 'G7 X', 'Mark III'],
    ['canon-g7x', 'Canon PowerShot G7 X', 'G7 X'],
    ['canon-g5xm2', 'Canon PowerShot G5 X Mark II', 'G5 X', 'Mark II'],
    ['canon-g9xm2', 'Canon PowerShot G9 X Mark II', 'G9 X', 'Mark II'],
  ].map(([file, label, model, tail]) => ({
    file, label, family: 'Arial,Helvetica,sans-serif', size: tail ? 112 : 118, spacing: 1,
    parts: [
      // PowerShot 系列不带 EOS 前缀
      ...(file.startsWith('canon-g') ? [] : [{ t: 'EOS', weight: 800, italic: true }]),
      { t: ` ${model}`, weight: 700 },
      ...(tail ? [{ t: ` ${tail}`, size: 84, weight: 600 }] : []),
    ],
  })),

  // ===== Nikon D（D850 / D780 为官方矢量，见 MANUAL_FILES）=====
  { file: 'nikon-d850', label: 'Nikon D850', manual: true },
  { file: 'nikon-d780', label: 'Nikon D780', manual: true },
  { file: 'nikon-d6', label: 'Nikon D6', weight: 700, spacing: 1, text: 'D6' },
  { file: 'nikon-d5', label: 'Nikon D5', weight: 700, spacing: 1, text: 'D5' },
  { file: 'nikon-d4s', label: 'Nikon D4s', weight: 700, spacing: 1, text: 'D4s' },
  { file: 'nikon-d300s', label: 'Nikon D300s', weight: 700, spacing: 1, text: 'D300s' },
  { file: 'nikon-d500', label: 'Nikon D500', weight: 700, spacing: 1, text: 'D500' },
  { file: 'nikon-d750', label: 'Nikon D750', weight: 700, spacing: 1, text: 'D750' },
  { file: 'nikon-d810', label: 'Nikon D810', weight: 700, spacing: 1, text: 'D810' },
  { file: 'nikon-d800', label: 'Nikon D800', weight: 700, spacing: 1, text: 'D800' },
  { file: 'nikon-d700', label: 'Nikon D700', weight: 700, spacing: 1, text: 'D700' },
  { file: 'nikon-d610', label: 'Nikon D610', weight: 700, spacing: 1, text: 'D610' },
  { file: 'nikon-d600', label: 'Nikon D600', weight: 700, spacing: 1, text: 'D600' },
  { file: 'nikon-d90', label: 'Nikon D90', weight: 700, spacing: 1, text: 'D90' },
  { file: 'nikon-d7200', label: 'Nikon D7200', weight: 700, spacing: 1, text: 'D7200' },
  { file: 'nikon-d7100', label: 'Nikon D7100', weight: 700, spacing: 1, text: 'D7100' },
  { file: 'nikon-d7000', label: 'Nikon D7000', weight: 700, spacing: 1, text: 'D7000' },
  { file: 'nikon-d7500', label: 'Nikon D7500', weight: 700, spacing: 1, text: 'D7500' },
  { file: 'nikon-d5600', label: 'Nikon D5600', weight: 700, spacing: 1, text: 'D5600' },
  { file: 'nikon-d5300', label: 'Nikon D5300', weight: 700, spacing: 1, text: 'D5300' },
  { file: 'nikon-d3500', label: 'Nikon D3500', weight: 700, spacing: 1, text: 'D3500' },
  { file: 'nikon-d3400', label: 'Nikon D3400', weight: 700, spacing: 1, text: 'D3400' },
  { file: 'nikon-d3300', label: 'Nikon D3300', weight: 700, spacing: 1, text: 'D3300' },
  { file: 'nikon-d3200', label: 'Nikon D3200', weight: 700, spacing: 1, text: 'D3200' },
  { file: 'nikon-df', label: 'Nikon Df', weight: 700, spacing: 1, text: 'Df' },
  { file: 'nikon-p1000', label: 'Nikon Coolpix P1000', weight: 700, spacing: 1, text: 'P1000' },
  { file: 'nikon-p950', label: 'Nikon Coolpix P950', weight: 700, spacing: 1, text: 'P950' },

  // ===== Nikon Z（官方锁排版 + 合成字标，见文件头说明）=====
  { file: 'nikon-z5', label: 'Nikon Z 5', z: ['5'] },
  { file: 'nikon-z5m2', label: 'Nikon Z 5II', z: ['5', 'II'] },
  { file: 'nikon-z6', label: 'Nikon Z 6', manual: true },
  { file: 'nikon-z6m2', label: 'Nikon Z 6II', z: ['6', 'II'] },
  { file: 'nikon-z6iii', label: 'Nikon Z 6III', z: ['6', 'III'] },
  { file: 'nikon-z7', label: 'Nikon Z 7', manual: true },
  { file: 'nikon-z7m2', label: 'Nikon Z 7II', z: ['7', 'II'] },
  { file: 'nikon-z8', label: 'Nikon Z 8', z: ['8'] },
  { file: 'nikon-z9', label: 'Nikon Z 9', manual: true },
  { file: 'nikon-zf', label: 'Nikon Z f', manual: true },
  { file: 'nikon-zfc', label: 'Nikon Z fc', manual: true },
  { file: 'nikon-z30', label: 'Nikon Z 30', z: ['30'] },
  { file: 'nikon-z50', label: 'Nikon Z 50', manual: true },
  { file: 'nikon-z50m2', label: 'Nikon Z 50II', manual: true },

  // ===== Fujifilm X / GFX =====
  { file: 'fujifilm-xt1', label: 'Fujifilm X-T1', spacing: 1, text: 'X-T1' },
  { file: 'fujifilm-xt2', label: 'Fujifilm X-T2', spacing: 1, text: 'X-T2' },
  { file: 'fujifilm-xt3', label: 'Fujifilm X-T3', spacing: 1, text: 'X-T3' },
  { file: 'fujifilm-xt4', label: 'Fujifilm X-T4', spacing: 1, text: 'X-T4' },
  { file: 'fujifilm-xt5', label: 'Fujifilm X-T5', spacing: 1, text: 'X-T5' },
  { file: 'fujifilm-xt50', label: 'Fujifilm X-T50', spacing: 1, text: 'X-T50' },
  { file: 'fujifilm-xt30', label: 'Fujifilm X-T30', spacing: 1, text: 'X-T30' },
  { file: 'fujifilm-xt30m2', label: 'Fujifilm X-T30 II', spacing: 1, text: 'X-T30 II' },
  { file: 'fujifilm-xt20', label: 'Fujifilm X-T20', spacing: 1, text: 'X-T20' },
  { file: 'fujifilm-xt10', label: 'Fujifilm X-T10', spacing: 1, text: 'X-T10' },
  { file: 'fujifilm-xh1', label: 'Fujifilm X-H1', spacing: 1, text: 'X-H1' },
  { file: 'fujifilm-xh2', label: 'Fujifilm X-H2', spacing: 1, text: 'X-H2' },
  { file: 'fujifilm-xh2s', label: 'Fujifilm X-H2S', spacing: 1, text: 'X-H2S' },
  { file: 'fujifilm-xs10', label: 'Fujifilm X-S10', spacing: 1, text: 'X-S10' },
  { file: 'fujifilm-xs20', label: 'Fujifilm X-S20', spacing: 1, text: 'X-S20' },
  { file: 'fujifilm-xe4', label: 'Fujifilm X-E4', spacing: 1, text: 'X-E4' },
  { file: 'fujifilm-xe3', label: 'Fujifilm X-E3', spacing: 1, text: 'X-E3' },
  { file: 'fujifilm-xpro2', label: 'Fujifilm X-Pro2', spacing: 1, text: 'X-Pro2' },
  { file: 'fujifilm-xpro1', label: 'Fujifilm X-Pro1', spacing: 1, text: 'X-Pro1' },
  { file: 'fujifilm-xt200', label: 'Fujifilm X-T200', spacing: 1, text: 'X-T200' },
  { file: 'fujifilm-xa7', label: 'Fujifilm X-A7', spacing: 1, text: 'X-A7' },
  { file: 'fujifilm-gfx100rf', label: 'Fujifilm GFX100RF', spacing: 1, text: 'GFX100RF' },
  { file: 'fujifilm-xpro3', label: 'Fujifilm X-Pro3', spacing: 1, text: 'X-Pro3' },
  { file: 'fujifilm-xm5', label: 'Fujifilm X-M5', spacing: 1, text: 'X-M5' },
  { file: 'fujifilm-x100f', label: 'Fujifilm X100F', spacing: 1, text: 'X100F' },
  { file: 'fujifilm-x100', label: 'Fujifilm X100', spacing: 1, text: 'X100' },
  { file: 'fujifilm-xe2', label: 'Fujifilm X-E2', spacing: 1, text: 'X-E2' },
  { file: 'fujifilm-x100t', label: 'Fujifilm X100T', spacing: 1, text: 'X100T' },
  { file: 'fujifilm-x100s', label: 'Fujifilm X100S', spacing: 1, text: 'X100S' },
  { file: 'fujifilm-x100v', label: 'Fujifilm X100V', spacing: 1, text: 'X100V' },
  { file: 'fujifilm-x100vi', label: 'Fujifilm X100VI', spacing: 1, text: 'X100VI' },
  { file: 'fujifilm-gfx100', label: 'Fujifilm GFX100', spacing: 1, text: 'GFX100' },
  { file: 'fujifilm-gfx100s', label: 'Fujifilm GFX100S', spacing: 1, text: 'GFX100S' },
  { file: 'fujifilm-gfx100s2', label: 'Fujifilm GFX100S II', spacing: 1, text: 'GFX100S II' },
  { file: 'fujifilm-gfx1002', label: 'Fujifilm GFX100 II', spacing: 1, text: 'GFX100 II' },
  { file: 'fujifilm-gfx50s', label: 'Fujifilm GFX 50S', spacing: 1, text: 'GFX 50S' },
  { file: 'fujifilm-gfx50r', label: 'Fujifilm GFX 50R', spacing: 1, text: 'GFX 50R' },
  { file: 'fujifilm-gfx50s2', label: 'Fujifilm GFX 50S II', spacing: 1, text: 'GFX 50S II' },

  // ===== Panasonic Lumix（宽字距）=====
  { file: 'lumix-s5', label: 'Panasonic Lumix S5', spacing: 5, text: 'S5' },
  { file: 'lumix-s5m2', label: 'Panasonic Lumix S5 II', spacing: 5, text: 'S5 II' },
  { file: 'lumix-s5m2x', label: 'Panasonic Lumix S5 II X', spacing: 5, text: 'S5 II X' },
  { file: 'lumix-s9', label: 'Panasonic Lumix S9', spacing: 5, text: 'S9' },
  { file: 'lumix-s1', label: 'Panasonic Lumix S1', spacing: 5, text: 'S1' },
  { file: 'lumix-s1r', label: 'Panasonic Lumix S1R', spacing: 5, text: 'S1R' },
  { file: 'lumix-s1h', label: 'Panasonic Lumix S1H', spacing: 5, text: 'S1H' },
  { file: 'lumix-s1m2', label: 'Panasonic Lumix S1 II', spacing: 5, text: 'S1 II' },
  { file: 'lumix-s1m2e', label: 'Panasonic Lumix S1 II E', spacing: 5, text: 'S1 II E' },
  { file: 'lumix-s1rm2', label: 'Panasonic Lumix S1R II', spacing: 5, text: 'S1R II' },
  { file: 'lumix-gh5', label: 'Panasonic Lumix GH5', spacing: 5, text: 'GH5' },
  { file: 'lumix-gh5s', label: 'Panasonic Lumix GH5S', spacing: 5, text: 'GH5S' },
  { file: 'lumix-gh4', label: 'Panasonic Lumix GH4', spacing: 5, text: 'GH4' },
  { file: 'lumix-gh3', label: 'Panasonic Lumix GH3', spacing: 5, text: 'GH3' },
  { file: 'lumix-gh5m2', label: 'Panasonic Lumix GH5 II', spacing: 5, text: 'GH5 II' },
  { file: 'lumix-gh6', label: 'Panasonic Lumix GH6', spacing: 5, text: 'GH6' },
  { file: 'lumix-gh7', label: 'Panasonic Lumix GH7', spacing: 5, text: 'GH7' },
  { file: 'lumix-g9', label: 'Panasonic Lumix G9', spacing: 5, text: 'G9' },
  { file: 'lumix-g9m2', label: 'Panasonic Lumix G9 II', spacing: 5, text: 'G9 II' },
  { file: 'lumix-g85', label: 'Panasonic Lumix G85', spacing: 5, text: 'G85' },
  { file: 'lumix-g7', label: 'Panasonic Lumix G7', spacing: 5, text: 'G7' },
  { file: 'lumix-gx85', label: 'Panasonic Lumix GX85', spacing: 5, text: 'GX85' },
  { file: 'lumix-gx9', label: 'Panasonic Lumix GX9', spacing: 5, text: 'GX9' },
  { file: 'lumix-gx8', label: 'Panasonic Lumix GX8', spacing: 5, text: 'GX8' },
  { file: 'lumix-lx100', label: 'Panasonic Lumix LX100', spacing: 5, text: 'LX100' },
  { file: 'lumix-lx100m2', label: 'Panasonic Lumix LX100 II', spacing: 5, text: 'LX100 II' },

  // ===== OM System / Olympus =====
  { file: 'om-om1', label: 'OM System OM-1', spacing: 2, text: 'OM-1' },
  { file: 'om-om1m2', label: 'OM System OM-1 Mark II', spacing: 2, text: 'OM-1 Mark II' },
  { file: 'om-om5', label: 'OM System OM-5', spacing: 2, text: 'OM-5' },
  { file: 'om-om5m2', label: 'OM System OM-5 Mark II', spacing: 2, text: 'OM-5 Mark II' },
  { file: 'om-em1', label: 'Olympus OM-D E-M1', spacing: 1, text: 'E-M1' },
  { file: 'om-em1x', label: 'Olympus OM-D E-M1X', spacing: 1, text: 'E-M1X' },
  { file: 'om-em1m2', label: 'Olympus OM-D E-M1 II', spacing: 1, text: 'E-M1 II' },
  { file: 'om-em1m3', label: 'Olympus OM-D E-M1 III', spacing: 1, text: 'E-M1 III' },
  { file: 'om-em5', label: 'Olympus OM-D E-M5', spacing: 1, text: 'E-M5' },
  { file: 'om-em5m2', label: 'Olympus OM-D E-M5 II', spacing: 1, text: 'E-M5 II' },
  { file: 'om-em5m3', label: 'Olympus OM-D E-M5 III', spacing: 1, text: 'E-M5 III' },
  { file: 'om-em10m3', label: 'Olympus OM-D E-M10 III', spacing: 1, text: 'E-M10 III' },
  { file: 'om-em10m4', label: 'Olympus OM-D E-M10 IV', spacing: 1, text: 'E-M10 IV' },
  { file: 'om-em10', label: 'Olympus OM-D E-M10', spacing: 1, text: 'E-M10' },
  { file: 'om-em10m2', label: 'Olympus OM-D E-M10 II', spacing: 1, text: 'E-M10 II' },
  { file: 'om-epl10', label: 'Olympus PEN E-PL10', spacing: 1, text: 'E-PL10' },
  { file: 'om-epl9', label: 'Olympus PEN E-PL9', spacing: 1, text: 'E-PL9' },
  { file: 'om-epl8', label: 'Olympus PEN E-PL8', spacing: 1, text: 'E-PL8' },
  { file: 'om-ep7', label: 'Olympus PEN E-P7', spacing: 1, text: 'E-P7' },
  { file: 'om-tg5', label: 'Olympus Tough TG-5', spacing: 1, text: 'TG-5' },
  { file: 'om-tg6', label: 'Olympus Tough TG-6', spacing: 1, text: 'TG-6' },
  { file: 'om-tg7', label: 'Olympus Tough TG-7', spacing: 1, text: 'TG-7' },
  { file: 'om-penf', label: 'Olympus PEN-F', spacing: 2, text: 'PEN-F' },

  // ===== Pentax =====
  { file: 'pentax-k1', label: 'Pentax K-1', spacing: 1, text: 'K-1' },
  { file: 'pentax-k1m2', label: 'Pentax K-1 Mark II', spacing: 1, text: 'K-1 II' },
  { file: 'pentax-k3m2', label: 'Pentax K-3 II', spacing: 1, text: 'K-3 II' },
  { file: 'pentax-k3', label: 'Pentax K-3', spacing: 1, text: 'K-3' },
  { file: 'pentax-k5m2', label: 'Pentax K-5 II', spacing: 1, text: 'K-5 II' },
  { file: 'pentax-k3m3', label: 'Pentax K-3 Mark III', spacing: 1, text: 'K-3 III' },
  { file: 'pentax-kp', label: 'Pentax KP', spacing: 1, text: 'KP' },
  { file: 'pentax-k70', label: 'Pentax K-70', spacing: 1, text: 'K-70' },
  { file: 'pentax-k50', label: 'Pentax K-50', spacing: 1, text: 'K-50' },
  { file: 'pentax-ks2', label: 'Pentax K-S2', spacing: 1, text: 'K-S2' },
  { file: 'pentax-645z', label: 'Pentax 645Z', spacing: 1, text: '645Z' },

  // ===== Leica（宽字距、细字重）=====
  { file: 'leica-m8', label: 'Leica M8', weight: 500, spacing: 8, text: 'M8' },
  { file: 'leica-m9', label: 'Leica M9', weight: 500, spacing: 8, text: 'M9' },
  { file: 'leica-m240', label: 'Leica M Typ 240', weight: 500, spacing: 8, text: 'M' },
  { file: 'leica-m10', label: 'Leica M10', weight: 500, spacing: 8, text: 'M10' },
  { file: 'leica-m10r', label: 'Leica M10-R', weight: 500, spacing: 8, text: 'M10-R' },
  { file: 'leica-m10p', label: 'Leica M10-P', weight: 500, spacing: 8, text: 'M10-P' },
  { file: 'leica-m10m', label: 'Leica M10 Monochrom', weight: 500, spacing: 8, text: 'M10 Monochrom' },
  { file: 'leica-m11', label: 'Leica M11', weight: 500, spacing: 8, text: 'M11' },
  { file: 'leica-m11p', label: 'Leica M11-P', weight: 500, spacing: 8, text: 'M11-P' },
  { file: 'leica-m11m', label: 'Leica M11 Monochrom', weight: 500, spacing: 8, text: 'M11 Monochrom' },
  { file: 'leica-q', label: 'Leica Q', weight: 500, spacing: 8, text: 'Q' },
  { file: 'leica-q2', label: 'Leica Q2', weight: 500, spacing: 8, text: 'Q2' },
  { file: 'leica-q2m', label: 'Leica Q2 Monochrom', weight: 500, spacing: 8, text: 'Q2 Monochrom' },
  { file: 'leica-q3', label: 'Leica Q3', weight: 500, spacing: 8, text: 'Q3' },
  { file: 'leica-q343', label: 'Leica Q3 43', weight: 500, spacing: 8, text: 'Q3 43' },
  { file: 'leica-sl', label: 'Leica SL', weight: 500, spacing: 8, text: 'SL' },
  { file: 'leica-sl2', label: 'Leica SL2', weight: 500, spacing: 8, text: 'SL2' },
  { file: 'leica-sl2s', label: 'Leica SL2-S', weight: 500, spacing: 8, text: 'SL2-S' },
  { file: 'leica-sl3', label: 'Leica SL3', weight: 500, spacing: 8, text: 'SL3' },
  { file: 'leica-cl', label: 'Leica CL', weight: 500, spacing: 8, text: 'CL' },
  { file: 'leica-dlux7', label: 'Leica D-Lux 7', weight: 500, spacing: 8, text: 'D-Lux 7' },
  { file: 'leica-dlux8', label: 'Leica D-Lux 8', weight: 500, spacing: 8, text: 'D-Lux 8' },

  // ===== DJI =====
  { file: 'dji-mavic3', label: 'DJI Mavic 3', spacing: 1, text: 'Mavic 3' },
  { file: 'dji-mavic3pro', label: 'DJI Mavic 3 Pro', spacing: 1, text: 'Mavic 3 Pro' },
  { file: 'dji-mavic4pro', label: 'DJI Mavic 4 Pro', spacing: 1, text: 'Mavic 4 Pro' },
  { file: 'dji-mavic3classic', label: 'DJI Mavic 3 Classic', spacing: 1, text: 'Mavic 3 Classic' },
  { file: 'dji-mavic2pro', label: 'DJI Mavic 2 Pro', spacing: 1, text: 'Mavic 2 Pro' },
  { file: 'dji-mavic2zoom', label: 'DJI Mavic 2 Zoom', spacing: 1, text: 'Mavic 2 Zoom' },
  { file: 'dji-mavicpro', label: 'DJI Mavic Pro', spacing: 1, text: 'Mavic Pro' },
  { file: 'dji-mavicair', label: 'DJI Mavic Air', spacing: 1, text: 'Mavic Air' },
  { file: 'dji-mavicmini', label: 'DJI Mavic Mini', spacing: 1, text: 'Mavic Mini' },
  { file: 'dji-spark', label: 'DJI Spark', spacing: 1, text: 'Spark' },
  { file: 'dji-pocket2', label: 'DJI Osmo Pocket 2', spacing: 1, text: 'Pocket 2' },
  { file: 'dji-mavicair2', label: 'DJI Mavic Air 2', spacing: 1, text: 'Mavic Air 2' },
  { file: 'dji-air2s', label: 'DJI Air 2S', spacing: 1, text: 'Air 2S' },
  { file: 'dji-air3', label: 'DJI Air 3', spacing: 1, text: 'Air 3' },
  { file: 'dji-air3s', label: 'DJI Air 3S', spacing: 1, text: 'Air 3S' },
  { file: 'dji-mini4pro', label: 'DJI Mini 4 Pro', spacing: 1, text: 'Mini 4 Pro' },
  { file: 'dji-mini3', label: 'DJI Mini 3', spacing: 1, text: 'Mini 3' },
  { file: 'dji-mini3pro', label: 'DJI Mini 3 Pro', spacing: 1, text: 'Mini 3 Pro' },
  { file: 'dji-mini2', label: 'DJI Mini 2', spacing: 1, text: 'Mini 2' },
  { file: 'dji-mini2se', label: 'DJI Mini 2 SE', spacing: 1, text: 'Mini 2 SE' },
  { file: 'dji-minise', label: 'DJI Mini SE', spacing: 1, text: 'Mini SE' },
  { file: 'dji-pocket3', label: 'DJI Osmo Pocket 3', spacing: 1, text: 'Pocket 3' },

  // ===== Ricoh GR =====
  { file: 'ricoh-gr2', label: 'Ricoh GR II', weight: 700, spacing: 4, text: 'GR II' },
  { file: 'ricoh-gr3', label: 'Ricoh GR III', weight: 700, spacing: 4, text: 'GR III' },
  { file: 'ricoh-gr3x', label: 'Ricoh GR IIIx', weight: 700, spacing: 4, text: 'GR IIIx' },

  // ===== Sigma =====
  { file: 'sigma-fp', label: 'Sigma fp', weight: 600, spacing: 1, text: 'fp' },
  { file: 'sigma-fpl', label: 'Sigma fp L', weight: 600, spacing: 1, text: 'fp L' },
  { file: 'sigma-bf', label: 'Sigma BF', weight: 600, spacing: 1, text: 'BF' },

  // ===== Hasselblad =====
  { file: 'hasselblad-907x', label: 'Hasselblad 907X & CFV 100C', weight: 500, spacing: 2, text: '907X & CFV 100C' },
  { file: 'hasselblad-x2d', label: 'Hasselblad X2D 100C', weight: 500, spacing: 2, text: 'X2D 100C' },
  { file: 'hasselblad-x1d', label: 'Hasselblad X1D-50c', weight: 500, spacing: 2, text: 'X1D-50c' },
  { file: 'hasselblad-x1dm2', label: 'Hasselblad X1D II 50C', weight: 500, spacing: 2, text: 'X1D II 50C' },
]

// =====================================================================
// Nikon Z 合成字标（官方字形 + 官方排版比例）
// 字形来源（均取自 Wikimedia Commons 官方 Nikon logo 矢量，原样嵌入路径数据）：
//   Z ←「Nikon Z 9 (logo).svg」、5/0 ←「Nikon.Z50.logo.svg」、6 ←「Nikon.Z6.logo.svg」、
//   7 ←「Nikon.Z7.logo.svg」、8 ←「Nikon D850 (logo).svg」、II ←「Nikon Z50ii logo.svg」
// 排版比例按各官方文件相对其自身 Z 的高度（H）实测：
//   数字高 ≈ 0.667~0.690×H（圆弧字形 0.690，平顶 7 为 0.667）、
//   数字底部 ≈ +0.011×H（视觉过冲）、首个数字距 Z 右缘 0.36×H、
//   数字间距 0.098×H、II 高 0.591×H 与数字底对齐 Z 底、距前字形 0.149×H。
// =====================================================================
const Z_GLYPHS = {
  Z: {
    bbox: [0, 0, 291.5, 246.7],
    d: 'M118.5,221.8999939l169.7000122-201V0h-277.5v24.7000008h159L0,225.6999969v21h291.5v-24.8000031H118.5z M253.3000031,24.5L86.6999969,221.8999939H34.7999954L201.4999847,24.7000008L253.3000031,24.5z',
  },
  5: {
    bbox: [394.4, 89.6, 98.9, 168.3],
    hRatio: 0.6781, bottomOff: 0.0113,
    d: 'M439.8,151c-9.5,0-16.8,1.2-21.4,2.4l1.4-44.3h68.8V89.6h-91.1l-1.4,87c8.8-3.8,17.8-6.2,32-6.2 c22.3,0,40.1,11.6,40.1,35.3c0,21.1-19,32.7-38.7,32.7c-14.5,0-24.2-2.6-34.4-8.3l-0.7,22.3c5.9,2.1,17.6,5.5,35.6,5.5 c34.4,0,63.3-19.4,63.3-55.7C513.5,172.8,489,151,439.8,151z',
  },
  6: {
    bbox: [488.7, 108.6, 137.4, 216.4],
    hRatio: 0.6893, bottomOff: 0.0115,
    d: 'M559.335999,214.397797c-24.850037,0-38.917908,18.582474-38.917908,41.968506 c0,19.787018,12.275757,44.06424,36.817322,44.06424c25.148743,0,37.12085-21.57431,37.12085-44.06424 C594.356262,236.87796,582.981506,214.397797,559.335999,214.397797 M612.316956,141.855118 c-10.777405-5.694672-23.650452-8.696152-37.116028-8.696152c-38.913025,0-57.769714,35.975006-58.372009,76.141586 l0.602295-0.293793c14.06781-13.793716,28.434326-19.194611,45.792725-19.194611 c40.41626,0,62.862122,28.478424,62.862122,65.956787c0,43.168137-29.036682,69.247269-67.053589,69.247269 c-58.37204,0-70.339264-52.760498-70.339264-100.423737c0-56.658127,18.558044-116.014374,84.710663-116.014374 c14.366577,0,35.622498,3.29541,43.099609,6.595749L612.316956,141.855118z',
  },
  7: {
    bbox: [487.9, 112.0, 132.3, 208.9],
    hRatio: 0.6668, bottomOff: 0.0003,
    d: 'M620.126648,136.496002L542.918579,320.843658L510.008453,320.843658L589.601807,136.496002L487.856506,136.496002L487.856506,111.958832L620.126648,111.958832Z',
  },
  8: {
    bbox: [56.7, 0.0, 47.0, 66.4],
    hRatio: 0.6904, bottomOff: 0.0118,
    d: 'M100.1014404,34.5898972c-1.368042-1.7719955-3.1480103-3.2699966-5.2840576-4.4929962c1.3430176-0.9250031,2.493042-1.9700012,3.3830566-3.1480026c1.8889771-2.5,2.848999-5.4580002,2.848999-8.7919998c0-5.0960007-1.993042-9.4720001-5.9150391-13.0049973c-3.1599731-2.8359985-7.1950073-4.5310059-12.0009766-5.0400009l-1.0540161-0.1100006v11.7160034l0.5170288,0.1339951c1.4859619,0.3830032,2.4429932,0.7369995,3.2599487,1.5090027c1.5500488,1.4720001,2.15802,2.8059998,2.15802,4.7470016c0,1.9389954-0.6599731,3.4669952-2.072998,4.8050003c-1.4320068,1.3569946-3.3010254,2.0169983-5.7160034,2.0169983c-2.5100098,0-4.4279785-0.6669998-5.8709717-2.0350037c-1.4280396-1.3519974-2.092041-3.0029984-2.092041-5.1949997c0-1.7329941,0.5960083-2.9609985,2.1199951-4.3880005c0.8099976-0.7559967,1.7950439-1.0629959,3.1030273-1.4199982l0.473999-0.1269989V0.0038986l-1.026001,0.1060028c-4.7739868,0.5-8.7680054,2.1589966-11.8779907,4.9369965v0.0019989c-3.8690186,3.4580002-5.8289795,7.8030014-5.8289795,12.9020004c0,3.4460068,0.9699707,6.4670029,2.8799438,8.9840012c0.8780518,1.1500015,2.0010376,2.1669998,3.2990112,3.0680008c-1.973999,1.0960007-3.6599731,2.4630051-4.9909668,4.1180038c-2.4650269,3.0749969-3.7160034,6.9059982-3.7160034,11.3799973c0,5.9579964,2.2210083,11.0029984,6.6029663,14.9889984c3.585022,3.2609978,8.1719971,5.1930008,13.6370239,5.737999l1.0209961,0.0979996V54.4288979l-0.5230103-0.125c-0.9790039-0.2270012-1.9179688-0.5719986-2.7910156-1.0209999c-1.8969727-0.968998-4.7099609-2.4109993-4.9109497-7.7959976c-0.098999-2.6340027,0.8209839-4.8450012,2.8239746-6.7679977c1.9320068-1.8560028,4.367981-2.7600021,7.4509888-2.7600021c3.1849976,0,5.7160034,0.9219971,7.7369995,2.8190002c2.0029907,1.8799973,2.9349976,4.1080017,2.9349976,7.0119972c0,2.6010017-0.6879883,4.0870018-2.8339844,6.1080017c-1.4199829,1.3449974-3.098999,2.1689987-5.1359863,2.5259972l-0.632019,0.1130028v11.8200035l1.026001-0.0850067c5.6220093-0.4949951,10.3309937-2.4299965,14.0009766-5.7559967c4.3850098-3.9790001,6.6080322-8.9580002,6.6080322-14.8080025C103.7144165,41.4419022,102.4983521,37.7029037,100.1014404,34.5898972z',
  },
  II: {
    bbox: [115.3, 17.6, 20.2, 25.4],
    hRatio: 0.5907, bottomOff: 0.0,
    d: 'm115.2847,17.645207v0.821265c1.44445,0.156157,2.42012,0.350524,2.92763,0.779957c0.54655,0.468472,0.77996,1.522411,0.77996,3.123023v15.850191c0,1.678691-0.27245,2.771661-0.77996,3.123015c-0.46847,0.351354-1.44414,0.625394-2.92763,0.781551v0.897506h20.18207v-0.897506c-1.44445-0.156157-2.42036-0.430197-2.84979-0.781551c-0.54655-0.429432-0.77996-1.444324-0.77996-3.123015V22.369452c0,-1.600612,0.27244,-2.654551,0.77996,-3.123023c0.46847,-0.429433,1.44438,-0.701878,2.84979,-0.779957v-0.821265zm9.99334,1.172326h0.15568c1.17118,0,2.14766,0.974901,2.14766,2.146081v18.895371c0,1.17118-0.97648,2.147675-2.14766,2.147675h-0.15568c-1.17118,0-2.14767,-0.976495-2.14767,-2.147675V20.963614c0,-1.17118,0.97649,-2.146081,2.14767,-2.146081z',
  },
}

// 排版常量（×Z 高度 H）
const Z_LAYOUT = { firstGap: 0.36, digitGap: 0.098, romanGap: 0.149 }

// III 无官方单独字形：按 II 的几何（棒宽 / 棒距 / 圆角，比例取自 II bbox 实测）手绘三根圆角竖棒
function romanThreePath(hRoman) {
  const barW = (9.0 / 25.4) * hRoman
  const gap = (2.15 / 25.4) * hRoman
  const r = (2.9 / 25.4) * hRoman // 外圆角与官方 II 描摹版的圆角一致
  const h = hRoman
  const bars = [0, barW + gap, 2 * (barW + gap)].map(
    (dx) =>
      `M${dx + r},0h${barW - 2 * r}a${r},${r} 0 0 1 ${r},${r}v${h - 2 * r}a${r},${r} 0 0 1 -${r},${r}h-${barW - 2 * r}a${r},${r} 0 0 1 -${r},-${r}v-${h - 2 * r}a${r},${r} 0 0 1 ${r},-${r}z`,
  )
  return bars.join(' ')
}

/** 合成 Nikon Z 字标 SVG：官方 Z + 官方数字 / II（transform 对齐）+ 文本（无官方字形的 30） */
function zCompositeSvg(label, glyphs) {
  const H = Z_GLYPHS.Z.bbox[3]
  const WZ = Z_GLYPHS.Z.bbox[2]
  const m = 0.06 * H // 画布四周边距（> 管线 4% 内边距，避免裁剪钳制导致的不对称）
  let x = m + WZ + Z_LAYOUT.firstGap * H
  let trailingGap = Z_LAYOUT.digitGap * H
  const bottoms = [m + H]
  // Z 字形本身按原比例放在画布原点（排版常量均以 Z 自身坐标系定义）
  const shapes = [{ d: Z_GLYPHS.Z.d, tx: m, ty: m, scale: 1 }]
  const texts = []
  for (const g of glyphs) {
    if (g === 'III') {
      // III：按 II 的几何手绘三根圆角竖棒（无官方单独字形）
      const targetH = Z_GLYPHS.II.hRatio * H
      const bottom = m + H
      shapes.push({ d: romanThreePath(targetH), tx: x, ty: bottom - targetH, scale: 1 })
      x += 3 * (9.0 / 25.4) * targetH + 2 * (2.15 / 25.4) * targetH
      trailingGap = Z_LAYOUT.romanGap * H
      bottoms.push(bottom)
      continue
    }
    if (typeof g === 'string' && !Z_GLYPHS[g]) {
      // 无官方字形的数字串（如 30）：系统字体按数字标准高度渲染
      const digitH = 0.6904 * H
      texts.push({
        t: g, x, size: digitH / 0.7, spacing: 0.05 * H,
        baseline: m + H * 1.0118,
      })
      x += g.length * digitH * 0.75 + Z_LAYOUT.digitGap * H // 系统字宽估算：数字 advance ≤ 0.75em（宁宽勿窄）
      bottoms.push(m + H * 1.0118)
      continue
    }
    const src = Z_GLYPHS[g]
    const isRoman = g === 'II' || g === 'III'
    const targetH = (g === 'III' ? Z_GLYPHS.II.hRatio : src.hRatio ?? 0.69) * H
    const bottom = m + H * (1 + (src.bottomOff ?? 0.0118))
    const scale = targetH / src.bbox[3]
    const ty = bottom - (src.bbox[1] + src.bbox[3]) * scale
    const tx = x - src.bbox[0] * scale
    if (g === 'III') {
      shapes.push({ d: romanThreePath(targetH), tx, ty: bottom - targetH, scale: 1 })
      x += 3 * (9.0 / 25.4) * targetH + 2 * (2.15 / 25.4) * targetH
    } else {
      shapes.push({ d: src.d, tx, ty, scale })
      x += src.bbox[2] * scale + (isRoman ? Z_LAYOUT.romanGap : Z_LAYOUT.digitGap) * H
    }
    trailingGap = (isRoman ? Z_LAYOUT.romanGap : Z_LAYOUT.digitGap) * H
    bottoms.push(bottom)
  }
  let inkRight = x - trailingGap
  const inkBottom = Math.max(...bottoms)
  // 文本字形（系统字体）真实宽度不可控：右侧额外留白，避免管线按 viewBox 钳制裁掉墨迹
  if (texts.length) inkRight += 0.3 * H
  const body = shapes
    .map((s) => `<path transform="translate(${s.tx.toFixed(2)} ${s.ty.toFixed(2)}) scale(${s.scale.toFixed(5)})" d="${s.d}"/>`)
    .join('\n  ')
  const textEls = texts
    .map(
      (t) =>
        `<text x="${t.x.toFixed(2)}" y="${t.baseline.toFixed(2)}" font-family="${APP_FONT}" font-size="${t.size.toFixed(1)}" font-weight="600" letter-spacing="${t.spacing.toFixed(1)}" fill="#000000">${esc(t.t)}</text>`,
    )
    .join('\n  ')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${(inkRight + m).toFixed(1)} ${(inkBottom + m).toFixed(1)}">
  <!-- FrameLab 机型字标：${label}（官方 Z 字形 + 官方数字合成，gen-model-marks.mjs 维护） -->
  <g fill="#000000">
  ${body}
${textEls}
  </g>
</svg>
`
}

// =====================================================================
// 品牌矢量 + 机型文字锁排版
// 厂商公开的「单机型」矢量仅尼康 Z 系 / D850 / D780 / 佳能 5D·7D 存在（MANUAL_FILES）；
// 其余机型无官方机型字标矢量，字标改为「官方品牌矢量 + 机型文字」锁排版：
// 品牌图形取官方矢量（SimpleIcons CC0：src/assets/brands/；LUMIX / OM SYSTEM / OLYMPUS
// 单色取自 Wikimedia Commons 官方文件：scripts/brand-logos/），机型文字为系统字体排版。
// Sigma 无官方单色品牌矢量可用 → 纯文字。嵌入时剥离原 fill，统一继承 <g fill> 套色。
// =====================================================================
const BRAND_ASSET_FILES = {
  sony: 'src/assets/brands/sony.svg',
  canon: 'src/assets/brands/canon.svg',
  nikon: 'src/assets/brands/nikon.svg',
  fujifilm: 'src/assets/brands/fujifilm.svg',
  lumix: 'scripts/brand-logos/lumix.svg',
  olympus: 'scripts/brand-logos/olympus-mono.svg',
  omsystem: 'scripts/brand-logos/omsystem.svg',
  pentax: 'src/assets/brands/pentax.svg',
  leica: 'src/assets/brands/leica.svg',
  dji: 'src/assets/brands/dji.svg',
  ricoh: 'scripts/brand-logos/ricoh-mono.svg',
  hasselblad: 'src/assets/brands/hasselblad.svg',
}

function brandFor(m) {
  if (m.file.startsWith('sony-')) return 'sony'
  if (m.file.startsWith('canon-')) return 'canon'
  if (m.file.startsWith('nikon-')) return 'nikon'
  if (m.file.startsWith('fujifilm-')) return 'fujifilm'
  if (m.file.startsWith('lumix-')) return 'lumix'
  if (m.file.startsWith('om-')) return /^om-(om1|om5)/.test(m.file) ? 'omsystem' : 'olympus'
  if (m.file.startsWith('pentax-')) return 'pentax'
  if (m.file.startsWith('leica-')) return 'leica'
  if (m.file.startsWith('dji-')) return 'dji'
  if (m.file.startsWith('ricoh-')) return 'ricoh'
  if (m.file.startsWith('hasselblad-')) return 'hasselblad'
  return null // sigma 等：无官方单色品牌矢量，纯文字
}

// SVG path bbox（直线精确；C/S/Q/T 采样；A 圆弧端点→中心参数化采样）
function pathBbox(d) {
  const tokens = d.match(/[MmLlHhVvCcSsQqTtAaZz]|-?(?:\d*\.\d+|\d+)(?:[eE][+-]?\d+)?/g) ?? []
  let i = 0, cmd = ''
  let cx = 0, cy = 0, sx = 0, sy = 0, px, py, qx, qy
  const xs = [], ys = []
  const num = () => parseFloat(tokens[i++])
  const push = (x, y) => { xs.push(x); ys.push(y) }
  const cubic = (x1, y1, x2, y2, x3, y3) => {
    for (let k = 1; k <= 16; k++) {
      const t = k / 16, mt = 1 - t
      push(mt*mt*mt*cx + 3*mt*mt*t*x1 + 3*mt*t*t*x2 + t*t*t*x3, mt*mt*mt*cy + 3*mt*mt*t*y1 + 3*mt*t*t*y2 + t*t*t*y3)
    }
    cx = x3; cy = y3; px = x2; py = y2
  }
  const quad = (x1, y1, x2, y2) => {
    for (let k = 1; k <= 12; k++) {
      const t = k / 12, mt = 1 - t
      push(mt*mt*cx + 2*mt*t*x1 + t*t*x2, mt*mt*cy + 2*mt*t*y1 + t*t*y2)
    }
    cx = x2; cy = y2; qx = x1; qy = y1
  }
  const arc = (rx, ry, rotDeg, large, sweep, x2, y2) => {
    const x1 = cx, y1 = cy
    rx = Math.abs(rx); ry = Math.abs(ry)
    if (rx === 0 || ry === 0 || (x1 === x2 && y1 === y2)) { push(x2, y2); cx = x2; cy = y2; return }
    const phi = (rotDeg * Math.PI) / 180
    const cosP = Math.cos(phi), sinP = Math.sin(phi)
    const dx = (x1 - x2) / 2, dy = (y1 - y2) / 2
    const x1p = cosP * dx + sinP * dy, y1p = -sinP * dx + cosP * dy
    let rx2 = rx * rx, ry2 = ry * ry
    const lam = (x1p * x1p) / rx2 + (y1p * y1p) / ry2
    if (lam > 1) { const s = Math.sqrt(lam); rx *= s; ry *= s; rx2 = rx * rx; ry2 = ry * ry }
    const denom = Math.sqrt(rx2 * y1p * y1p + ry2 * x1p * x1p) || 1
    const sign = large !== sweep ? 1 : -1
    const co = sign * Math.sqrt(Math.max(0, (rx2 * ry2 - rx2 * y1p * y1p - ry2 * x1p * x1p) / (rx2 * y1p * y1p + ry2 * x1p * x1p)))
    const cxp = (co * rx * y1p) / ry, cyp = (-co * ry * x1p) / rx
    const ccx = cosP * cxp - sinP * cyp + (x1 + x2) / 2
    const ccy = sinP * cxp + cosP * cyp + (y1 + y2) / 2
    const angle = (ux, uy, vx, vy) => {
      const dot = ux * vx + uy * vy, len = Math.sqrt((ux*ux+uy*uy) * (vx*vx+vy*vy)) || 1
      let a = Math.acos(Math.min(1, Math.max(-1, dot / len)))
      if (ux * vy - uy * vx < 0) a = -a
      return a
    }
    const th1 = angle(1, 0, (x1p - cxp) / rx, (y1p - cyp) / ry)
    let dth = angle((x1p - cxp) / rx, (y1p - cyp) / ry, (-x1p - cxp) / rx, (-y1p - cyp) / ry)
    if (!sweep && dth > 0) dth -= 2 * Math.PI
    if (sweep && dth < 0) dth += 2 * Math.PI
    for (let k = 1; k <= 24; k++) {
      const th = th1 + (dth * k) / 24
      push(ccx + rx * Math.cos(th) * cosP - ry * Math.sin(th) * sinP, ccy + rx * Math.cos(th) * sinP + ry * Math.sin(th) * cosP)
    }
    cx = x2; cy = y2
  }
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) cmd = tokens[i++]
    const rel = cmd >= 'a' && cmd <= 'z'
    const C = cmd.toUpperCase()
    if (C === 'M') {
      let x = num(), y = num()
      if (rel) { x += cx; y += cy }
      cx = x; cy = y; sx = x; sy = y; push(x, y); cmd = rel ? 'l' : 'L'
    } else if (C === 'L') {
      let x = num(), y = num()
      if (rel) { x += cx; y += cy }
      cx = x; cy = y; push(x, y)
    } else if (C === 'H') {
      let x = num(); if (rel) x += cx
      cx = x; push(x, cy)
    } else if (C === 'V') {
      let y = num(); if (rel) y += cy
      cy = y; push(cx, y)
    } else if (C === 'C') {
      let a = [num(), num(), num(), num(), num(), num()]
      if (rel) a = [a[0]+cx, a[1]+cy, a[2]+cx, a[3]+cy, a[4]+cx, a[5]+cy]
      cubic(...a)
    } else if (C === 'S') {
      let a = [num(), num(), num(), num()]
      if (rel) a = [a[0]+cx, a[1]+cy, a[2]+cx, a[3]+cy]
      cubic(2*cx-(px??cx), 2*cy-(py??cy), a[0], a[1], a[2], a[3])
    } else if (C === 'Q') {
      let a = [num(), num(), num(), num()]
      if (rel) a = [a[0]+cx, a[1]+cy, a[2]+cx, a[3]+cy]
      quad(...a)
    } else if (C === 'T') {
      let a = [num(), num()]
      if (rel) a = [a[0]+cx, a[1]+cy]
      quad(2*cx-(qx??cx), 2*cy-(qy??cy), a[0], a[1])
    } else if (C === 'A') {
      let a = [num(), num(), num(), num(), num(), num(), num()]
      if (rel) { a[5] += cx; a[6] += cy }
      arc(...a)
    } else if (C === 'Z') {
      cx = sx; cy = sy
    } else {
      i++
    }
  }
  return { x: Math.min(...xs), y: Math.min(...ys), w: Math.max(...xs) - Math.min(...xs), h: Math.max(...ys) - Math.min(...ys) }
}

// 仿射矩阵工具（compose: a·b；apply: 点变换）
function matId() { return [1, 0, 0, 1, 0, 0] }
function matMul(a, b) {
  return [
    a[0]*b[0] + a[2]*b[1], a[1]*b[0] + a[3]*b[1],
    a[0]*b[2] + a[2]*b[3], a[1]*b[2] + a[3]*b[3],
    a[0]*b[4] + a[2]*b[5] + a[4], a[1]*b[4] + a[3]*b[5] + a[5],
  ]
}
function matApply(m, x, y) { return [m[0]*x + m[2]*y + m[4], m[1]*x + m[3]*y + m[5]] }
function parseTransform(str) {
  let m = matId()
  const re = /(translate|scale|matrix|rotate)\s*\(([^)]*)\)/g
  let t
  while ((t = re.exec(str))) {
    const args = t[2].trim().split(/[\s,]+/).map(Number)
    let n = null
    if (t[1] === 'translate') n = [1, 0, 0, 1, args[0] || 0, args[1] || 0]
    else if (t[1] === 'scale') n = [args[0] ?? 1, 0, 0, args[1] ?? args[0] ?? 1, 0, 0]
    else if (t[1] === 'matrix') n = args
    else if (t[1] === 'rotate') {
      const r = ((args[0] || 0) * Math.PI) / 180, c = Math.cos(r), s = Math.sin(r)
      n = [c, s, -s, c, 0, 0]
      if (args.length >= 3) {
        n = matMul(matMul([1, 0, 0, 1, args[1], args[2]], n), [1, 0, 0, 1, -args[1], -args[2]])
      }
    }
    if (n) m = matMul(m, n)
  }
  return m
}

// 解析品牌 SVG → { paths: [{d, tf}], bbox(全局墨迹边界) }（栈式累积 <g>/<svg> 变换）
function parseBrandSvg(file) {
  const text = readFileSync(join(root, file), 'utf8')
  const paths = []
  let m = matId(), stack = []
  const tagRe = /<(\/?)(g|svg|path)\b([^>]*)>/g
  let t
  while ((t = tagRe.exec(text))) {
    const close = t[1] === '/', tag = t[2], attrs = t[3] ?? ''
    if (tag === 'g' || tag === 'svg') {
      if (close) { m = stack.pop() ?? matId() } else { stack.push(m); m = matMul(m, parseTransform(attrs.match(/transform="([^"]*)"/)?.[1] ?? '')) }
      continue
    }
    if (close) continue
    const d = attrs.match(/\bd="([^"]+)"/)?.[1]
    if (!d) continue
    paths.push({ d, tf: m })
  }
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity
  for (const p of paths) {
    const b = pathBbox(p.d)
    for (const [cx, cy] of [[b.x, b.y], [b.x + b.w, b.y], [b.x, b.y + b.h], [b.x + b.w, b.y + b.h]]) {
      const [gx, gy] = matApply(p.tf, cx, cy)
      x0 = Math.min(x0, gx); y0 = Math.min(y0, gy); x1 = Math.max(x1, gx); y1 = Math.max(y1, gy)
    }
  }
  return { paths, bbox: { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } }
}

const brandCache = new Map()
function brandAsset(key) {
  if (!brandCache.has(key)) {
    const parsed = parseBrandSvg(BRAND_ASSET_FILES[key])
    if (!isFinite(parsed.bbox.x) || parsed.bbox.h <= 0) throw new Error(`品牌矢量解析失败: ${key}`)
    brandCache.set(key, parsed)
  }
  return brandCache.get(key)
}

function svgFor(m) {
  if (m.z) return zCompositeSvg(m.label, m.z)
  const parts = (m.parts ?? [{ t: m.text }])
    .map((p) => {
      const a = []
      if (p.size) a.push(`font-size="${p.size}"`)
      if (p.weight) a.push(`font-weight="${p.weight}"`)
      if (p.italic) a.push(`font-style="italic"`)
      return a.length ? `<tspan ${a.join(' ')}>${esc(p.t)}</tspan>` : `<tspan>${esc(p.t)}</tspan>`
    })
    .join('')
  const fontSize = m.size ?? 120
  const baseline = 200
  // 品牌锁排版：官方品牌矢量（墨高 = 机型文字大写字高）+ 机型文字
  const brand = brandFor(m) ? brandAsset(brandFor(m)) : null
  const capH = 0.7 * fontSize
  let textX = 40
  let viewBox = '0 0 1600 300'
  const brandShapes = []
  if (brand) {
    const brandH = capH
    const s = brandH / brand.bbox.h
    const startX = 40
    const gap = capH * 0.5
    const tx = startX - brand.bbox.x * s
    const ty = baseline - (brand.bbox.y + brand.bbox.h) * s
    for (const p of brand.paths) {
      // 路径自身（含组累积）变换序列化后追加在定位缩放之后（先应用原始变换，再套外层定位缩放）
      const isIdentity = p.tf.every((v, i) => v === matId()[i])
      const origTf = isIdentity ? '' : ` matrix(${p.tf.map((v) => +v.toFixed(6)).join(' ')})`
      brandShapes.push(`<path transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${s.toFixed(5)})${origTf}" d="${p.d}"/>`)
    }
    textX = startX + brand.bbox.w * s + gap
    viewBox = '0 0 4400 300'
  }
  const attrs = [
    `x="${textX.toFixed(1)}" y="${baseline}" text-anchor="start"`,
    `font-family="${m.family ?? APP_FONT}"`,
    `font-size="${fontSize}"`,
    `font-weight="${m.weight ?? 600}"`,
    m.italic ? 'font-style="italic"' : '',
    m.spacing != null ? `letter-spacing="${m.spacing}"` : '',
    'fill="#000000"',
  ]
    .filter(Boolean)
    .join(' ')
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}">
  <!-- FrameLab 机型字标：${m.label}${brand ? `（官方品牌矢量 + 文字锁排版）` : '（可替换为官方矢量字标，运行时自动裁剪边界并套色）'} -->
  <g fill="#000000">
  ${brandShapes.join('\n  ')}
  <text ${attrs}>${parts}</text>
  </g>
</svg>
`
}

mkdirSync(outDir, { recursive: true })
let written = 0
let skipped = 0
let manual = 0
for (const m of MARKS) {
  if (m.manual || MANUAL_FILES.has(m.file)) {
    manual++
    continue
  }
  const p = join(outDir, `${m.file}.svg`)
  if (existsSync(p) && !FORCE) {
    skipped++
    continue
  }
  writeFileSync(p, svgFor(m), 'utf8')
  written++
}
console.log(`机型字标生成完成：写入 ${written} 个，跳过已存在 ${skipped} 个，官方手动维护 ${manual} 个（--force 可强制重写非手动项）`)
console.log(`输出目录：${outDir}`)
