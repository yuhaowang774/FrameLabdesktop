// 设备样机绘制：把照片"装进"设备轮廓（手机壳 / 相机机身壳），一律画在照片矩形内部。
// 预览（MainPhoto 照片画布）与导出（exporter 照片离屏画布）共用同一函数，保证三端一致；
// 厚度/圆角按画布尺寸比例计算，任何分辨率下视觉比例一致。
// 半径：调用方传入照片圆角像素值（导出端精确已知；预览按 photoRadius/设计宽 比例换算）。
//
// 相机机身壳（2026-09-17 第 3 阶段素材方案 a）：语料 01_相机边框 用的是「真实相机照片做底、
// 用户照片合成进机身屏幕」的素材拼贴，FrameLab 不用第三方素材（AGENTS.md），因此重释为**矢量机身**：
// 照片当作机身背面的 LCD 屏，机身环 + 金属顶盖 + 皮革握把 + 按钮在照片边缘内收绘制。
export type DeviceMockupKind =
  | 'phone-dark'
  | 'phone-light'
  | 'camera-dark'
  | 'camera-silver'
  | 'film-dark'
  | 'film-warm'

/** 手机壳边框环颜色：深空灰近黑 / 银色浅灰 */
const BEZEL_COLORS: Record<'phone-dark' | 'phone-light', { bezel: string; innerLine: string }> = {
  'phone-dark': { bezel: '#17181A', innerLine: 'rgba(255,255,255,0.08)' },
  'phone-light': { bezel: '#D7D9DD', innerLine: 'rgba(0,0,0,0.22)' },
}

/** 相机机身配色：body=机身主色 plate=金属顶盖 grip=皮革握把 detail=按钮/凹槽 */
const CAMERA_COLORS: Record<
  'camera-dark' | 'camera-silver',
  {
    body: string
    plate: string
    plateLine: string
    grip: string
    ridge: string
    detail: string
    detailLine: string
    lcdLine: string
  }
> = {
  // 黑机身 + 银顶盖（经典双色）：机身近黑、皮革握把更暗一档，靠明度差分层
  'camera-dark': {
    body: '#1F2024',
    plate: '#C6CAD1',
    plateLine: 'rgba(0,0,0,0.42)',
    grip: '#121316',
    ridge: 'rgba(255,255,255,0.075)',
    detail: '#0C0D0F',
    detailLine: 'rgba(255,255,255,0.26)',
    lcdLine: 'rgba(0,0,0,0.55)',
  },
  // 银机身 + 黑握把
  'camera-silver': {
    body: '#D3D6DA',
    plate: '#E9EBEE',
    plateLine: 'rgba(0,0,0,0.30)',
    grip: '#26272B',
    ridge: 'rgba(255,255,255,0.12)',
    detail: '#191A1D',
    detailLine: 'rgba(0,0,0,0.34)',
    lcdLine: 'rgba(0,0,0,0.45)',
  },
}

/**
 * 在照片画布上绘制设备样机（像素空间：w/h = 画布像素尺寸，radiusPx = 照片圆角像素值）。
 * 绘制策略：边框环从照片边缘向内收（环外缘 = 照片矩形），细节一律裁剪在环内。
 */
export function drawDeviceMockup(
  ctx: CanvasRenderingContext2D,
  kind: DeviceMockupKind,
  w: number,
  h: number,
  radiusPx: number,
): void {
  if (kind === 'phone-dark' || kind === 'phone-light') drawPhoneShell(ctx, kind, w, h, radiusPx)
  else if (kind === 'camera-dark' || kind === 'camera-silver') drawCameraShell(ctx, kind, w, h, radiusPx)
  else drawFilmShell(ctx, kind, w, h, radiusPx)
}

/** 手机壳：边框环 + 顶部灵动岛（两者都在照片矩形内，全幅模板同样适用） */
function drawPhoneShell(
  ctx: CanvasRenderingContext2D,
  kind: 'phone-dark' | 'phone-light',
  w: number,
  h: number,
  radiusPx: number,
): void {
  const colors = BEZEL_COLORS[kind]
  const base = Math.max(w, h)
  // 边框环厚度：长边 1.6%，钳制到 [6, 40] 像素（极小缩略图/超大导出都稳定）
  const t = Math.min(40, Math.max(6, base * 0.016))
  const outerR = Math.max(0, Math.min(radiusPx, Math.min(w, h) / 2))
  const innerR = Math.max(0, outerR - t)

  ctx.save()
  // 边框环（evenodd 双圆角矩形挖孔）
  ctx.beginPath()
  roundRect(ctx, 0, 0, w, h, outerR)
  roundRect(ctx, t, t, w - t * 2, h - t * 2, innerR)
  ctx.fillStyle = colors.bezel
  ctx.fill('evenodd')
  // 环内缘描线：银色壳加深分界、深灰壳加一丝高光，避免环与照片糊在一起
  ctx.beginPath()
  roundRect(ctx, t, t, w - t * 2, h - t * 2, innerR)
  ctx.strokeStyle = colors.innerLine
  ctx.lineWidth = Math.max(1, base * 0.0012)
  ctx.stroke()
  ctx.restore()

  // 灵动岛：顶部居中胶囊（黑色，任何壳色下都是黑色——与真机一致）
  const islandW = Math.min(w * 0.26, h * 0.42)
  const islandH = Math.max(8, Math.min(h * 0.032, islandW * 0.38))
  const islandX = w / 2 - islandW / 2
  const islandY = Math.max(t * 0.55, h * 0.014)
  ctx.save()
  ctx.beginPath()
  roundRect(ctx, islandX, islandY, islandW, islandH, islandH / 2)
  ctx.fillStyle = '#101013'
  ctx.fill()
  ctx.restore()
}

/**
 * 相机机身壳：照片 = 机身背面 LCD，环 = 机身面板。
 * 自左至右、自顶至下：金属顶盖（热靴凹槽 / 快门钮 / 模式拨盘）→ 左右皮革握把（横向纹）
 * → 右握把按钮列（小圆钮 / 四向拨盘）→ LCD 内缘细框。全部细节裁在环内。
 */
function drawCameraShell(
  ctx: CanvasRenderingContext2D,
  kind: 'camera-dark' | 'camera-silver',
  w: number,
  h: number,
  radiusPx: number,
): void {
  const c = CAMERA_COLORS[kind]
  const base = Math.max(w, h)
  const minBase = Math.min(w, h)
  // 机身环厚：长边 4.8%（明显厚于手机壳，才有"机身"体量感），钳制到 [20, 96]
  const t = Math.min(96, Math.max(20, base * 0.048))
  const outerR = Math.max(0, Math.min(radiusPx, minBase / 2))
  const innerR = Math.max(0, outerR - t)
  const line = Math.max(1, base * 0.0016)

  ctx.save()
  // ① 机身边框环
  ringPath(ctx, w, h, t, outerR, innerR)
  ctx.fillStyle = c.body
  ctx.fill('evenodd')
  // 细节裁剪在环内：圆角处不会越出机身
  ringPath(ctx, w, h, t, outerR, innerR)
  ctx.clip('evenodd')

  // ② 金属顶盖（环顶部横带）
  const plateH = t * 0.74
  ctx.fillStyle = c.plate
  ctx.fillRect(0, 0, w, plateH)
  ctx.fillStyle = c.plateLine
  ctx.fillRect(0, plateH - line, w, line)

  // 热靴凹槽（顶盖中央）
  const shoeW = Math.min(w * 0.14, t * 1.7)
  const shoeH = plateH * 0.4
  ctx.fillStyle = c.detail
  ctx.beginPath()
  roundRect(ctx, w / 2 - shoeW / 2, plateH * 0.17, shoeW, shoeH, line * 2)
  ctx.fill()

  // 快门钮（顶盖右端）：金属色小圆角矩形 + 内嵌凹槽
  const btnW = t * 0.54
  const btnH = plateH * 0.4
  const btnX = w - t * 1.0 - btnW
  ctx.fillStyle = c.detail
  ctx.beginPath()
  roundRect(ctx, btnX, plateH * 0.2, btnW, btnH, btnH * 0.34)
  ctx.fill()
  ctx.strokeStyle = c.detailLine
  ctx.lineWidth = line
  ctx.stroke()

  // 模式拨盘（顶盖左端）：圆盘 + 刻度齿
  const dialR = Math.max(2, Math.min(t * 0.3, plateH * 0.46))
  const dialX = t * 1.0 + dialR
  const dialY = plateH * 0.5
  ctx.fillStyle = c.detail
  ctx.beginPath()
  ctx.arc(dialX, dialY, dialR, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = c.detailLine
  ctx.lineWidth = line * 0.8
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI * 2 * i) / 8
    ctx.beginPath()
    ctx.moveTo(dialX + Math.cos(a) * dialR * 0.55, dialY + Math.sin(a) * dialR * 0.55)
    ctx.lineTo(dialX + Math.cos(a) * dialR * 0.95, dialY + Math.sin(a) * dialR * 0.95)
    ctx.stroke()
  }

  // ③ 右握把（皮革）+ 横向纹理
  const gripW = Math.min(t * 1.02, w * 0.16)
  ctx.fillStyle = c.grip
  ctx.fillRect(w - gripW, plateH, gripW, h - plateH)
  const ridge = Math.max(1.2, t * 0.1)
  ctx.fillStyle = c.ridge
  for (let y = plateH + ridge * 2.4; y < h - ridge * 1.6; y += ridge * 3.2) {
    ctx.fillRect(w - gripW + ridge * 0.9, y, gripW - ridge * 1.8, ridge)
  }
  // 左握把（窄，与右握把呼应）
  const gripLW = Math.min(t * 0.62, w * 0.12)
  ctx.fillStyle = c.grip
  ctx.fillRect(0, plateH, gripLW, h - plateH)
  ctx.fillStyle = c.ridge
  for (let y = plateH + ridge * 2.4; y < h - ridge * 1.6; y += ridge * 3.2) {
    ctx.fillRect(ridge * 0.9, y, Math.max(1, gripLW - ridge * 1.8), ridge)
  }

  // ④ 右握把按钮列：两枚小圆钮 + 四向拨盘（自上而下）
  const cx = w - gripW / 2
  ctx.fillStyle = c.detail
  for (const ry of [0.5, 0.58]) {
    ctx.beginPath()
    ctx.arc(cx, h * ry, Math.max(1.4, t * 0.15), 0, Math.PI * 2)
    ctx.fill()
  }
  const dpadR = Math.max(2.4, t * 0.3)
  const dpadY = h * 0.72
  ctx.beginPath()
  ctx.arc(cx, dpadY, dpadR, 0, Math.PI * 2)
  ctx.fill()
  ctx.strokeStyle = c.detailLine
  ctx.lineWidth = line
  ctx.beginPath()
  ctx.arc(cx, dpadY, dpadR * 0.62, 0, Math.PI * 2)
  ctx.stroke()
  // 四向箭头（上下左右四小三角）
  ctx.fillStyle = c.detailLine
  for (let i = 0; i < 4; i++) {
    const a = (Math.PI / 2) * i - Math.PI / 2
    const px = cx + Math.cos(a) * dpadR * 0.62
    const py = dpadY + Math.sin(a) * dpadR * 0.62
    ctx.beginPath()
    ctx.arc(px, py, Math.max(0.8, dpadR * 0.16), 0, Math.PI * 2)
    ctx.fill()
  }

  // ⑤ 机身下缘高光（金属底缘）
  ctx.fillStyle = c.plateLine
  ctx.fillRect(0, h - line * 1.4, w, line * 1.4)
  // 外缘倒角：上/左亮一线、下/右暗一线，给机身一点体积感（同样裁在环内）
  ctx.fillStyle = c.detailLine
  ctx.fillRect(0, 0, w, line)
  ctx.fillRect(0, 0, line, h)
  ctx.restore()

  // ⑥ LCD 内衬 + 内缘细框：屏幕与机身之间留一圈窄边，再压一道细线（不裁剪，沿环内侧绘制）
  const inset = t * 0.16
  ctx.save()
  ctx.beginPath()
  roundRect(ctx, t, t, w - t * 2, h - t * 2, innerR)
  roundRect(ctx, t + inset, t + inset, w - (t + inset) * 2, h - (t + inset) * 2, Math.max(0, innerR - inset))
  ctx.fillStyle = c.detail
  ctx.fill('evenodd')
  ctx.beginPath()
  roundRect(ctx, t + inset, t + inset, w - (t + inset) * 2, h - (t + inset) * 2, Math.max(0, innerR - inset))
  ctx.strokeStyle = c.lcdLine
  ctx.lineWidth = Math.max(1, base * 0.0016)
  ctx.stroke()
  ctx.restore()
}

/** 机身环路径（双圆角矩形子路径，配合 fill('evenodd') / clip('evenodd') 使用） */
function ringPath(ctx: CanvasRenderingContext2D, w: number, h: number, t: number, outerR: number, innerR: number): void {
  ctx.beginPath()
  roundRect(ctx, 0, 0, w, h, outerR)
  roundRect(ctx, t, t, w - t * 2, h - t * 2, innerR)
}

/** 胶片壳配色：片基底色 / 齿孔 / 边缘记号 / 内缘线 */
const FILM_COLORS: Record<'film-dark' | 'film-warm', { base: string; hole: string; mark: string }> = {
  'film-dark': { base: '#16140F', hole: 'rgba(255,255,255,0.16)', mark: 'rgba(255,255,255,0.5)' },
  'film-warm': { base: '#2A211A', hole: 'rgba(255,255,255,0.14)', mark: 'rgba(255,255,255,0.45)' },
}

/**
 * 胶片壳（35mm 片基）：照片 = 片窗，四周为片基边缘——上下厚（≈ 侧边 2.2 倍）承载齿孔与记号，
 * 上下片基外缘各排一行冲孔，底部两侧三角记号（语料 05_胶片边框 的 ◀ ▶），内缘一道亮线。
 * 全部细节裁在片基环内；语料那套顶部的「42 / KODAK / 125PX」属文字信息，交由模板自由元素排版。
 */
function drawFilmShell(
  ctx: CanvasRenderingContext2D,
  kind: 'film-dark' | 'film-warm',
  w: number,
  h: number,
  radiusPx: number,
): void {
  const c = FILM_COLORS[kind]
  const base = Math.max(w, h)
  const side = Math.min(28, Math.max(6, base * 0.022))
  const long = Math.min(64, Math.max(12, side * 2.2))
  const outerR = Math.max(0, Math.min(radiusPx, Math.min(w, h) / 2))
  const line = Math.max(1, base * 0.0014)

  ctx.save()
  // 片基环：外缘 = 照片矩形，内孔按上下厚 / 左右窄收边
  ctx.beginPath()
  roundRect(ctx, 0, 0, w, h, outerR)
  roundRect(ctx, side, long, w - side * 2, h - long * 2, Math.max(0, outerR - side))
  ctx.fillStyle = c.base
  ctx.fill('evenodd')
  ctx.beginPath()
  roundRect(ctx, 0, 0, w, h, outerR)
  roundRect(ctx, side, long, w - side * 2, h - long * 2, Math.max(0, outerR - side))
  ctx.clip('evenodd')

  // 齿孔：上下片基外缘各一排（圆角矩形冲孔）
  const holeW = Math.max(2.4, side * 0.5)
  const holeH = Math.max(1.8, long * 0.2)
  const pitch = holeW * 2.1
  ctx.fillStyle = c.hole
  for (let x = pitch * 0.5; x < w - holeW; x += pitch) {
    for (const y of [long * 0.22, h - long * 0.22 - holeH]) {
      ctx.beginPath()
      roundRect(ctx, x, y, holeW, holeH, holeH * 0.35)
      ctx.fill()
    }
  }
  // 底部三角记号（◀ ▶，靠两侧）
  ctx.fillStyle = c.mark
  const tri = Math.max(2.5, long * 0.16)
  const ty = h - long * 0.62
  ctx.beginPath()
  ctx.moveTo(side + tri, ty - tri * 0.6)
  ctx.lineTo(side + tri, ty + tri * 0.6)
  ctx.lineTo(side, ty)
  ctx.closePath()
  ctx.fill()
  ctx.beginPath()
  ctx.moveTo(w - side - tri, ty - tri * 0.6)
  ctx.lineTo(w - side - tri, ty + tri * 0.6)
  ctx.lineTo(w - side, ty)
  ctx.closePath()
  ctx.fill()
  ctx.restore()

  // 内缘亮线：片窗与片基的分界
  ctx.save()
  ctx.beginPath()
  roundRect(ctx, side, long, w - side * 2, h - long * 2, Math.max(0, outerR - side))
  ctx.strokeStyle = c.hole
  ctx.lineWidth = line
  ctx.stroke()
  ctx.restore()
}

/** 圆角矩形路径（与 exporter.roundRectPath 同规则的独立实现，避免循环依赖） */
function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const radius = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}
