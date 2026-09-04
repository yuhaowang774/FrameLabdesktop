// 显示开关 → 生效配置转换（预览与导出同源的纯函数）：
// 背景/边框/INFO 三个栏的「是否显示」开关，把关闭的层在几何上归零，渲染各端统一消费。
import type { FrameConfig } from './types'

/**
 * 根据 背景/边框 显示开关返回「生效配置」：
 * - showBorder=false：边框与背景扩展归零（padding/borderRatio/borderRadius/bgExpand/bgBottomRatio=0），照片铺满；
 * - showBackground=false：背景扩展归零（bgExpand/bgBottomRatio=0）。
 *   「是否绘制背景层」由预览层显隐与导出分支控制（不作 bgMode 改值——BgMode 无 none 字面量）。
 * - showInfo 不在此处理（信息无几何参数，由渲染端按 showInfo 分支短路）。
 * 不修改原配置对象（返回浅拷贝）。
 */
export function applyShowToggles(c: FrameConfig): FrameConfig {
  const x: FrameConfig = { ...c }
  if (!c.showBackground) {
    x.bgExpand = 0
    x.bgBottomRatio = 0
  }
  if (!c.showBorder) {
    x.padding = 0
    x.borderRatio = 0
    x.borderRadius = 0
    x.bgExpand = 0
    x.bgBottomRatio = 0
  }
  return x
}