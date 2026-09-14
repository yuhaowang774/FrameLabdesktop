// 触屏双指手势数学（与 Workspace 滚轮缩放的锚点数学同源，纯函数便于测试）。
// 单指平移 / 双指缩放 / 双指平移共用 viewer 的 zoom/pan 状态；本模块只做「一步增量」推导。

export interface PinchPoint {
  x: number
  y: number
}

/** 双指手势采样：两指距离与中点（屏幕坐标） */
export interface PinchSample {
  dist: number
  mid: PinchPoint
}

/** viewer 状态切片（与 useViewer 同语义） */
export interface ViewerSnapshot {
  zoom: number
  panX: number
  panY: number
}

/** 缩放范围（与 useViewer.setZoom 的钳制一致：10%~800%） */
export const ZOOM_MIN = 0.1
export const ZOOM_MAX = 8

/** 由触点列表求采样（不足两点返回 null；多于两点取前两个） */
export function pinchSample(points: PinchPoint[]): PinchSample | null {
  if (points.length < 2) return null
  const [a, b] = points
  return {
    dist: Math.hypot(a.x - b.x, a.y - b.y),
    mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
  }
}

/**
 * 双指手势一步：
 * 1) 两指距离比 → 以「两指中点」为锚点缩放（与滚轮 setZoomAt 同一套平移修正公式）：
 *    中点下的内容点在缩放前后保持贴合手指，手势跟手；
 * 2) 中点位移 → 平移（缩放的同时可以拖动画布）。
 *
 * @param prev 上一帧采样
 * @param next 本帧采样
 * @param state 当前 viewer 状态
 * @param origin 画布布局原点（Workspace 的 wrapOrigin：不含 pan 的屏幕坐标）
 */
export function pinchStep(
  prev: PinchSample,
  next: PinchSample,
  state: ViewerSnapshot,
  origin: PinchPoint,
): ViewerSnapshot {
  const factor = prev.dist > 0 ? next.dist / prev.dist : 1
  const zoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, state.zoom * factor))
  // 平移修正基于「实际生效倍率」（钳制后），到达上下限后继续捏合时画面保持不动
  const eff = state.zoom > 0 ? zoom / state.zoom : 1
  let panX = state.panX
  let panY = state.panY
  if (eff !== 1) {
    // 锚点偏移 = 双指中点 −（布局原点 + 当前平移）——与 applyWheelZoom 完全一致
    const dx = next.mid.x - (origin.x + panX)
    const dy = next.mid.y - (origin.y + panY)
    panX -= (eff - 1) * dx
    panY -= (eff - 1) * dy
  }
  // 中点位移 → 平移
  panX += next.mid.x - prev.mid.x
  panY += next.mid.y - prev.mid.y
  return { zoom, panX, panY }
}
