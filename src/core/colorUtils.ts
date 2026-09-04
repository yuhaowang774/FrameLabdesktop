// 颜色工具：INFO 文字颜色随背景自适应（白底/浅底 → 黑字，深底 → 白字）

/** hex（#rgb/#rrggbb）→ 相对亮度 0~1（Rec.709 加权）；非法输入返回 0（按深色处理 → 白字） */
export function hexLuminance(hex: string | null | undefined): number {
  if (!hex) return 0
  let h = hex.trim().replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (h.length !== 6 || /[^0-9a-f]/i.test(h)) return 0
  const r = parseInt(h.slice(0, 2), 16) / 255
  const g = parseInt(h.slice(2, 4), 16) / 255
  const b = parseInt(h.slice(4, 6), 16) / 255
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * INFO 文字颜色随背景自适应：
 * - solid 纯色背景：按背景色亮度（浅底黑字 / 深底白字）
 * - 其余（blur/photo）：白字（照片/模糊背景通常中深调）
 * 返回 rgba 字符串，opacity 0~1。
 */
export function footerTextColor(bgMode: string, bgColor: string | null, opacity = 0.95): string {
  if (bgMode === 'solid' && hexLuminance(bgColor) > 0.6) {
    return `rgba(0,0,0,${opacity})`
  }
  return `rgba(255,255,255,${opacity})`
}

/** hex（#rgb/#rrggbb）→ rgba 字符串（应用 alpha）；非法输入返回 null，调用方回退自适应色 */
export function hexToRgba(hex: string | null | undefined, alpha: number): string | null {
  if (!hex) return null
  let h = hex.trim().replace('#', '')
  if (h.length === 3) h = h.split('').map((c) => c + c).join('')
  if (h.length !== 6 || /[^0-9a-f]/i.test(h)) return null
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

/**
 * Logo 着色解析（与 footerTextColor 同一明暗判据）：
 * - 合法 hex（#rgb/#rrggbb）：用户显式指定的色值，原样返回；
 * - 其余（null/undefined/'auto'/历史哨兵如 'brand' 等非法值）：随背景明暗自适应——
 *   纯色浅底用近黑、其余（深底/模糊/照片）用纯白。
 *
 * 内置品牌 SVG 资源多为白色版本，白底相框下会与背景融为一体；
 * 统一按对比度取黑/白，保证任何品牌的 Logo 在任何底色上都清晰可辨。
 * 严格 hex 校验是必需的：历史数据中的哨兵值（如 'brand'）若被当色值传给 SVG，
 * fill 非法会被浏览器忽略，回退显示品牌 SVG 原色（即品牌主色）而非期望的黑/白。
 */
export function logoAutoColor(logoColor: string | null | undefined, bgMode: string, bgColor: string | null): string {
  if (logoColor && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(logoColor.trim())) return logoColor.trim()
  if (bgMode === 'solid' && hexLuminance(bgColor) > 0.6) return '#1a1a1a'
  return '#ffffff'
}
