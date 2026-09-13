// GPX 运动轨迹解析：距离 / 时长 / 速度 / 爬升 / 归一化轨迹点。
// 供 sport 运动遥测布局使用：INFO 面板导入 .gpx 文件 → 解析写入 config.telemetry →
// 导出端 drawSportFooter 渲染遥测参数表与轨迹缩略卡。
// 仅依赖 DOMParser（浏览器/测试环境均可），无第三方库。
import type { TelemetryData, TelemetryPoint } from './types'

/** 轨迹点上限：超过则等距抽稀（控制 localStorage 体积与渲染开销） */
const MAX_POINTS = 500
/** 海拔噪声阈值（m）：相邻增量小于该值不累计爬升 */
const ELEV_NOISE_M = 1

/** 两点间大圆距离（km，Haversine 公式） */
function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371
  const rad = Math.PI / 180
  const dLat = (lat2 - lat1) * rad
  const dLon = (lon2 - lon1) * rad
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

/** 等距抽稀：n 超上限时按步长取样（保留首末点） */
function resample(points: TelemetryPoint[]): TelemetryPoint[] {
  if (points.length <= MAX_POINTS) return points
  const step = (points.length - 1) / (MAX_POINTS - 1)
  const out: TelemetryPoint[] = []
  for (let i = 0; i < MAX_POINTS; i++) out.push(points[Math.round(i * step)])
  return out
}

/**
 * 解析 GPX 文本 → 遥测数据。
 * 支持 <trkpt>（轨迹点，首选）与 <rtept>（航线点兜底）；逐点可带 <ele> 海拔与 <time> 时间。
 * 坐标缺失 / 无有效轨迹点时抛错，由调用方提示。
 */
export function parseGpx(text: string): TelemetryData {
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  if (doc.querySelector('parsererror')) throw new Error('文件不是有效的 GPX/XML')
  let nodes = Array.from(doc.getElementsByTagName('trkpt'))
  if (!nodes.length) nodes = Array.from(doc.getElementsByTagName('rtept'))
  if (!nodes.length) throw new Error('GPX 中没有轨迹点（trkpt）')

  interface RawPoint { lat: number; lon: number; ele: number | null; time: number | null }
  const raw: RawPoint[] = []
  for (const n of nodes) {
    const lat = Number(n.getAttribute('lat'))
    const lon = Number(n.getAttribute('lon'))
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) continue
    const eleText = n.querySelector('ele')?.textContent?.trim()
    const timeText = n.querySelector('time')?.textContent?.trim()
    const ele = eleText != null && eleText !== '' ? Number(eleText) : null
    const t = timeText ? Date.parse(timeText) : null
    raw.push({ lat, lon, ele: ele != null && Number.isFinite(ele) ? ele : null, time: t != null && Number.isFinite(t) ? t : null })
  }
  if (raw.length < 2) throw new Error('GPX 轨迹点不足（至少需要 2 个有效坐标点）')

  // 距离（Haversine 累加）与瞬时速度峰值
  let distanceKm = 0
  let maxSpeedKmh = 0
  for (let i = 1; i < raw.length; i++) {
    const prev = raw[i - 1]
    const cur = raw[i]
    const seg = haversineKm(prev.lat, prev.lon, cur.lat, cur.lon)
    distanceKm += seg
    if (seg > 0 && prev.time != null && cur.time != null) {
      const hours = (cur.time - prev.time) / 3600000
      if (hours > 0) maxSpeedKmh = Math.max(maxSpeedKmh, seg / hours)
    }
  }

  // 时长：首末时间差（无时间标签为 0）
  const times = raw.map((p) => p.time).filter((t): t is number => t != null)
  const durationS = times.length >= 2 ? Math.max(0, (times[times.length - 1] - times[0]) / 1000) : 0
  const avgSpeedKmh = durationS > 0 ? distanceKm / (durationS / 3600) : 0

  // 爬升：海拔噪声过滤（相邻正增量 ≥ ELEV_NOISE_M 才累计）+ 最高海拔
  const eles = raw.map((p) => p.ele).filter((e): e is number => e != null)
  let elevGainM = 0
  let maxAltM: number | null = null
  if (eles.length >= 2) {
    let ref = eles[0]
    for (let i = 1; i < eles.length; i++) {
      const diff = eles[i] - ref
      if (diff >= ELEV_NOISE_M) {
        elevGainM += diff
        ref = eles[i]
      } else if (diff < -ELEV_NOISE_M) {
        ref = eles[i]
      }
    }
    maxAltM = Math.max(...eles)
  }

  // 轨迹归一化：经纬度包围盒等比缩放置中（y 大 = 纬度高 = 北），避免细长轨迹被拉伸变形
  // （渲染端把 p.y 大的点画在卡片上方，故北为 y 增大方向）
  const lats = raw.map((p) => p.lat)
  const lons = raw.map((p) => p.lon)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLon = Math.min(...lons)
  const maxLon = Math.max(...lons)
  const spanLat = maxLat - minLat
  const spanLon = maxLon - minLon
  const span = Math.max(spanLat, spanLon) || 1
  const cLat = (minLat + maxLat) / 2
  const cLon = (minLon + maxLon) / 2
  const points: TelemetryPoint[] = resample(
    raw.map((p) => ({
      x: Math.round((0.5 + (p.lon - cLon) / (2 * span)) * 1000) / 1000,
      y: Math.round((0.5 + (p.lat - cLat) / (2 * span)) * 1000) / 1000,
    })),
  )

  const startTime = times.length ? new Date(times[0]).toISOString() : null
  return {
    distanceKm: Math.round(distanceKm * 100) / 100,
    durationS: Math.round(durationS),
    avgSpeedKmh: Math.round(avgSpeedKmh * 10) / 10,
    maxSpeedKmh: Math.round(maxSpeedKmh * 10) / 10,
    elevGainM: Math.round(elevGainM),
    maxAltM: maxAltM != null ? Math.round(maxAltM) : null,
    startTime,
    points,
  }
}
