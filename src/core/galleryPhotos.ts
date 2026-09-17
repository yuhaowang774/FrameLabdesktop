// 模板画廊的照片源：内置「用户照片」（src/assets/gallery，桌面「模版照片」同步的本地评审照片，
// 体积大、在 .gitignore 中不入库）+ 运行时本地上传。
// 画廊页 template-gallery.html 专用；与应用的图库无关，不改动任何应用状态。
// 注意：不要改回 src/assets/seed —— 那是应用内置测试图（useSeed.ts 按文件名引用），与画廊无关。
import { GALLERY_PHOTO_SIZE } from './galleryPhotoSizes'

const SEED_MODS = import.meta.glob<string>('../assets/gallery/*.{jpg,jpeg,png}', {
  eager: true,
  import: 'default',
})

export interface GalleryPhoto {
  /** 稳定标识（种子照片用文件名，上传照片用 up-序号） */
  id: string
  /** 选择器里显示的名字 */
  label: string
  /** 可直接交给 <img> / 合成管线的 URL */
  src: string
  /** 来源：内置种子照片 / 用户本次上传 */
  source: 'seed' | 'upload'
  /** 宽高比（w/h）：内置照片来自离线尺寸表（galleryPhotoSizes.ts），上传照片由页面解码后回填 */
  aspect?: number
}

/** 内置用户照片（按文件名排序，保证每次打开顺序一致） */
export function seedPhotos(): GalleryPhoto[] {
  return Object.entries(SEED_MODS)
    .map(([path, url]) => {
      const file = path.split('/').pop() ?? path
      const size = GALLERY_PHOTO_SIZE[file]
      return {
        id: file.replace(/\.[^.]+$/, ''),
        label: file,
        src: url,
        source: 'seed' as const,
        aspect: size ? size[0] / size[1] : undefined,
      }
    })
    .sort((a, b) => a.label.localeCompare(b.label))
}

/** 把用户选中的本地图片文件转成画廊照片项（objectURL 由调用方在需要时释放） */
export function photosFromFiles(files: FileList | File[]): GalleryPhoto[] {
  const list = Array.from(files).filter((f) => f.type.startsWith('image/'))
  return list.map((file, i) => ({
    id: `up-${Date.now()}-${i}`,
    label: file.name,
    src: URL.createObjectURL(file),
    source: 'upload' as const,
  }))
}
