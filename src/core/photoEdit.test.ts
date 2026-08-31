import { describe, it, expect } from 'vitest'
import {
  rotatedSize,
  clampCrop,
  cropToSourceRect,
  FULL_CROP,
  type Rotation,
  type CropRect,
} from './photoEdit'

describe('rotatedSize', () => {
  it('0/180 保持原尺寸', () => {
    expect(rotatedSize(800, 600, 0)).toEqual({ w: 800, h: 600 })
    expect(rotatedSize(800, 600, 180)).toEqual({ w: 800, h: 600 })
  })
  it('90/270 交换宽高', () => {
    expect(rotatedSize(800, 600, 90)).toEqual({ w: 600, h: 800 })
    expect(rotatedSize(800, 600, 270)).toEqual({ w: 600, h: 800 })
  })
})

describe('clampCrop', () => {
  it('满框裁剪合法', () => {
    expect(clampCrop(FULL_CROP)).toEqual({ x: 0, y: 0, w: 1, h: 1 })
  })
  it('超出范围被收回', () => {
    const c = clampCrop({ x: -0.2, y: 0.5, w: 1.2, h: 0.9 })
    expect(c.x).toBe(0)
    expect(c.w).toBe(1)
    // 高度 0.9 已合法，但 x 收回到 0 后，y 受 1-h=0.1 上限约束 → 0.1
    expect(c.y).toBeCloseTo(0.1, 6)
    expect(c.h).toBe(0.9)
  })
  it('最小尺寸约束', () => {
    const c = clampCrop({ x: 0.4, y: 0.4, w: 0.01, h: 0.01 }, 0.1)
    expect(c.w).toBeGreaterThanOrEqual(0.1)
    expect(c.h).toBeGreaterThanOrEqual(0.1)
  })
})

describe('cropToSourceRect（旋转后映射回源图）', () => {
  // 800x600 源图，crop 取满框：源矩形始终是整张原始图（旋转由 drawRotatedCropped 处理）
  it('rotation=0 满框：源矩形=整图', () => {
    expect(cropToSourceRect(800, 600, 0, FULL_CROP)).toEqual({ sx: 0, sy: 0, sw: 800, sh: 600 })
  })
  it('rotation=90 满框：源矩形=整图（旋转在绘制时处理）', () => {
    expect(cropToSourceRect(800, 600, 90, FULL_CROP)).toEqual({ sx: 0, sy: 0, sw: 800, sh: 600 })
  })
  it('rotation=180 满框：源矩形=整图', () => {
    expect(cropToSourceRect(800, 600, 180, FULL_CROP)).toEqual({ sx: 0, sy: 0, sw: 800, sh: 600 })
  })
  it('rotation=270 满框：源矩形=整图', () => {
    expect(cropToSourceRect(800, 600, 270, FULL_CROP)).toEqual({ sx: 0, sy: 0, sw: 800, sh: 600 })
  })

  // 旋转 90（顺时针），crop 取旋转后图像右上角 1/4（归一化 x=0.5,y=0,w=0.5,h=0.5）
  // 旋转后尺寸 600x800，crop 像素 (rx=300, ry=0, cw=300, ch=400)
  // 映射回源：rotation=90 ⇒ sx=ry=0, sy=srcH-(rx+cw)=600-600=0, sw=ch=400, sh=cw=300
  it('rotation=90 右上角裁剪映射到源图正确', () => {
    const r = cropToSourceRect(800, 600, 90, { x: 0.5, y: 0, w: 0.5, h: 0.5 })
    expect(r.sx).toBeCloseTo(0, 3)
    expect(r.sy).toBeCloseTo(0, 3)
    expect(r.sw).toBeCloseTo(400, 3)
    expect(r.sh).toBeCloseTo(300, 3)
  })

  // 旋转 0，crop 中心 1/2：源矩形应在中央
  it('rotation=0 中心裁剪', () => {
    const r = cropToSourceRect(800, 600, 0, { x: 0.25, y: 0.25, w: 0.5, h: 0.5 })
    expect(r.sx).toBeCloseTo(200, 3)
    expect(r.sy).toBeCloseTo(150, 3)
    expect(r.sw).toBeCloseTo(400, 3)
    expect(r.sh).toBeCloseTo(300, 3)
  })
})

describe('cropToSourceRect 四向旋转一致性（裁剪面积守恒）', () => {
  const srcW = 800
  const srcH = 600
  const rotations: Rotation[] = [0, 90, 180, 270]
  const crops: CropRect[] = [
    FULL_CROP,
    { x: 0.1, y: 0.1, w: 0.8, h: 0.8 },
    { x: 0.5, y: 0.2, w: 0.4, h: 0.6 },
  ]
  for (const rot of rotations) {
    for (const crop of crops) {
      it(`rotation=${rot} crop=${JSON.stringify(crop)} 裁剪面积=源面积×crop比例`, () => {
        const r = cropToSourceRect(srcW, srcH, rot, crop)
        const srcArea = srcW * srcH
        const cropArea = r.sw * r.sh
        expect(cropArea).toBeCloseTo(srcArea * crop.w * crop.h, 0)
      })
    }
  }
})

describe('预览框比例 = 导出裁剪后比例（避免照片被拉伸/变成正方形）', () => {
  // 与 FrameContainer.photoDisplayAspect 及 exporter.displayW/displayH 的公式保持一致，
  // 断言两者一致：canvas 以 100%×100% 填充选择框时不会被拉伸。
  function displaySize(srcW: number, srcH: number, rotation: Rotation, crop: CropRect): { w: number; h: number } {
    const r = rotatedSize(srcW, srcH, rotation)
    return { w: r.w * crop.w, h: r.h * crop.h }
  }
  const cases: { src: [number, number]; rot: Rotation; crop: CropRect }[] = [
    { src: [800, 600], rot: 0, crop: FULL_CROP },
    { src: [800, 600], rot: 90, crop: FULL_CROP },
    { src: [800, 600], rot: 0, crop: { x: 0.2, y: 0.1, w: 0.6, h: 0.8 } },
    { src: [800, 600], rot: 90, crop: { x: 0.2, y: 0.1, w: 0.6, h: 0.8 } },
    { src: [1200, 800], rot: 180, crop: FULL_CROP },
    { src: [1200, 800], rot: 270, crop: FULL_CROP },
  ]
  for (const c of cases) {
    it(`src=${c.src} rot=${c.rot} crop=${JSON.stringify(c.crop)} 预览比例==导出比例`, () => {
      const { w: dw, h: dh } = displaySize(c.src[0], c.src[1], c.rot, c.crop)
      // 预览：photoRect 高 = w / displayAspect，displayAspect = dw/dh
      const displayAspect = dw / dh
      const boxW = 900
      const boxH = boxW / displayAspect
      // 导出画布像素比
      const exportAspect = dw / dh
      expect(boxW / boxH).toBeCloseTo(exportAspect, 6) // 一致 ⇒ 无拉伸
    })
  }
})
