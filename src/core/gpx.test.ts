// GPX 解析校验：手工构造的确定性轨迹（已知坐标/海拔/时间），逐项验证距离/时长/速度/爬升/归一化。
import { describe, expect, it } from 'vitest'
import { parseGpx } from './gpx'

/** 生成 GPX 文本（简化轨迹，坐标沿经线向南、时间 60s 间隔、海拔递增） */
function makeGpx(pts: Array<[number, number, number | null, string | null]>): string {
  const body = pts
    .map(([lat, lon, ele, time]) => {
      const eleTag = ele != null ? `<ele>${ele}</ele>` : ''
      const timeTag = time ? `<time>${time}</time>` : ''
      return `<trkpt lat="${lat}" lon="${lon}">${eleTag}${timeTag}</trkpt>`
    })
    .join('')
  return `<?xml version="1.0"?><gpx xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg>${body}</trkseg></trk></gpx>`
}

describe('parseGpx', () => {
  it('解析距离/时长/均速/爬升（沿经线 3 点，每段约 1.11km，海拔每段 +10m）', () => {
    const gpx = makeGpx([
      [30.0, 120.0, 100, '2026-08-30T06:00:00Z'],
      [29.99, 120.0, 110, '2026-08-30T06:10:00Z'],
      [29.98, 120.0, 120, '2026-08-30T06:20:00Z'],
    ])
    const t = parseGpx(gpx)
    // 纬度 0.01° ≈ 1.11km，两段合计 ≈ 2.22km
    expect(t.distanceKm).toBeGreaterThan(2.2)
    expect(t.distanceKm).toBeLessThan(2.25)
    expect(t.durationS).toBe(1200)
    expect(t.avgSpeedKmh).toBeGreaterThan(6.5)
    expect(t.avgSpeedKmh).toBeLessThan(7)
    expect(t.elevGainM).toBe(20)
    expect(t.maxAltM).toBe(120)
    expect(t.startTime).toBe('2026-08-30T06:00:00.000Z')
  })

  it('瞬时速度峰值取相邻点段最大值', () => {
    const gpx = makeGpx([
      [30.0, 120.0, null, '2026-08-30T06:00:00Z'],
      [29.99, 120.0, null, '2026-08-30T06:01:00Z'], // 慢段：0.01° in 1min ≈ 66 km/h
      [29.9, 120.0, null, '2026-08-30T06:06:00Z'], // 快段：0.09° in 5min ≈ 120 km/h
    ])
    const t = parseGpx(gpx)
    expect(t.maxSpeedKmh).toBeGreaterThan(115)
    expect(t.maxSpeedKmh).toBeLessThan(125)
  })

  it('海拔噪声（±0.5m）不计入爬升，回程下坡不抵扣', () => {
    const gpx = makeGpx([
      [30.0, 120.0, 100, null],
      [29.99, 120.0, 100.5, null],
      [29.98, 120.0, 102, null],
      [29.97, 120.0, 96, null],
    ])
    const t = parseGpx(gpx)
    // 100→100.5(0.5 噪声不计)→102(+1.5 计)→96(下坡只重置基准)
    expect(t.elevGainM).toBe(2)
  })

  it('归一化轨迹：0..1 内、等比缩放、北为上（y 大 = 纬度高）', () => {
    const gpx = makeGpx([
      [30.0, 120.0, null, null],
      [30.01, 120.02, null, null],
      [30.02, 120.04, null, null],
    ])
    const t = parseGpx(gpx)
    expect(t.points.length).toBe(3)
    for (const p of t.points) {
      expect(p.x).toBeGreaterThanOrEqual(0)
      expect(p.x).toBeLessThanOrEqual(1)
      expect(p.y).toBeGreaterThanOrEqual(0)
      expect(p.y).toBeLessThanOrEqual(1)
    }
    // 纬度最高（最北）的点 y 最大
    const ys = t.points.map((p) => p.y)
    expect(ys[2]).toBeGreaterThan(ys[0])
    // 经度跨度大于纬度跨度 → x 占满 0..1，y 居中收窄
    expect(Math.max(...t.points.map((p) => p.x)) - Math.min(...t.points.map((p) => p.x))).toBeGreaterThan(
      Math.max(...ys) - Math.min(...ys),
    )
  })

  it('超 500 点等距抽稀且保留首末点', () => {
    const pts: Array<[number, number, number | null, string | null]> = []
    for (let i = 0; i < 800; i++) {
      pts.push([30 + i * 0.0001, 120, null, null])
    }
    const t = parseGpx(makeGpx(pts))
    expect(t.points.length).toBe(500)
    expect(t.points[0].y).toBeLessThan(t.points[499].y)
  })

  it('无 trkpt 时回退 rtept；无轨迹点抛错', () => {
    const rte = `<?xml version="1.0"?><gpx><rte><rtept lat="30" lon="120"/><rtept lat="30.01" lon="120"/></rte></gpx>`
    expect(parseGpx(rte).distanceKm).toBeGreaterThan(0)
    expect(() => parseGpx('<gpx></gpx>')).toThrow(/轨迹点/)
    expect(() => parseGpx('not xml')).toThrow(/GPX\/XML/)
  })
})
