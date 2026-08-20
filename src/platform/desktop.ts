// 桌面端专属启动逻辑：原生菜单事件分发（Rust 端 emit → 此处分发到各 composable）。
// 仅在 isTauri 为 true 时由 main.ts 动态加载，网页端不会执行。
import { listen } from '@tauri-apps/api/event'
import { useAppState } from '../composables/useAppState'
import { useHistory } from '../composables/useHistory'
import { useLibrary } from '../composables/useLibrary'
import {
  pickImageFiles,
  pickImageFolder,
  loadFolderIntoLibrary,
  addLocalEntries,
  restoreLastFolder,
} from './fs'

export async function setupDesktopShell(): Promise<void> {
  const app = useAppState()
  const history = useHistory()
  const library = useLibrary()

  await listen<string>('framelab://menu', (e) => {
    const id = e.payload
    switch (id) {
      case 'module_library':
        app.setModule('library')
        break
      case 'module_develop':
        app.setModule('develop')
        break
      case 'module_export':
        app.setModule('export')
        break
      case 'undo':
        history.undo()
        break
      case 'redo':
        history.redo()
        break
      case 'toggle_filmstrip':
        app.toggleFilmstrip()
        break
      case 'import_images':
        void (async () => {
          const list = await pickImageFiles()
          if (list.length) {
            await addLocalEntries(list)
            app.setModule('library')
          }
        })()
        break
      case 'open_folder':
        void (async () => {
          const r = await pickImageFolder()
          if (r && r.images.length) {
            await loadFolderIntoLibrary(r)
            app.setModule('library')
          }
        })()
        break
      case 'prev_photo':
        library.prev()
        break
      case 'next_photo':
        library.next()
        break
      default:
        break
    }
  })

  // 恢复上次会话打开的图片文件夹（桌面端仅保存磁盘路径，不拷贝原图）
  await restoreLastFolder()
}
