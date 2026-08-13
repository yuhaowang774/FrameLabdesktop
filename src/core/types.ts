export type BgMode = 'default' | 'custom' | 'none'
export type OverlayAlign = 'left' | 'center' | 'right'
export type Theme = 'light' | 'dark'

export interface FrameConfig {
  bgMode: BgMode
  overlayAlign: OverlayAlign
  overlayBottom: number

  blur: number
  padding: number
  scale: number
  radius: number
  shadow: number

  brand: string
  showLogo: boolean
  logoSize: number
  logoOpacity: number

  showExif: boolean
  exifText: string
  fontFamily: string
  fontSize: number
  textWeight: number
  textOpacity: number

  distPhotoLogo: number
  distLogoText: number
  distBottom: number

  showCameraModel: boolean
  cameraModel: string
  cameraModelFont: string
  cameraModelSize: number
  cameraModelWeight: number
  cameraModelGap: number
  cameraModelOpacity: number
  cameraModelItalic: boolean
  cameraModelOffsetX: number
  cameraModelOffsetY: number

  theme: Theme
}

export const defaultFrameConfig: FrameConfig = {
  bgMode: 'default',
  overlayAlign: 'center',
  overlayBottom: 20,

  blur: 40,
  padding: 80,
  scale: 90,
  radius: 20,
  shadow: 0.5,

  brand: 'sony',
  showLogo: true,
  logoSize: 30,
  logoOpacity: 1,

  showExif: false,
  exifText: '200mm f/4 1/800s ISO400',
  fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  fontSize: 16,
  textWeight: 600,
  textOpacity: 1,

  distPhotoLogo: 40,
  distLogoText: 15,
  distBottom: 60,

  showCameraModel: true,
  cameraModel: 'A7R V',
  cameraModelFont: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
  cameraModelSize: 14,
  cameraModelWeight: 600,
  cameraModelGap: 8,
  cameraModelOpacity: 1,
  cameraModelItalic: false,
  cameraModelOffsetX: 0,
  cameraModelOffsetY: 0,

  theme: 'light',
}
