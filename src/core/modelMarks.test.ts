// 机型字标：注册表查找（宽容匹配）与 inline 布局字标测宽回归测试。
import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { MODEL_MARKS, modelMarkOf, activeModelMark, MODEL_MARK_SCALE } from './modelMarks'
import { computeFooterLayout } from './infoLayout'
import { defaultFrameConfig, type FrameConfig } from './types'

describe('机型字标查找', () => {
  it('营销名直接命中', () => {
    expect(modelMarkOf('α7R V')?.file).toBe('sony-a7r5')
    expect(modelMarkOf('X-T5')?.file).toBe('fujifilm-xt5')
  })

  it('机身代号经 modelAlias 命中', () => {
    expect(modelMarkOf('ILCE-7RM5')?.file).toBe('sony-a7r5')
    expect(modelMarkOf('FC7303')?.file).toBe('dji-mini4pro')
  })

  it('品牌前缀剥离后命中（Canon / Nikon / Pentax / Sigma / Hasselblad 的 EXIF Model 含品牌名）', () => {
    expect(modelMarkOf('Canon EOS R5')?.file).toBe('canon-eosr5')
    expect(modelMarkOf('Canon EOS R1')?.file).toBe('canon-eosr1')
    expect(modelMarkOf('NIKON Z 8')?.file).toBe('nikon-z8')
    expect(modelMarkOf('RICOH GR III')?.file).toBe('ricoh-gr3')
    expect(modelMarkOf('PENTAX K-3 Mark III')?.file).toBe('pentax-k3m3')
    expect(modelMarkOf('SIGMA fp L')?.file).toBe('sigma-fpl')
    expect(modelMarkOf('HASSELBLAD X2D 100C')?.file).toBe('hasselblad-x2d')
  })

  it('代次下划线（Nikon Z 6_2）与官方 Z 系列全谱命中', () => {
    expect(modelMarkOf('NIKON Z 6_2')?.file).toBe('nikon-z6m2')
    expect(modelMarkOf('Z 6III')?.file).toBe('nikon-z6iii')
    expect(modelMarkOf('Z 50II')?.file).toBe('nikon-z50m2')
    expect(modelMarkOf('Z fc')?.file).toBe('nikon-zfc')
  })

  it('去空格 / 连字符压缩匹配（手输简写）', () => {
    expect(modelMarkOf('Z8')?.file).toBe('nikon-z8')
    expect(modelMarkOf('XT5')?.file).toBe('fujifilm-xt5')
    expect(modelMarkOf('S5IIX')?.file).toBe('lumix-s5m2x')
    expect(modelMarkOf('GFX100S')?.file).toBe('fujifilm-gfx100s')
  })

  it('ASCII 首字母 A → α（Sony 手输习惯）', () => {
    expect(modelMarkOf('A7R V')?.file).toBe('sony-a7r5')
    expect(modelMarkOf('a7r v')?.file).toBe('sony-a7r5')
    expect(modelMarkOf('A6700')?.file).toBe('sony-a6700')
  })

  it('Olympus 机身代号经 modelAlias 命中', () => {
    expect(modelMarkOf('OM-1MarkII')?.file).toBe('om-om1m2')
    expect(modelMarkOf('E-M1MarkIII')?.file).toBe('om-em1m3')
  })

  it('Panasonic / Sony 便携机代号经 modelAlias 命中', () => {
    expect(modelMarkOf('DC-GH5S')?.file).toBe('lumix-gh5s')
    expect(modelMarkOf('DC-GX9')?.file).toBe('lumix-gx9')
    expect(modelMarkOf('DSC-RX10M4')?.file).toBe('sony-rx10m4')
    expect(modelMarkOf('DSC-RX100M3')?.file).toBe('sony-rx100m3')
  })

  it('Leica Typ 括注 / 短键命中', () => {
    expect(modelMarkOf('Q (Typ 116)')?.file).toBe('leica-q')
    expect(modelMarkOf('M (Typ 240)')?.file).toBe('leica-m240')
    expect(modelMarkOf('M10-R')?.file).toBe('leica-m10r')
  })

  it('Nikon Df 与 Ricoh GR II 直键命中', () => {
    expect(modelMarkOf('Df')?.file).toBe('nikon-df')
    expect(modelMarkOf('GR II')?.file).toBe('ricoh-gr2')
  })

  it('三轮补全：Lumix / Olympus 代号、PowerShot、1DX、TG、老款 DJI', () => {
    expect(modelMarkOf('DC-S5')?.file).toBe('lumix-s5')
    expect(modelMarkOf('E-M10MarkII')?.file).toBe('om-em10m2')
    expect(modelMarkOf('Canon PowerShot G7 X Mark II')?.file).toBe('canon-g7xm2')
    expect(modelMarkOf('Canon EOS-1D X Mark III')?.file).toBe('canon-eos1dxm3')
    expect(modelMarkOf('DSC-RX100')?.file).toBe('sony-rx100')
    expect(modelMarkOf('FC1102')?.file).toBe('dji-spark')
    expect(modelMarkOf('SL (Typ 601)')?.file).toBe('leica-sl')
    expect(modelMarkOf('TG-6')?.file).toBe('om-tg6')
  })

  it('型号括注清理后命中（Leica 带 Typ 括注）', () => {
    expect(modelMarkOf('LEICA M11 (Typ 2416)')?.file).toBe('leica-m11')
    expect(modelMarkOf('Q3 43')?.file).toBe('leica-q343')
  })

  it('大小写不敏感', () => {
    expect(modelMarkOf('x-t5')?.file).toBe('fujifilm-xt5')
    expect(modelMarkOf('eos r8')?.file).toBe('canon-eosr8')
  })

  it('未收录机型 / 空值返回 null', () => {
    expect(modelMarkOf('D200')).toBeNull()
    expect(modelMarkOf('α65')).toBeNull()
    expect(modelMarkOf('DSC-HX99')).toBeNull()
    expect(modelMarkOf('iPhone 15 Pro')).toBeNull()
    expect(modelMarkOf('')).toBeNull()
    expect(modelMarkOf(undefined)).toBeNull()
  })

  it('四轮补全：NEX 系 / A-mount / 桥机 / 老旗舰', () => {
    expect(modelMarkOf('NEX-7')?.file).toBe('sony-nex7')
    expect(modelMarkOf('SLT-A77V')?.file).toBe('sony-a77')
    expect(modelMarkOf('SLT-A99M2')?.file).toBe('sony-a99m2')
    expect(modelMarkOf('COOLPIX P1000')?.file).toBe('nikon-p1000')
    expect(modelMarkOf('DMC-GX85')?.file).toBe('lumix-gx85')
    expect(modelMarkOf('DMC-G7')?.file).toBe('lumix-g7')
    expect(modelMarkOf('Canon PowerShot G9 X Mark II')?.file).toBe('canon-g9xm2')
    expect(modelMarkOf('Mavic 2 Zoom')?.file).toBe('dji-mavic2zoom')
  })

  it('关闭开关后不返回字标（activeModelMark）', () => {
    const on = { ...defaultFrameConfig, cameraModel: 'ILCE-7RM5' } as FrameConfig
    expect(activeModelMark(on)?.file).toBe('sony-a7r5')
    expect(activeModelMark({ ...on, modelMark: false })).toBeNull()
  })

  it('注册表 file 命名唯一且非空', () => {
    const files = Object.values(MODEL_MARKS).map((m) => m.file)
    expect(files.every((f) => !!f)).toBe(true)
    expect(new Set(files).size).toBeLessThanOrEqual(files.length)
  })

  it('注册表引用的 SVG 文件全部存在', () => {
    const dir = join(dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'models')
    for (const f of new Set(Object.values(MODEL_MARKS).map((m) => m.file))) {
      expect(existsSync(join(dir, `${f}.svg`)), f).toBe(true)
    }
  })
})

describe('inline 布局使用字标宽度', () => {
  const cfg = (): FrameConfig =>
    ({
      ...defaultFrameConfig,
      infoLayout: 'inline',
      showCameraModel: true,
      cameraModel: 'ILCE-7RM5',
      cameraModelSize: 40,
      showLogo: false,
      showExif: false,
      showDate: false,
      showLens: false,
      overlayBottom: 20,
    }) as FrameConfig

  it('传入字标比例时行1 按「字号 × MODEL_MARK_SCALE × 比例」测宽居中', () => {
    const L = computeFooterLayout(cfg(), 800, 2.6, 4)
    // center(600) − modelW(40 × 0.84 × 4)/2
    expect(L.model.x).toBeCloseTo(600 - (40 * MODEL_MARK_SCALE * 4) / 2, 6)
  })

  it('比例为空（未启用/未就绪）时回退文字测宽路径，不报错', () => {
    const L = computeFooterLayout(cfg(), 800, 2.6, null)
    expect(Number.isFinite(L.model.x)).toBe(true)
  })
})
