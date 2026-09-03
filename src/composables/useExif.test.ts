// 日期格式化与反解：切换「日期格式」下拉时对各类日期文本的重排行为
// INFO 缺失回填：模板应用对空与「自定义」占位字段的恢复行为（按钮的全量覆盖语义不经过此函数）
import { describe, expect, it } from 'vitest'
import { backfillInfoFromRaw, formatDate, isInfoMissing, parseDisplayDate } from './useExif'

describe('formatDate', () => {
  it('EXIF 原始串按四种格式输出', () => {
    const raw = '2026:08:27 10:30:00'
    expect(formatDate(raw, 'date')).toBe('2026/08/27')
    expect(formatDate(raw, 'datetime')).toBe('2026/08/27 10:30')
    expect(formatDate(raw, 'dash')).toBe('2026-08-27 10:30')
    expect(formatDate(raw, 'zh')).toBe('2026年8月27日')
  })

  it('无时间原始串只出日期；空值返回空串；非日期文本原样返回', () => {
    expect(formatDate('2026:08:27', 'datetime')).toBe('2026/08/27')
    expect(formatDate(undefined, 'date')).toBe('')
    expect(formatDate('秋天', 'date')).toBe('秋天')
  })

  it('en 英文杂志式：月份缩写大写 + 序数词后缀（11-13 均为 th）', () => {
    expect(formatDate('2026:06:10', 'en')).toBe('JUN 10th, 2026')
    expect(formatDate('2026:01:01', 'en')).toBe('JAN 1st, 2026')
    expect(formatDate('2026:02:02', 'en')).toBe('FEB 2nd, 2026')
    expect(formatDate('2026:03:03', 'en')).toBe('MAR 3rd, 2026')
    expect(formatDate('2026:04:21', 'en')).toBe('APR 21st, 2026')
    expect(formatDate('2026:05:22', 'en')).toBe('MAY 22nd, 2026')
    expect(formatDate('2026:12:31', 'en')).toBe('DEC 31st, 2026')
    expect(formatDate('2026:01:11', 'en')).toBe('JAN 11th, 2026')
    expect(formatDate('2026:11:13', 'en')).toBe('NOV 13th, 2026')
  })
})

describe('parseDisplayDate', () => {
  it('反解四种展示格式与 EXIF 原始格式', () => {
    expect(parseDisplayDate('2026:08:27 10:30:00')).toBe('2026:08:27 10:30')
    expect(parseDisplayDate('2026/08/27')).toBe('2026:08:27')
    expect(parseDisplayDate('2026-08-27 10:30')).toBe('2026:08:27 10:30')
    expect(parseDisplayDate('2026年8月27日')).toBe('2026:08:27')
  })

  it('反解 en 英文杂志式（含逗号可省略），与 formatDate 组合互转', () => {
    expect(parseDisplayDate('JUN 10th, 2025')).toBe('2025:06:10')
    expect(parseDisplayDate('MAR 3rd, 2026')).toBe('2026:03:03')
    expect(parseDisplayDate('DEC 31st 2026')).toBe('2026:12:31')
    expect(formatDate(parseDisplayDate('JUN 10th, 2025')!, 'dash')).toBe('2025-06-10')
  })

  it('无法解析的自由文本返回 undefined；空值返回 undefined', () => {
    expect(parseDisplayDate('秋天拍摄')).toBeUndefined()
    expect(parseDisplayDate('')).toBeUndefined()
    expect(parseDisplayDate(undefined)).toBeUndefined()
  })

  it('与 formatDate 组合：任意展示格式间互转（日期格式切换的真实链路）', () => {
    expect(formatDate(parseDisplayDate('2026年8月27日'), 'dash')).toBe('2026-08-27')
    expect(formatDate(parseDisplayDate('2026/08/27 10:30'), 'zh')).toBe('2026年8月27日')
    expect(formatDate(parseDisplayDate('2026-08-27'), 'date')).toBe('2026/08/27')
  })
})

describe('isInfoMissing', () => {
  it('空串 / 「自定义」占位 / 纯空白均视为缺失', () => {
    expect(isInfoMissing('')).toBe(true)
    expect(isInfoMissing('自定义')).toBe(true)
    expect(isInfoMissing(' 自定义 ')).toBe(true)
    expect(isInfoMissing(undefined)).toBe(true)
    expect(isInfoMissing('ILCE-7RM5')).toBe(false)
  })
})

describe('backfillInfoFromRaw', () => {
  const raw = {
    focalLength: 50,
    fNumber: 1.8,
    exposureTime: 1 / 200,
    iso: 200,
    dateTimeOriginal: '2026:08:27 10:30:00',
    lensMake: 'SONY',
    lensModel: 'FE 55mm F1.8 ZA',
    model: 'α7R V',
    brandId: 'sony',
  }

  it('回填空与「自定义」占位字段，已填写的自定义内容保持不变', () => {
    const cfg = {
      exifText: '手填参数',
      dateText: '自定义',
      lensText: '',
      cameraModel: '',
      brand: '自定义',
      dateFormat: 'dash' as const,
      eqFocal: false,
      cropFactor: 0,
      exifRaw: raw,
    }
    expect(backfillInfoFromRaw(cfg)).toBe(true)
    expect(cfg.exifText).toBe('手填参数')
    expect(cfg.dateText).toBe('2026-08-27 10:30')
    expect(cfg.lensText).toBe('SONY FE 55mm F1.8 ZA')
    expect(cfg.cameraModel).toBe('α7R V')
    expect(cfg.brand).toBe('sony')
  })

  it('无缺失时返回 false 且不改动；无 raw 时返回 false', () => {
    const full = {
      exifText: '50mm f/1.8 1/200s ISO200',
      dateText: '2026/08/27',
      lensText: 'FE 55mm',
      cameraModel: 'α7R V',
      brand: 'sony',
      dateFormat: 'dash' as const,
      eqFocal: false,
      cropFactor: 0,
      exifRaw: raw,
    }
    const copy = { ...full }
    expect(backfillInfoFromRaw(full)).toBe(false)
    expect(full).toEqual(copy)
    const noRaw = { ...copy, exifRaw: null }
    expect(backfillInfoFromRaw(noRaw)).toBe(false)
  })

  it('opts.brand=false 时不改动品牌，其余缺失项照常回填', () => {
    const cfg = {
      exifText: '',
      dateText: '',
      lensText: '',
      cameraModel: '自定义',
      brand: '自定义',
      dateFormat: 'date' as const,
      eqFocal: false,
      cropFactor: 0,
      exifRaw: raw,
    }
    expect(backfillInfoFromRaw(cfg, { brand: false })).toBe(true)
    expect(cfg.brand).toBe('自定义')
    expect(cfg.cameraModel).toBe('α7R V')
    expect(cfg.exifText).toBe('50mm f/1.8 1/200s ISO200')
  })

  it('用户手选的品牌（非占位）任何情况下都不被改动', () => {
    const cfg = {
      exifText: '',
      dateText: '',
      lensText: '',
      cameraModel: '',
      brand: 'canon',
      dateFormat: 'date' as const,
      eqFocal: false,
      cropFactor: 0,
      exifRaw: raw,
    }
    backfillInfoFromRaw(cfg)
    expect(cfg.brand).toBe('canon')
  })

  it('raw 缺 model/brandId（旧版导入照片）时对应字段不回填', () => {
    const cfg = {
      exifText: '',
      dateText: '',
      lensText: '',
      cameraModel: '自定义',
      brand: '自定义',
      dateFormat: 'date' as const,
      eqFocal: false,
      cropFactor: 0,
      exifRaw: { focalLength: 50, iso: 200 },
    }
    expect(backfillInfoFromRaw(cfg)).toBe(true)
    expect(cfg.exifText).toBe('50mm ISO200')
    expect(cfg.cameraModel).toBe('自定义')
    expect(cfg.brand).toBe('自定义')
  })
})
