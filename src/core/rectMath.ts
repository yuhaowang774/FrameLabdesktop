// 纯函数：根据拖拽模式/位移计算新的矩形（设计坐标，左上角 + 宽高）。
// 与 SelectableBox 解耦，便于单元测试，也集中修复几何 bug。

export type Handle =
  | 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'move'

export interface Rect {
  left: number
  top: number
  width: number
  height: number
}

export interface RectOpts {
  /** 锁定宽高比（图片等保持原始比例） */
  lockAspect?: boolean
  /** 最小宽高（设计像素） */
  minSize?: number
}

/**
 * 计算拖拽后的矩形。
 * @param mode 拖拽模式（move 或某个控制点）
 * @param start 拖拽开始时的矩形
 * @param dx 水平位移（设计像素）
 * @param dy 垂直位移（设计像素）
 */
export function computeRect(
  mode: Handle,
  start: Rect,
  dx: number,
  dy: number,
  opts: RectOpts = {},
): Rect {
  const min = opts.minSize ?? 1
  const lock = !!opts.lockAspect

  if (mode === 'move') {
    return {
      left: start.left + dx,
      top: start.top + dy,
      width: start.width,
      height: start.height,
    }
  }

  const hasN = mode.includes('n')
  const hasS = mode.includes('s')
  const hasW = mode.includes('w')
  const hasE = mode.includes('e')

  let left = start.left
  let top = start.top
  let width = start.width
  let height = start.height

  // 先按各方向增量计算自由的宽/高/位置
  if (hasE) width = start.width + dx
  if (hasS) height = start.height + dy
  if (hasW) {
    width = start.width - dx
    left = start.left + dx
  }
  if (hasN) {
    height = start.height - dy
    top = start.top + dy
  }

  if (lock && start.width > 0 && start.height > 0) {
    const ratio = start.height / start.width // h / w
    // 以"实际发生变化的那条边"对应的尺寸为主，推导另一维，避免 n/s 边手柄失效
    const widthChanged = hasE || hasW
    const heightChanged = hasN || hasS
    if (widthChanged && !heightChanged) {
      width = clampWidth(width, min)
      height = width * ratio
    } else if (heightChanged && !widthChanged) {
      height = clampHeight(height, min)
      width = height / ratio
    } else {
      // 角点：取变化更大的一维为主，保证手感顺滑
      if (Math.abs(dx) >= Math.abs(dy)) {
        width = clampWidth(width, min)
        height = width * ratio
      } else {
        height = clampHeight(height, min)
        width = height / ratio
      }
    }
    // 根据锚点回算 left/top，使对边的位置保持不变
    if (hasW) left = start.left + (start.width - width)
    if (hasN) top = start.top + (start.height - height)
  } else {
    // 自由缩放：各自 clamp，并修正反向边位置
    if (width < min) {
      if (hasW) left = start.left + (start.width - min)
      width = min
    }
    if (height < min) {
      if (hasN) top = start.top + (start.height - min)
      height = min
    }
  }

  return { left, top, width, height }
}

function clampWidth(w: number, min: number): number {
  return Math.max(min, w)
}
function clampHeight(h: number, min: number): number {
  return Math.max(min, h)
}

/** classic INFO 元素水平锚点语义（与渲染 translate 一致的左侧/中心/右缘锚点） */
export type InfoAnchor = 'left' | 'center' | 'right'

/**
 * 按渲染锚点语义钳制 INFO 元素水平坐标 x（内容区坐标）：
 * left：x = 元素左缘；center：x = 行中心；right：x = 元素右缘（translate(-100%)）。
 * 元素「视觉左右缘」始终限制在画板内（允许进入边框留白区 pad+bgExpand，不允许超出画板）。
 * 反例：right 锚点下若下界取 -(pad+bgExpand)，宽元素左缘会拖出画板左缘（日期戳超出照片）。
 *
 * @param x 待钳制的锚点坐标
 * @param elemW 元素设计宽（px）
 * @param pad 边框内边距（设计 px）
 * @param bgExpand 背景扩展（设计 px）
 * @param canvasW 画板设计宽 = 内容区宽 + 2×(pad + bgExpand)
 */
export function clampInfoX(
  x: number,
  elemW: number,
  pad: number,
  bgExpand: number,
  canvasW: number,
  anchor: InfoAnchor,
): number {
  const inset = pad + bgExpand
  // 视觉左缘 ≥ -inset：left 时 x 即左缘（+0），center 补半宽，right 补全宽
  const min = -inset + (anchor === 'left' ? 0 : anchor === 'center' ? elemW / 2 : elemW)
  // 视觉右缘 ≤ canvasW - inset：left 时 x 是左缘（需扣 elemW），center 扣半宽，right 时 x 即右缘（-0）
  const max = canvasW - inset - (anchor === 'left' ? elemW : anchor === 'center' ? elemW / 2 : 0)
  return Math.max(min, Math.min(max, x))
}
