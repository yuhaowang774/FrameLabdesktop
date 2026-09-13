// 农历换算（公历 → 农历月/日中文文本）：经典位压缩表算法（lunarInfo，1900–2049）。
// 供日历边框（infoLayout='calendar'）在公历日期下标注农历；初一显示农历月名（如「八月」），
// 其余显示农历日（如「十五」「廿三」）。
// 表来源为通行的历法数据表（每年 1 个十六进制值：4 位闰月号 + 12/13 个月大小位），
// 已用 2020–2029 年春节（正月初一）日期逐年级校验（见 lunar.test.ts）。

/** 每年农历数据（1900 起）：0x04bd8 = 1900 年。位含义：& 0xf = 闰月月份（0 无闰）；
 *  & 0x10000 = 闰月大小（30 天）；0x8000 起依次为正月..腊月大小位（1 = 30 天，0 = 29 天） */
const LUNAR_INFO = [
  0x04bd8, 0x04ae0, 0x0a570, 0x054d5, 0x0d260, 0x0d950, 0x16554, 0x056a0, 0x09ad0, 0x055d2, // 1900-1909
  0x04ae0, 0x0a5b6, 0x0a4d0, 0x0d250, 0x1d255, 0x0b540, 0x0d6a0, 0x0ada2, 0x095b0, 0x14977, // 1910-1919
  0x04970, 0x0a4b0, 0x0b4b5, 0x06a50, 0x06d40, 0x1ab54, 0x02b60, 0x09570, 0x052f2, 0x04970, // 1920-1929
  0x06566, 0x0d4a0, 0x0ea50, 0x06e95, 0x05ad0, 0x02b60, 0x186e3, 0x092e0, 0x1c8d7, 0x0c950, // 1930-1939
  0x0d4a0, 0x1d8a6, 0x0b550, 0x056a0, 0x1a5b4, 0x025d0, 0x092d0, 0x0d2b2, 0x0a950, 0x0b557, // 1940-1949
  0x06ca0, 0x0b550, 0x15355, 0x04da0, 0x0a5b0, 0x14573, 0x052b0, 0x0a9a8, 0x0e950, 0x06aa0, // 1950-1959
  0x0aea6, 0x0ab50, 0x04b60, 0x0aae4, 0x0a570, 0x05260, 0x0f263, 0x0d950, 0x05b57, 0x056a0, // 1960-1969
  0x096d0, 0x04dd5, 0x04ad0, 0x0a4d0, 0x0d4d4, 0x0d250, 0x0d558, 0x0b540, 0x0b6a0, 0x195a6, // 1970-1979
  0x095b0, 0x049b0, 0x0a974, 0x0a4b0, 0x0b27a, 0x06a50, 0x06d40, 0x0af46, 0x0ab60, 0x09570, // 1980-1989
  0x04af5, 0x04970, 0x064b0, 0x074a3, 0x0ea50, 0x06b58, 0x05ac0, 0x0ab60, 0x096d5, 0x092e0, // 1990-1999
  0x0c960, 0x0d954, 0x0d4a0, 0x0da50, 0x07552, 0x056a0, 0x0abb7, 0x025d0, 0x092d0, 0x0cab5, // 2000-2009
  0x0a950, 0x0b4a0, 0x0baa4, 0x0ad50, 0x055d9, 0x04ba0, 0x0a5b0, 0x15176, 0x052b0, 0x0a930, // 2010-2019
  0x07954, 0x06aa0, 0x0ad50, 0x05b52, 0x04b60, 0x0a6e6, 0x0a4e0, 0x0d260, 0x0ea65, 0x0d530, // 2020-2029
  0x05aa0, 0x076a3, 0x096d0, 0x04afb, 0x04ad0, 0x0a4d0, 0x1d0b6, 0x0d250, 0x0d520, 0x0dd45, // 2030-2039
  0x0b5a0, 0x056d0, 0x055b2, 0x049b0, 0x0a577, 0x0a4b0, 0x0aa50, 0x1b255, 0x06d20, 0x0ada0, // 2040-2049
]

/** 农历月名（含闰月前缀由调用方拼） */
const LUNAR_MONTHS = ['正', '二', '三', '四', '五', '六', '七', '八', '九', '十', '冬', '腊']

export interface LunarDate {
  /** 农历年（数字） */
  year: number
  /** 农历月（1–12，闰月为负数如 -4 = 闰四月） */
  month: number
  /** 农历日（1–30） */
  day: number
  /** 是否闰月 */
  leap: boolean
}

/** 某农历年闰月月份（0 = 无闰月） */
export function lunarLeapMonth(lunarYear: number): number {
  return LUNAR_INFO[lunarYear - 1900] & 0xf
}

/** 农历月天数（29/30）；m = 1..12 正常月。闰月天数用 lunarLeapDays 查 */
function monthDays(lunarYear: number, month: number): number {
  return LUNAR_INFO[lunarYear - 1900] & (0x10000 >> month) ? 30 : 29
}

/** 某农历年闰月的天数（无闰月返回 0） */
function lunarLeapDays(lunarYear: number): number {
  const leap = lunarLeapMonth(lunarYear)
  return leap && LUNAR_INFO[lunarYear - 1900] & 0x10000 ? 30 : leap ? 29 : 0
}

/** 某农历年总天数（含闰月） */
function lunarYearDays(lunarYear: number): number {
  let sum = 348
  for (let bit = 0x8000; bit > 0x8; bit >>= 1) sum += LUNAR_INFO[lunarYear - 1900] & bit ? 1 : 0
  return sum + lunarLeapDays(lunarYear)
}

/** 农历日中文（初一…初十 / 十一…十九 / 二十 / 廿一…廿九 / 三十） */
export function lunarDayText(day: number): string {
  const digit = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十']
  if (day === 10) return '初十'
  if (day === 20) return '二十'
  if (day === 30) return '三十'
  const prefix = day < 10 ? '初' : day < 20 ? '十' : day < 30 ? '廿' : '三'
  return prefix + digit[(day % 10) - 1]
}

/** 农历月中文（含「闰」前缀）：1 → 正月，13 视非法返回空 */
export function lunarMonthText(month: number, leap: boolean): string {
  const m = Math.abs(month)
  if (m < 1 || m > 12) return ''
  return (leap ? '闰' : '') + LUNAR_MONTHS[m - 1] + '月'
}

/**
 * 公历 → 农历。基准：1900-01-31 = 农历 1900 年正月初一。
 * 逐月扣减采用经典算法（先扣闰月、回补负余量），支持 1901–2048。
 */
export function solarToLunar(date: Date): LunarDate {
  const base = Date.UTC(1900, 0, 31)
  const cur = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate())
  let offset = Math.floor((cur - base) / 86400000)

  // 定位农历年：offset 逐整年扣减，越界回补（offset==0 时落在下一年正月初一）
  let year = 1900
  let temp = 0
  while (year < 1900 + LUNAR_INFO.length && offset > 0) {
    temp = lunarYearDays(year)
    offset -= temp
    if (offset < 0) {
      offset += temp
      break
    }
    year++
  }

  // 定位农历月/日：闰月插在 leapMonth 与其后一个月之间，用 isLeap 标记当前段
  const leapMonth = lunarLeapMonth(year)
  let isLeap = false
  let m = 1
  for (; m < 13 && offset > 0; m++) {
    if (leapMonth > 0 && m === leapMonth + 1 && !isLeap) {
      --m
      isLeap = true
      temp = lunarLeapDays(year)
    } else {
      temp = monthDays(year, m)
    }
    if (isLeap && m === leapMonth + 1) isLeap = false
    offset -= temp
  }
  // 余量恰为 0 且下个月是闰月：day=1 落在闰月首日
  if (offset === 0 && leapMonth > 0 && m === leapMonth + 1) {
    if (isLeap) {
      isLeap = false
    } else {
      isLeap = true
      --m
    }
  }
  if (offset < 0) {
    offset += temp
    --m
  }
  return { year, month: m, day: offset + 1, leap: isLeap }
}

/** 农历日期短文本：初一时返回农历月名（如「八月」），其余返回日文本（如「十五」） */
export function lunarLabel(date: Date): string {
  const l = solarToLunar(date)
  if (l.day === 1) return lunarMonthText(l.month, l.leap)
  return lunarDayText(l.day)
}
