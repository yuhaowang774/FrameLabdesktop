// 机型字标（内置机型 SVG 矢量字标）注册表与查找。
// 资源：src/assets/models/*.svg（文字型由 scripts/gen-model-marks.mjs 生成；
// Nikon Z 系列 / D850 / D780 为官方矢量——Z 6/7/50/50II/9/f/fc/D780/D850 为官方锁排版
// 原文件，其余 Z 机型由脚本按官方字形与排版比例合成；渲染管线 src/core/svgMark.ts
// 自动裁剪边界并按机型文字色套色）。
// 查找键 = 机型营销名（modelAlias 输出）；查找时做品牌前缀剥离 / 代次括注清理 /
// 大小写不敏感 / 去空格连字符压缩（"Z8"→"Z 8"）/ ASCII "A"→"α"（"A7R V"→"α7R V"）
// 等宽容匹配，因此 EXIF 原文（"Canon EOS R5" / "ILCE-7RM5"）与用户手输简写均可命中。
import { modelAlias } from './modelAlias'
import { hexToRgba, footerTextColor } from './colorUtils'
import type { FrameConfig } from './types'

/**
 * 字标绘制高度 = 机型字号 × 该比例。
 * 字标画布自带 4% 内边距、墨迹占比 ≈ 92%，直接按字号高度绘制会比同字号文字明显偏大；
 * 0.84 使字标墨迹的视觉高度与文字基本一致（预览 / 导出 / 布局测宽三端共用本常量）。
 */
export const MODEL_MARK_SCALE = 0.84
/** 字标画布在「字号行高」内的上边距比例（上下各留 8%，视觉居中于文字行） */
export const MODEL_MARK_TOP_RATIO = 0.08

export interface ModelMarkDef {
  /** SVG 文件名（src/assets/models/<file>.svg） */
  file: string
  /** 机型说明（维护用） */
  label: string
}

/** 键 = 机型营销名（与 modelAlias 输出严格一致；`α` 等符号原样） */
export const MODEL_MARKS: Record<string, ModelMarkDef> = {
  // ===== Sony α =====
  'α1': { file: 'sony-a1', label: 'Sony α1' },
  'α1 II': { file: 'sony-a1m2', label: 'Sony α1 II' },
  'α9': { file: 'sony-a9', label: 'Sony α9' },
  'α9 II': { file: 'sony-a9m2', label: 'Sony α9 II' },
  'α9 III': { file: 'sony-a9m3', label: 'Sony α9 III' },
  'α7': { file: 'sony-a7', label: 'Sony α7' },
  'α7 II': { file: 'sony-a7m2', label: 'Sony α7 II' },
  'α7 III': { file: 'sony-a7m3', label: 'Sony α7 III' },
  'α7 IV': { file: 'sony-a7m4', label: 'Sony α7 IV' },
  'α7 V': { file: 'sony-a7m5', label: 'Sony α7 V' },
  'α7R': { file: 'sony-a7r', label: 'Sony α7R' },
  'α7R II': { file: 'sony-a7rm2', label: 'Sony α7R II' },
  'α7R III': { file: 'sony-a7rm3', label: 'Sony α7R III' },
  'α7R IV': { file: 'sony-a7rm4', label: 'Sony α7R IV' },
  'α7R V': { file: 'sony-a7r5', label: 'Sony α7R V' },
  'α7R VI': { file: 'sony-a7rm6', label: 'Sony α7R VI' },
  'α7S II': { file: 'sony-a7sm2', label: 'Sony α7S II' },
  'α7S III': { file: 'sony-a7sm3', label: 'Sony α7S III' },
  'α7C': { file: 'sony-a7c', label: 'Sony α7C' },
  'α7C II': { file: 'sony-a7cm2', label: 'Sony α7C II' },
  'α7C R': { file: 'sony-a7cr', label: 'Sony α7C R' },
  'α7S': { file: 'sony-a7s', label: 'Sony α7S' },
  'α5000': { file: 'sony-a5000', label: 'Sony α5000' },
  'α5100': { file: 'sony-a5100', label: 'Sony α5100' },
  'α6000': { file: 'sony-a6000', label: 'Sony α6000' },
  'α6100': { file: 'sony-a6100', label: 'Sony α6100' },
  'α6300': { file: 'sony-a6300', label: 'Sony α6300' },
  'α6400': { file: 'sony-a6400', label: 'Sony α6400' },
  'α6500': { file: 'sony-a6500', label: 'Sony α6500' },
  'α6600': { file: 'sony-a6600', label: 'Sony α6600' },
  'α6700': { file: 'sony-a6700', label: 'Sony α6700' },
  'FX2': { file: 'sony-fx2', label: 'Sony FX2' },
  'FX3': { file: 'sony-fx3', label: 'Sony FX3' },
  'FX30': { file: 'sony-fx30', label: 'Sony FX30' },
  'ZV-E10': { file: 'sony-zve10', label: 'Sony ZV-E10' },
  'ZV-E10 II': { file: 'sony-zve10m2', label: 'Sony ZV-E10 II' },
  'ZV-1': { file: 'sony-zv1', label: 'Sony ZV-1' },
  'ZV-1 II': { file: 'sony-zv1m2', label: 'Sony ZV-1 II' },
  'ZV-1F': { file: 'sony-zv1f', label: 'Sony ZV-1F' },
  'RX100': { file: 'sony-rx100', label: 'Sony RX100' },
  'RX100 II': { file: 'sony-rx100m2', label: 'Sony RX100 II' },
  'RX100 III': { file: 'sony-rx100m3', label: 'Sony RX100 III' },
  'RX100 IV': { file: 'sony-rx100m4', label: 'Sony RX100 IV' },
  'RX100 V': { file: 'sony-rx100m5', label: 'Sony RX100 V' },
  'RX100 VI': { file: 'sony-rx100m6', label: 'Sony RX100 VI' },
  'RX100 VII': { file: 'sony-rx100m7', label: 'Sony RX100 VII' },
  'RX10 II': { file: 'sony-rx10m2', label: 'Sony RX10 II' },
  'RX10 III': { file: 'sony-rx10m3', label: 'Sony RX10 III' },
  'RX10 IV': { file: 'sony-rx10m4', label: 'Sony RX10 IV' },
  'RX1R II': { file: 'sony-rx1rm2', label: 'Sony RX1R II' },
  'RX1R III': { file: 'sony-rx1rm3', label: 'Sony RX1R III' },
  // ===== Sony NEX 系 / A-mount 单电 =====
  'NEX-7': { file: 'sony-nex7', label: 'Sony NEX-7' },
  'NEX-6': { file: 'sony-nex6', label: 'Sony NEX-6' },
  'NEX-5T': { file: 'sony-nex5t', label: 'Sony NEX-5T' },
  'NEX-5N': { file: 'sony-nex5n', label: 'Sony NEX-5N' },
  'NEX-5R': { file: 'sony-nex5r', label: 'Sony NEX-5R' },
  'NEX-5': { file: 'sony-nex5', label: 'Sony NEX-5' },
  'NEX-3': { file: 'sony-nex3', label: 'Sony NEX-3' },
  'NEX-C3': { file: 'sony-nexc3', label: 'Sony NEX-C3' },
  'NEX-F3': { file: 'sony-nexf3', label: 'Sony NEX-F3' },
  'α77': { file: 'sony-a77', label: 'Sony α77' },
  'α77 II': { file: 'sony-a77m2', label: 'Sony α77 II' },
  'α99': { file: 'sony-a99', label: 'Sony α99' },
  'α99 II': { file: 'sony-a99m2', label: 'Sony α99 II' },
  // ===== Canon EOS（R 系 + 单反 + M 系；EXIF 带品牌前缀剥离后命中 EOS 键，手输简写命中裸键）=====
  'EOS R1': { file: 'canon-eosr1', label: 'Canon EOS R1' },
  'EOS R3': { file: 'canon-eosr3', label: 'Canon EOS R3' },
  'EOS R5': { file: 'canon-eosr5', label: 'Canon EOS R5' },
  'EOS R6': { file: 'canon-eosr6', label: 'Canon EOS R6' },
  'EOS R8': { file: 'canon-eosr8', label: 'Canon EOS R8' },
  'EOS R7': { file: 'canon-eosr7', label: 'Canon EOS R7' },
  'EOS R10': { file: 'canon-eosr10', label: 'Canon EOS R10' },
  'EOS R100': { file: 'canon-eosr100', label: 'Canon EOS R100' },
  'EOS R50': { file: 'canon-eosr50', label: 'Canon EOS R50' },
  'EOS RP': { file: 'canon-eosrp', label: 'Canon EOS RP' },
  'EOS R': { file: 'canon-eosr', label: 'Canon EOS R' },
  'EOS R5 Mark II': { file: 'canon-eosr5m2', label: 'Canon EOS R5 Mark II' },
  'EOS R5m2': { file: 'canon-eosr5m2', label: 'Canon EOS R5 Mark II' },
  'EOS R6 Mark II': { file: 'canon-eosr6m2', label: 'Canon EOS R6 Mark II' },
  'EOS R6m2': { file: 'canon-eosr6m2', label: 'Canon EOS R6 Mark II' },
  'EOS 5D Mark IV': { file: 'canon-eos5dm4', label: 'Canon EOS 5D Mark IV' },
  '5D Mark IV': { file: 'canon-eos5dm4', label: 'Canon EOS 5D Mark IV' },
  'EOS 5D Mark III': { file: 'canon-eos5dm3', label: 'Canon EOS 5D Mark III' },
  '5D Mark III': { file: 'canon-eos5dm3', label: 'Canon EOS 5D Mark III' },
  'EOS 5D Mark II': { file: 'canon-eos5dm2', label: 'Canon EOS 5D Mark II' },
  '5D Mark II': { file: 'canon-eos5dm2', label: 'Canon EOS 5D Mark II' },
  'EOS 5Ds': { file: 'canon-eos5ds', label: 'Canon EOS 5Ds' },
  '5Ds': { file: 'canon-eos5ds', label: 'Canon EOS 5Ds' },
  'EOS 5Ds R': { file: 'canon-eos5dsr', label: 'Canon EOS 5Ds R' },
  '5Ds R': { file: 'canon-eos5dsr', label: 'Canon EOS 5Ds R' },
  'EOS 5D': { file: 'canon-eos5d', label: 'Canon EOS 5D' },
  '5D': { file: 'canon-eos5d', label: 'Canon EOS 5D' },
  'EOS-1D X Mark III': { file: 'canon-eos1dxm3', label: 'Canon EOS-1D X Mark III' },
  '1D X Mark III': { file: 'canon-eos1dxm3', label: 'Canon EOS-1D X Mark III' },
  'EOS-1D X Mark II': { file: 'canon-eos1dxm2', label: 'Canon EOS-1D X Mark II' },
  '1D X Mark II': { file: 'canon-eos1dxm2', label: 'Canon EOS-1D X Mark II' },
  'EOS-1D X': { file: 'canon-eos1dx', label: 'Canon EOS-1D X' },
  '1D X': { file: 'canon-eos1dx', label: 'Canon EOS-1D X' },
  'EOS 200D': { file: 'canon-eos200d', label: 'Canon EOS 200D' },
  '200D': { file: 'canon-eos200d', label: 'Canon EOS 200D' },
  'EOS M100': { file: 'canon-eosm100', label: 'Canon EOS M100' },
  'M100': { file: 'canon-eosm100', label: 'Canon EOS M100' },
  'EOS 6D Mark II': { file: 'canon-eos6dm2', label: 'Canon EOS 6D Mark II' },
  '6D Mark II': { file: 'canon-eos6dm2', label: 'Canon EOS 6D Mark II' },
  'EOS 6D': { file: 'canon-eos6d', label: 'Canon EOS 6D' },
  '6D': { file: 'canon-eos6d', label: 'Canon EOS 6D' },
  'EOS 7D Mark II': { file: 'canon-eos7dm2', label: 'Canon EOS 7D Mark II' },
  '7D Mark II': { file: 'canon-eos7dm2', label: 'Canon EOS 7D Mark II' },
  'EOS 7D': { file: 'canon-eos7d', label: 'Canon EOS 7D' },
  '7D': { file: 'canon-eos7d', label: 'Canon EOS 7D' },
  'EOS 90D': { file: 'canon-eos90d', label: 'Canon EOS 90D' },
  '90D': { file: 'canon-eos90d', label: 'Canon EOS 90D' },
  'EOS 80D': { file: 'canon-eos80d', label: 'Canon EOS 80D' },
  '80D': { file: 'canon-eos80d', label: 'Canon EOS 80D' },
  'EOS 800D': { file: 'canon-eos800d', label: 'Canon EOS 800D' },
  '800D': { file: 'canon-eos800d', label: 'Canon EOS 800D' },
  'EOS 850D': { file: 'canon-eos850d', label: 'Canon EOS 850D' },
  '850D': { file: 'canon-eos850d', label: 'Canon EOS 850D' },
  'EOS 200D II': { file: 'canon-eos200dm2', label: 'Canon EOS 200D II' },
  '200D II': { file: 'canon-eos200dm2', label: 'Canon EOS 200D II' },
  'EOS M50': { file: 'canon-eosm50', label: 'Canon EOS M50' },
  'M50': { file: 'canon-eosm50', label: 'Canon EOS M50' },
  'EOS M50 Mark II': { file: 'canon-eosm50m2', label: 'Canon EOS M50 Mark II' },
  'M50 Mark II': { file: 'canon-eosm50m2', label: 'Canon EOS M50 Mark II' },
  'EOS M6': { file: 'canon-eosm6', label: 'Canon EOS M6' },
  'M6': { file: 'canon-eosm6', label: 'Canon EOS M6' },
  'EOS M6 Mark II': { file: 'canon-eosm6m2', label: 'Canon EOS M6 Mark II' },
  'M6 Mark II': { file: 'canon-eosm6m2', label: 'Canon EOS M6 Mark II' },
  'EOS M5': { file: 'canon-eosm5', label: 'Canon EOS M5' },
  'M5': { file: 'canon-eosm5', label: 'Canon EOS M5' },
  // ===== Canon PowerShot G 系 =====
  'PowerShot G7 X Mark II': { file: 'canon-g7xm2', label: 'Canon PowerShot G7 X Mark II' },
  'G7 X Mark II': { file: 'canon-g7xm2', label: 'Canon PowerShot G7 X Mark II' },
  'PowerShot G7 X Mark III': { file: 'canon-g7xm3', label: 'Canon PowerShot G7 X Mark III' },
  'G7 X Mark III': { file: 'canon-g7xm3', label: 'Canon PowerShot G7 X Mark III' },
  'PowerShot G7 X': { file: 'canon-g7x', label: 'Canon PowerShot G7 X' },
  'G7 X': { file: 'canon-g7x', label: 'Canon PowerShot G7 X' },
  'PowerShot G5 X Mark II': { file: 'canon-g5xm2', label: 'Canon PowerShot G5 X Mark II' },
  'G5 X Mark II': { file: 'canon-g5xm2', label: 'Canon PowerShot G5 X Mark II' },
  'PowerShot G9 X Mark II': { file: 'canon-g9xm2', label: 'Canon PowerShot G9 X Mark II' },
  'G9 X Mark II': { file: 'canon-g9xm2', label: 'Canon PowerShot G9 X Mark II' },
  // ===== Nikon Z（官方矢量 / 官方字形合成）=====
  'Z 5': { file: 'nikon-z5', label: 'Nikon Z 5' },
  'Z 5 II': { file: 'nikon-z5m2', label: 'Nikon Z 5II' },
  'Z 6': { file: 'nikon-z6', label: 'Nikon Z 6' },
  'Z 6 II': { file: 'nikon-z6m2', label: 'Nikon Z 6II' },
  'Z 6III': { file: 'nikon-z6iii', label: 'Nikon Z 6III' },
  'Z 7': { file: 'nikon-z7', label: 'Nikon Z 7' },
  'Z 7 II': { file: 'nikon-z7m2', label: 'Nikon Z 7II' },
  'Z 8': { file: 'nikon-z8', label: 'Nikon Z 8' },
  'Z 9': { file: 'nikon-z9', label: 'Nikon Z 9' },
  'Z f': { file: 'nikon-zf', label: 'Nikon Z f' },
  'Z fc': { file: 'nikon-zfc', label: 'Nikon Z fc' },
  'Z 30': { file: 'nikon-z30', label: 'Nikon Z 30' },
  'Z 50': { file: 'nikon-z50', label: 'Nikon Z 50' },
  'Z 50 II': { file: 'nikon-z50m2', label: 'Nikon Z 50II' },
  // ===== Nikon D（D850 / D780 官方矢量）=====
  'D850': { file: 'nikon-d850', label: 'Nikon D850' },
  'D780': { file: 'nikon-d780', label: 'Nikon D780' },
  'D6': { file: 'nikon-d6', label: 'Nikon D6' },
  'D5': { file: 'nikon-d5', label: 'Nikon D5' },
  'D4s': { file: 'nikon-d4s', label: 'Nikon D4s' },
  'D300s': { file: 'nikon-d300s', label: 'Nikon D300s' },
  'D810': { file: 'nikon-d810', label: 'Nikon D810' },
  'D800': { file: 'nikon-d800', label: 'Nikon D800' },
  'D700': { file: 'nikon-d700', label: 'Nikon D700' },
  'D610': { file: 'nikon-d610', label: 'Nikon D610' },
  'D600': { file: 'nikon-d600', label: 'Nikon D600' },
  'D90': { file: 'nikon-d90', label: 'Nikon D90' },
  'D500': { file: 'nikon-d500', label: 'Nikon D500' },
  'D750': { file: 'nikon-d750', label: 'Nikon D750' },
  'D7500': { file: 'nikon-d7500', label: 'Nikon D7500' },
  'D7200': { file: 'nikon-d7200', label: 'Nikon D7200' },
  'D7100': { file: 'nikon-d7100', label: 'Nikon D7100' },
  'D7000': { file: 'nikon-d7000', label: 'Nikon D7000' },
  'D5600': { file: 'nikon-d5600', label: 'Nikon D5600' },
  'D5300': { file: 'nikon-d5300', label: 'Nikon D5300' },
  'D3500': { file: 'nikon-d3500', label: 'Nikon D3500' },
  'D3400': { file: 'nikon-d3400', label: 'Nikon D3400' },
  'D3300': { file: 'nikon-d3300', label: 'Nikon D3300' },
  'D3200': { file: 'nikon-d3200', label: 'Nikon D3200' },
  'Df': { file: 'nikon-df', label: 'Nikon Df' },
  'COOLPIX P1000': { file: 'nikon-p1000', label: 'Nikon Coolpix P1000' },
  'P1000': { file: 'nikon-p1000', label: 'Nikon Coolpix P1000' },
  'COOLPIX P950': { file: 'nikon-p950', label: 'Nikon Coolpix P950' },
  'P950': { file: 'nikon-p950', label: 'Nikon Coolpix P950' },
  // ===== Fujifilm X / GFX =====
  'X-T1': { file: 'fujifilm-xt1', label: 'Fujifilm X-T1' },
  'X-T2': { file: 'fujifilm-xt2', label: 'Fujifilm X-T2' },
  'X-T3': { file: 'fujifilm-xt3', label: 'Fujifilm X-T3' },
  'X-T4': { file: 'fujifilm-xt4', label: 'Fujifilm X-T4' },
  'X-T5': { file: 'fujifilm-xt5', label: 'Fujifilm X-T5' },
  'X-T50': { file: 'fujifilm-xt50', label: 'Fujifilm X-T50' },
  'X-T30': { file: 'fujifilm-xt30', label: 'Fujifilm X-T30' },
  'X-T30 II': { file: 'fujifilm-xt30m2', label: 'Fujifilm X-T30 II' },
  'X-T20': { file: 'fujifilm-xt20', label: 'Fujifilm X-T20' },
  'X-T10': { file: 'fujifilm-xt10', label: 'Fujifilm X-T10' },
  'X-H2': { file: 'fujifilm-xh2', label: 'Fujifilm X-H2' },
  'X-H2S': { file: 'fujifilm-xh2s', label: 'Fujifilm X-H2S' },
  'X-H1': { file: 'fujifilm-xh1', label: 'Fujifilm X-H1' },
  'X-S10': { file: 'fujifilm-xs10', label: 'Fujifilm X-S10' },
  'X-S20': { file: 'fujifilm-xs20', label: 'Fujifilm X-S20' },
  'X-E4': { file: 'fujifilm-xe4', label: 'Fujifilm X-E4' },
  'X-E3': { file: 'fujifilm-xe3', label: 'Fujifilm X-E3' },
  'X-E2': { file: 'fujifilm-xe2', label: 'Fujifilm X-E2' },
  'X-Pro2': { file: 'fujifilm-xpro2', label: 'Fujifilm X-Pro2' },
  'X-Pro1': { file: 'fujifilm-xpro1', label: 'Fujifilm X-Pro1' },
  'X-T200': { file: 'fujifilm-xt200', label: 'Fujifilm X-T200' },
  'X-A7': { file: 'fujifilm-xa7', label: 'Fujifilm X-A7' },
  'GFX100RF': { file: 'fujifilm-gfx100rf', label: 'Fujifilm GFX100RF' },
  'X-Pro3': { file: 'fujifilm-xpro3', label: 'Fujifilm X-Pro3' },
  'X-M5': { file: 'fujifilm-xm5', label: 'Fujifilm X-M5' },
  'X100': { file: 'fujifilm-x100', label: 'Fujifilm X100' },
  'X100F': { file: 'fujifilm-x100f', label: 'Fujifilm X100F' },
  'X100T': { file: 'fujifilm-x100t', label: 'Fujifilm X100T' },
  'X100S': { file: 'fujifilm-x100s', label: 'Fujifilm X100S' },
  'X100V': { file: 'fujifilm-x100v', label: 'Fujifilm X100V' },
  'X100VI': { file: 'fujifilm-x100vi', label: 'Fujifilm X100VI' },
  'GFX100': { file: 'fujifilm-gfx100', label: 'Fujifilm GFX100' },
  'GFX100S': { file: 'fujifilm-gfx100s', label: 'Fujifilm GFX100S' },
  'GFX100S II': { file: 'fujifilm-gfx100s2', label: 'Fujifilm GFX100S II' },
  'GFX100 II': { file: 'fujifilm-gfx1002', label: 'Fujifilm GFX100 II' },
  'GFX 50S': { file: 'fujifilm-gfx50s', label: 'Fujifilm GFX 50S' },
  'GFX 50R': { file: 'fujifilm-gfx50r', label: 'Fujifilm GFX 50R' },
  'GFX 50S II': { file: 'fujifilm-gfx50s2', label: 'Fujifilm GFX 50S II' },
  // ===== Panasonic Lumix（带 / 不带 Lumix 前缀均可命中）=====
  'Lumix S5': { file: 'lumix-s5', label: 'Panasonic Lumix S5' },
  'S5': { file: 'lumix-s5', label: 'Panasonic Lumix S5' },
  'Lumix S5 II': { file: 'lumix-s5m2', label: 'Panasonic Lumix S5 II' },
  'S5 II': { file: 'lumix-s5m2', label: 'Panasonic Lumix S5 II' },
  'Lumix S5 II X': { file: 'lumix-s5m2x', label: 'Panasonic Lumix S5 II X' },
  'S5 II X': { file: 'lumix-s5m2x', label: 'Panasonic Lumix S5 II X' },
  'Lumix S9': { file: 'lumix-s9', label: 'Panasonic Lumix S9' },
  'S9': { file: 'lumix-s9', label: 'Panasonic Lumix S9' },
  'Lumix S1': { file: 'lumix-s1', label: 'Panasonic Lumix S1' },
  'S1': { file: 'lumix-s1', label: 'Panasonic Lumix S1' },
  'Lumix S1R': { file: 'lumix-s1r', label: 'Panasonic Lumix S1R' },
  'S1R': { file: 'lumix-s1r', label: 'Panasonic Lumix S1R' },
  'Lumix S1H': { file: 'lumix-s1h', label: 'Panasonic Lumix S1H' },
  'S1H': { file: 'lumix-s1h', label: 'Panasonic Lumix S1H' },
  'Lumix S1 II': { file: 'lumix-s1m2', label: 'Panasonic Lumix S1 II' },
  'S1 II': { file: 'lumix-s1m2', label: 'Panasonic Lumix S1 II' },
  'Lumix S1 II E': { file: 'lumix-s1m2e', label: 'Panasonic Lumix S1 II E' },
  'S1 II E': { file: 'lumix-s1m2e', label: 'Panasonic Lumix S1 II E' },
  'Lumix S1R II': { file: 'lumix-s1rm2', label: 'Panasonic Lumix S1R II' },
  'S1R II': { file: 'lumix-s1rm2', label: 'Panasonic Lumix S1R II' },
  'Lumix GH5': { file: 'lumix-gh5', label: 'Panasonic Lumix GH5' },
  'GH5': { file: 'lumix-gh5', label: 'Panasonic Lumix GH5' },
  'Lumix GH5S': { file: 'lumix-gh5s', label: 'Panasonic Lumix GH5S' },
  'GH5S': { file: 'lumix-gh5s', label: 'Panasonic Lumix GH5S' },
  'Lumix GH4': { file: 'lumix-gh4', label: 'Panasonic Lumix GH4' },
  'GH4': { file: 'lumix-gh4', label: 'Panasonic Lumix GH4' },
  'Lumix GH5 II': { file: 'lumix-gh5m2', label: 'Panasonic Lumix GH5 II' },
  'GH5 II': { file: 'lumix-gh5m2', label: 'Panasonic Lumix GH5 II' },
  'Lumix GH6': { file: 'lumix-gh6', label: 'Panasonic Lumix GH6' },
  'GH6': { file: 'lumix-gh6', label: 'Panasonic Lumix GH6' },
  'Lumix GH7': { file: 'lumix-gh7', label: 'Panasonic Lumix GH7' },
  'GH7': { file: 'lumix-gh7', label: 'Panasonic Lumix GH7' },
  'Lumix G9': { file: 'lumix-g9', label: 'Panasonic Lumix G9' },
  'G9': { file: 'lumix-g9', label: 'Panasonic Lumix G9' },
  'Lumix G9 II': { file: 'lumix-g9m2', label: 'Panasonic Lumix G9 II' },
  'G9 II': { file: 'lumix-g9m2', label: 'Panasonic Lumix G9 II' },
  'Lumix G85': { file: 'lumix-g85', label: 'Panasonic Lumix G85' },
  'G85': { file: 'lumix-g85', label: 'Panasonic Lumix G85' },
  'Lumix G7': { file: 'lumix-g7', label: 'Panasonic Lumix G7' },
  'G7': { file: 'lumix-g7', label: 'Panasonic Lumix G7' },
  'Lumix GX85': { file: 'lumix-gx85', label: 'Panasonic Lumix GX85' },
  'GX85': { file: 'lumix-gx85', label: 'Panasonic Lumix GX85' },
  'Lumix GH3': { file: 'lumix-gh3', label: 'Panasonic Lumix GH3' },
  'GH3': { file: 'lumix-gh3', label: 'Panasonic Lumix GH3' },
  'Lumix GX9': { file: 'lumix-gx9', label: 'Panasonic Lumix GX9' },
  'GX9': { file: 'lumix-gx9', label: 'Panasonic Lumix GX9' },
  'Lumix GX8': { file: 'lumix-gx8', label: 'Panasonic Lumix GX8' },
  'GX8': { file: 'lumix-gx8', label: 'Panasonic Lumix GX8' },
  'Lumix LX100': { file: 'lumix-lx100', label: 'Panasonic Lumix LX100' },
  'LX100': { file: 'lumix-lx100', label: 'Panasonic Lumix LX100' },
  'Lumix LX100 II': { file: 'lumix-lx100m2', label: 'Panasonic Lumix LX100 II' },
  'LX100 II': { file: 'lumix-lx100m2', label: 'Panasonic Lumix LX100 II' },
  // ===== OM System / Olympus =====
  'OM-1': { file: 'om-om1', label: 'OM System OM-1' },
  'OM-1 Mark II': { file: 'om-om1m2', label: 'OM System OM-1 Mark II' },
  'OM-5': { file: 'om-om5', label: 'OM System OM-5' },
  'OM-5 Mark II': { file: 'om-om5m2', label: 'OM System OM-5 Mark II' },
  'OM-D E-M1': { file: 'om-em1', label: 'Olympus OM-D E-M1' },
  'E-M1': { file: 'om-em1', label: 'Olympus OM-D E-M1' },
  'OM-D E-M1X': { file: 'om-em1x', label: 'Olympus OM-D E-M1X' },
  'E-M1X': { file: 'om-em1x', label: 'Olympus OM-D E-M1X' },
  'OM-D E-M1 II': { file: 'om-em1m2', label: 'Olympus OM-D E-M1 II' },
  'E-M1 II': { file: 'om-em1m2', label: 'Olympus OM-D E-M1 II' },
  'OM-D E-M1 III': { file: 'om-em1m3', label: 'Olympus OM-D E-M1 III' },
  'E-M1 III': { file: 'om-em1m3', label: 'Olympus OM-D E-M1 III' },
  'OM-D E-M5': { file: 'om-em5', label: 'Olympus OM-D E-M5' },
  'E-M5': { file: 'om-em5', label: 'Olympus OM-D E-M5' },
  'OM-D E-M5 II': { file: 'om-em5m2', label: 'Olympus OM-D E-M5 II' },
  'E-M5 II': { file: 'om-em5m2', label: 'Olympus OM-D E-M5 II' },
  'OM-D E-M5 III': { file: 'om-em5m3', label: 'Olympus OM-D E-M5 III' },
  'E-M5 III': { file: 'om-em5m3', label: 'Olympus OM-D E-M5 III' },
  'OM-D E-M10': { file: 'om-em10', label: 'Olympus OM-D E-M10' },
  'E-M10': { file: 'om-em10', label: 'Olympus OM-D E-M10' },
  'OM-D E-M10 II': { file: 'om-em10m2', label: 'Olympus OM-D E-M10 II' },
  'E-M10 II': { file: 'om-em10m2', label: 'Olympus OM-D E-M10 II' },
  'OM-D E-M10 III': { file: 'om-em10m3', label: 'Olympus OM-D E-M10 III' },
  'E-M10 III': { file: 'om-em10m3', label: 'Olympus OM-D E-M10 III' },
  'OM-D E-M10 IV': { file: 'om-em10m4', label: 'Olympus OM-D E-M10 IV' },
  'E-M10 IV': { file: 'om-em10m4', label: 'Olympus OM-D E-M10 IV' },
  'PEN E-PL10': { file: 'om-epl10', label: 'Olympus PEN E-PL10' },
  'E-PL10': { file: 'om-epl10', label: 'Olympus PEN E-PL10' },
  'PEN E-PL9': { file: 'om-epl9', label: 'Olympus PEN E-PL9' },
  'E-PL9': { file: 'om-epl9', label: 'Olympus PEN E-PL9' },
  'PEN E-PL8': { file: 'om-epl8', label: 'Olympus PEN E-PL8' },
  'E-PL8': { file: 'om-epl8', label: 'Olympus PEN E-PL8' },
  'PEN E-P7': { file: 'om-ep7', label: 'Olympus PEN E-P7' },
  'E-P7': { file: 'om-ep7', label: 'Olympus PEN E-P7' },
  'TG-5': { file: 'om-tg5', label: 'Olympus Tough TG-5' },
  'TG-6': { file: 'om-tg6', label: 'Olympus Tough TG-6' },
  'TG-7': { file: 'om-tg7', label: 'Olympus Tough TG-7' },
  'PEN-F': { file: 'om-penf', label: 'Olympus PEN-F' },
  // ===== Pentax =====
  'K-1': { file: 'pentax-k1', label: 'Pentax K-1' },
  'K-1 Mark II': { file: 'pentax-k1m2', label: 'Pentax K-1 Mark II' },
  'K-1 II': { file: 'pentax-k1m2', label: 'Pentax K-1 Mark II' },
  'K-3 II': { file: 'pentax-k3m2', label: 'Pentax K-3 II' },
  'K-3': { file: 'pentax-k3', label: 'Pentax K-3' },
  'K-5 II': { file: 'pentax-k5m2', label: 'Pentax K-5 II' },
  'K-3 Mark III': { file: 'pentax-k3m3', label: 'Pentax K-3 Mark III' },
  'K-3 III': { file: 'pentax-k3m3', label: 'Pentax K-3 Mark III' },
  'KP': { file: 'pentax-kp', label: 'Pentax KP' },
  'K-70': { file: 'pentax-k70', label: 'Pentax K-70' },
  'K-50': { file: 'pentax-k50', label: 'Pentax K-50' },
  'K-S2': { file: 'pentax-ks2', label: 'Pentax K-S2' },
  '645Z': { file: 'pentax-645z', label: 'Pentax 645Z' },
  // ===== Leica =====
  'M8': { file: 'leica-m8', label: 'Leica M8' },
  'M9': { file: 'leica-m9', label: 'Leica M9' },
  'M': { file: 'leica-m240', label: 'Leica M Typ 240' },
  'M10': { file: 'leica-m10', label: 'Leica M10' },
  'M10-R': { file: 'leica-m10r', label: 'Leica M10-R' },
  'M10-P': { file: 'leica-m10p', label: 'Leica M10-P' },
  'M10 Monochrom': { file: 'leica-m10m', label: 'Leica M10 Monochrom' },
  'M11': { file: 'leica-m11', label: 'Leica M11' },
  'M11-P': { file: 'leica-m11p', label: 'Leica M11-P' },
  'M11 Monochrom': { file: 'leica-m11m', label: 'Leica M11 Monochrom' },
  'Q': { file: 'leica-q', label: 'Leica Q' },
  'Q2': { file: 'leica-q2', label: 'Leica Q2' },
  'Q2 Monochrom': { file: 'leica-q2m', label: 'Leica Q2 Monochrom' },
  'Q3': { file: 'leica-q3', label: 'Leica Q3' },
  'Q3 43': { file: 'leica-q343', label: 'Leica Q3 43' },
  'SL': { file: 'leica-sl', label: 'Leica SL' },
  'SL2': { file: 'leica-sl2', label: 'Leica SL2' },
  'SL2-S': { file: 'leica-sl2s', label: 'Leica SL2-S' },
  'SL3': { file: 'leica-sl3', label: 'Leica SL3' },
  'CL': { file: 'leica-cl', label: 'Leica CL' },
  'D-Lux 7': { file: 'leica-dlux7', label: 'Leica D-Lux 7' },
  'D-Lux 8': { file: 'leica-dlux8', label: 'Leica D-Lux 8' },
  // ===== DJI（带 / 不带 DJI 前缀均可命中）=====
  'DJI Mavic 3': { file: 'dji-mavic3', label: 'DJI Mavic 3' },
  'DJI Mavic 3 Pro': { file: 'dji-mavic3pro', label: 'DJI Mavic 3 Pro' },
  'Mavic 3 Pro': { file: 'dji-mavic3pro', label: 'DJI Mavic 3 Pro' },
  'DJI Mavic 4 Pro': { file: 'dji-mavic4pro', label: 'DJI Mavic 4 Pro' },
  'Mavic 4 Pro': { file: 'dji-mavic4pro', label: 'DJI Mavic 4 Pro' },
  'DJI Mavic 3 Classic': { file: 'dji-mavic3classic', label: 'DJI Mavic 3 Classic' },
  'Mavic 3 Classic': { file: 'dji-mavic3classic', label: 'DJI Mavic 3 Classic' },
  'DJI Mavic 2 Pro': { file: 'dji-mavic2pro', label: 'DJI Mavic 2 Pro' },
  'Mavic 2 Pro': { file: 'dji-mavic2pro', label: 'DJI Mavic 2 Pro' },
  'DJI Mavic 2 Zoom': { file: 'dji-mavic2zoom', label: 'DJI Mavic 2 Zoom' },
  'Mavic 2 Zoom': { file: 'dji-mavic2zoom', label: 'DJI Mavic 2 Zoom' },
  'DJI Mavic Pro': { file: 'dji-mavicpro', label: 'DJI Mavic Pro' },
  'Mavic Pro': { file: 'dji-mavicpro', label: 'DJI Mavic Pro' },
  'DJI Mavic Air': { file: 'dji-mavicair', label: 'DJI Mavic Air' },
  'Mavic Air': { file: 'dji-mavicair', label: 'DJI Mavic Air' },
  'DJI Mavic Mini': { file: 'dji-mavicmini', label: 'DJI Mavic Mini' },
  'Mavic Mini': { file: 'dji-mavicmini', label: 'DJI Mavic Mini' },
  'DJI Spark': { file: 'dji-spark', label: 'DJI Spark' },
  'DJI Mavic Air 2': { file: 'dji-mavicair2', label: 'DJI Mavic Air 2' },
  'Mavic Air 2': { file: 'dji-mavicair2', label: 'DJI Mavic Air 2' },
  'DJI Air 2S': { file: 'dji-air2s', label: 'DJI Air 2S' },
  'Air 2S': { file: 'dji-air2s', label: 'DJI Air 2S' },
  'DJI Air 3': { file: 'dji-air3', label: 'DJI Air 3' },
  'Air 3': { file: 'dji-air3', label: 'DJI Air 3' },
  'DJI Air 3S': { file: 'dji-air3s', label: 'DJI Air 3S' },
  'Air 3S': { file: 'dji-air3s', label: 'DJI Air 3S' },
  'DJI Mini 4 Pro': { file: 'dji-mini4pro', label: 'DJI Mini 4 Pro' },
  'DJI Mini 3': { file: 'dji-mini3', label: 'DJI Mini 3' },
  'Mini 3': { file: 'dji-mini3', label: 'DJI Mini 3' },
  'DJI Mini 3 Pro': { file: 'dji-mini3pro', label: 'DJI Mini 3 Pro' },
  'Mini 3 Pro': { file: 'dji-mini3pro', label: 'DJI Mini 3 Pro' },
  'DJI Mini 2': { file: 'dji-mini2', label: 'DJI Mini 2' },
  'Mini 2': { file: 'dji-mini2', label: 'DJI Mini 2' },
  'DJI Mini 2 SE': { file: 'dji-mini2se', label: 'DJI Mini 2 SE' },
  'Mini 2 SE': { file: 'dji-mini2se', label: 'DJI Mini 2 SE' },
  'DJI Mini SE': { file: 'dji-minise', label: 'DJI Mini SE' },
  'Mini SE': { file: 'dji-minise', label: 'DJI Mini SE' },
  'Osmo Pocket 3': { file: 'dji-pocket3', label: 'DJI Osmo Pocket 3' },
  'Osmo Pocket 2': { file: 'dji-pocket2', label: 'DJI Osmo Pocket 2' },
  'Pocket 2': { file: 'dji-pocket2', label: 'DJI Osmo Pocket 2' },
  // ===== Ricoh =====
  'GR II': { file: 'ricoh-gr2', label: 'Ricoh GR II' },
  'GR III': { file: 'ricoh-gr3', label: 'Ricoh GR III' },
  'GR IIIx': { file: 'ricoh-gr3x', label: 'Ricoh GR IIIx' },
  // ===== Sigma =====
  'fp': { file: 'sigma-fp', label: 'Sigma fp' },
  'fp L': { file: 'sigma-fpl', label: 'Sigma fp L' },
  'BF': { file: 'sigma-bf', label: 'Sigma BF' },
  // ===== Hasselblad =====
  '907X & CFV 100C': { file: 'hasselblad-907x', label: 'Hasselblad 907X & CFV 100C' },
  'X2D 100C': { file: 'hasselblad-x2d', label: 'Hasselblad X2D 100C' },
  'X1D-50c': { file: 'hasselblad-x1d', label: 'Hasselblad X1D-50c' },
  'X1D 50C': { file: 'hasselblad-x1d', label: 'Hasselblad X1D-50c' },
  'X1D II 50C': { file: 'hasselblad-x1dm2', label: 'Hasselblad X1D II 50C' },
}

// 大小写不敏感索引（维护稳定性：键按原样书写，查找统一大写比对）
const MARKS_UPPER: Record<string, ModelMarkDef> = {}
for (const [k, v] of Object.entries(MODEL_MARKS)) MARKS_UPPER[k.toUpperCase()] = v

// 压缩索引（去空格 / 连字符后大写比对）：兼容 "Z8" / "Z6III" / "XT5" / "S5IIX" 等手输简写
const MARKS_SQUASH: Record<string, ModelMarkDef> = {}
for (const [k, v] of Object.entries(MODEL_MARKS)) {
  const q = k.toUpperCase().replace(/[\s-]+/g, '')
  // 首个命中优先（同键多写法指向同一文件，无实际冲突）
  MARKS_SQUASH[q] ??= v
}

/** 相机品牌前缀（EXIF Model 含品牌名时剥离后再查表，如 "Canon EOS R5" → "EOS R5"） */
const CAMERA_BRAND_PREFIX_RE =
  /^(CANON|SONY|NIKON|FUJIFILM|PANASONIC|LUMIX|LEICA|OLYMPUS|OM SYSTEM|PENTAX|RICOH|DJI|HASSELBLAD|SIGMA|ZEISS)\s+/i

/** 候选键归一化：代次下划线（Nikon "Z 6_2"）与型号括注（Leica "M11 (Typ 2416)"）清理 */
function normalizeKey(s: string): string {
  return s
    .replace(/\s*\([^)]*\)\s*$/, '')
    .replace(/_2$/i, ' II')
    .replace(/_3$/i, ' III')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * 机型 → 字标定义；未收录返回 null。
 * 候选顺序：原文 → 营销名（modelAlias）→ 品牌前缀剥离后的上述两者 → 归一化变体
 * → ASCII "A/a"→"α" 变体（"A7R V"→"α7R V"）。
 */
export function modelMarkOf(model?: string): ModelMarkDef | null {
  if (!model) return null
  const raw = model.trim()
  if (!raw) return null
  const candidates = new Set<string>()
  const add = (s: string) => {
    if (!s) return
    candidates.add(s)
    candidates.add(normalizeKey(s))
    // ASCII 首字母 A → α（Sony 手输习惯："A7R V" / "a7r v"）
    const alpha = s.replace(/(^|\s)[Aa](?=\d)/g, '$1α')
    if (alpha !== s) {
      candidates.add(alpha)
      candidates.add(normalizeKey(alpha))
    }
  }
  add(raw)
  add(modelAlias(raw))
  const stripped = raw.replace(CAMERA_BRAND_PREFIX_RE, '')
  if (stripped !== raw) {
    add(stripped)
    add(modelAlias(stripped))
  }
  for (const c of candidates) {
    const exact = MODEL_MARKS[c]
    if (exact) return exact
  }
  for (const c of candidates) {
    const hit = MARKS_UPPER[c.toUpperCase()]
    if (hit) return hit
  }
  for (const c of candidates) {
    const hit = MARKS_SQUASH[c.toUpperCase().replace(/[\s-]+/g, '')]
    if (hit) return hit
  }
  return null
}

/** 机型字标套色色值（与机型文字同色）：自定义色优先，否则随背景自适应黑白（全不透明，透明度由绘制端控制） */
export function modelMarkTintColor(cfg: FrameConfig): string {
  return hexToRgba(cfg.cameraModelColor, 1) ?? footerTextColor(cfg.bgMode, cfg.bgColor, 1)
}

/** 当前配置下是否应渲染机型字标（开关关 → null，未收录 → null） */
export function activeModelMark(cfg: FrameConfig): ModelMarkDef | null {
  if (cfg.modelMark === false) return null
  return modelMarkOf(cfg.cameraModel)
}
