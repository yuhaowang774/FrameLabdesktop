// 模板库展示开关（2026-09-18 用户人工审查结论）：
// 以下分组的内置模板样式暂不达标，**先在模板库里不展示**；模板数据、样张与分组都保留在代码里，
// 待这几组重做完成后，从本表移除对应分组即可一次性恢复展示（无需改别的代码）。
// 注意：只影响「模板库」等展示入口的清单，不影响导出/预览（已保存的自定义模板也不受影响）。
export const HIDDEN_TEMPLATE_GROUPS: readonly string[] = [
  '胶片复古',
  '暗调影廊',
  '联名卡',
  '社交尺寸',
  '大师水印',
  '日历边框',
  '运动边框',
  '设备样机',
]

/**
 * 该模板是否应在模板库里展示：
 * 自定义模板恒展示；内置模板看其分组是否在隐藏表里（无分组的按展示处理）。
 */
export function isTemplateVisible(t: { builtin?: boolean; group?: string | null }): boolean {
  if (!t.builtin) return true
  return !HIDDEN_TEMPLATE_GROUPS.includes(t.group ?? '')
}

/** 模板库里可见的内置模板套数（左栏入口的「共 N 套内置模板」用） */
export function countVisibleBuiltin<T extends { builtin?: boolean; group?: string | null }>(list: readonly T[]): number {
  return list.filter((t) => t.builtin && isTemplateVisible(t)).length
}
