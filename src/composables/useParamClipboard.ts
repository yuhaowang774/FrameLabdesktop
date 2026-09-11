// 参数剪贴板：复制/粘贴当前照片的装饰参数（可跨照片、跨窗口）。
// 从编辑页底栏（BottomToolbar）抽出共享：底栏按钮与胶片条右键菜单调用同一套逻辑；
// 粘贴确认 / 结果弹窗状态为模块单例，由全局唯一宿主 ParamClipboardHost 渲染，
// 避免 BottomToolbar 与 Filmstrip 各挂一份导致弹窗重复。
import { computed, ref } from 'vue'
import { useLibrary } from './useLibrary'
import { useTemplates, applyTemplateToState } from './useTemplates'
import { useFrameConfig } from './useFrameConfig'
import { applyTemplateToPhotos } from './useHistory'
import type { FrameConfig } from '../core/types'

// 模块级单例状态（跨组件共享）
const pasteConfirmOpen = ref(false)
const syncResultOpen = ref(false)
const syncResultMsg = ref('')
let pastedConfig: Partial<FrameConfig> | null = null

function parseParams(text: string): Partial<FrameConfig> | null {
  try {
    const obj = JSON.parse(text) as { kind?: string; config?: unknown } | unknown
    const c = (
      obj && typeof obj === 'object' && (obj as { kind?: string }).kind === 'framelab-params'
        ? (obj as { config: unknown }).config
        : obj
    ) as Record<string, unknown> | null
    if (c && typeof c === 'object' && !Array.isArray(c) && ('bgMode' in c || 'padding' in c || 'infoLayout' in c)) {
      return c as Partial<FrameConfig>
    }
    return null
  } catch {
    return null
  }
}

export function useParamClipboard() {
  const library = useLibrary()
  const templates = useTemplates()
  const { state } = useFrameConfig()

  // 同步目标 = 图库中已勾选的其他照片（与「同步设置」同一目标集合）
  const syncTargets = computed(() =>
    library.items.filter((i) => i.selected && i.id !== library.activeId.value),
  )

  /** 复制当前照片的装饰参数 JSON 到剪贴板（剪贴板 API 不可用时回退 execCommand） */
  async function copyParams(): Promise<boolean> {
    const text = JSON.stringify({ kind: 'framelab-params', version: 1, config: templates.toTemplateConfig(state) })
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      try {
        const ta = document.createElement('textarea')
        ta.value = text
        ta.style.cssText = 'position:fixed;top:-999px;opacity:0'
        document.body.appendChild(ta)
        const ok = document.execCommand('copy')
        ta.remove()
        return ok
      } catch {
        return false
      }
    }
  }

  /** 粘贴：读剪贴板解析参数并应用（存在勾选目标时先弹确认）；剪贴板不可用回退手动输入框 */
  async function pasteParams(): Promise<void> {
    let text = ''
    try {
      text = await navigator.clipboard.readText()
    } catch {
      text = ''
    }
    let cfg = parseParams(text)
    if (!cfg) {
      const manual = window.prompt('未从剪贴板读到有效参数。可将参数 JSON 粘贴到输入框后确定（先在 FrameLab 点「复制参数」生成）：')
      if (manual == null || manual.trim() === '') return
      cfg = parseParams(manual)
    }
    if (!cfg) {
      window.alert('参数格式无法识别：请先点「复制参数」生成参数 JSON，再进行粘贴。')
      return
    }
    pastedConfig = cfg
    if (syncTargets.value.length) {
      pasteConfirmOpen.value = true
      return
    }
    doApplyPasted()
  }

  /** 确认弹窗「应用」：当前照片 + 勾选照片一起应用 */
  function confirmPaste(): void {
    pasteConfirmOpen.value = false
    doApplyPasted(true)
  }

  /** 应用粘贴的参数。syncAlso=false 仅当前照片（确认弹窗「仅当前照片」按钮语义） */
  function doApplyPasted(syncAlso = false): void {
    const cfg = pastedConfig
    pastedConfig = null
    if (!cfg) return
    const missing = applyTemplateToState(cfg)
    const ids = syncTargets.value.map((i) => i.id)
    const tail = missing.length ? '；部分 INFO 无数据，已用「自定义」占位。' : '。'
    if (syncAlso && ids.length) {
      // 审查报告 U8：等待同步实际完成后再报结果（此前同步未开始就先宣布成功，失败也静默）
      void applyTemplateToPhotos(ids, cfg, '粘贴参数')
        .then(() => {
          showResult(`已将粘贴的参数应用到当前照片，并同步到 ${ids.length} 张选中照片${tail}`)
        })
        .catch((e) => {
          showResult(`已应用到当前照片，但同步到选中照片失败：${(e as Error)?.message ?? e}`)
        })
      return
    }
    showResult('已将粘贴的参数应用到当前照片' + tail)
  }

  /** 结果弹窗（粘贴/同步设置共用） */
  function showResult(msg: string): void {
    syncResultMsg.value = msg
    syncResultOpen.value = true
  }

  return {
    syncTargets,
    pasteConfirmOpen,
    syncResultOpen,
    syncResultMsg,
    copyParams,
    pasteParams,
    confirmPaste,
    doApplyPasted,
    showResult,
  }
}
