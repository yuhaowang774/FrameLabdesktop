// 更新记录（CHANGELOG）：静态随包分发，无网络依赖。
// 每次发新版必须在本表顶部追加条目（版本号与 package.json/tauri.conf.json 一致），
// 更新后首次启动会由 useUpdateLog.detectUpdate 检测并弹出更新详情弹窗。
// 内容分组：added=新增功能 / improved=功能优化 / fixed=问题修复 / known=已知问题。

export type UpdateImportance = 'major' | 'normal' | 'patch'

export interface UpdateGroups {
  /** 新增功能 */
  added?: string[]
  /** 功能优化 */
  improved?: string[]
  /** 问题修复 */
  fixed?: string[]
  /** 已知问题 */
  known?: string[]
}

export interface UpdateEntry {
  /** 版本号（与 package.json / tauri.conf.json 严格一致） */
  version: string
  /** 发布日期（YYYY-MM-DD） */
  date: string
  /** 重要程度：major=重大更新 / normal=功能更新 / patch=问题修复 */
  importance: UpdateImportance
  groups: UpdateGroups
}

/** 分组显示标签（弹窗渲染顺序即此顺序） */
export const UPDATE_GROUP_LABELS: { key: keyof UpdateGroups; label: string }[] = [
  { key: 'added', label: '新增功能' },
  { key: 'improved', label: '功能优化' },
  { key: 'fixed', label: '问题修复' },
  { key: 'known', label: '已知问题' },
]

/** 重要程度显示标签 */
export const IMPORTANCE_LABELS: Record<UpdateImportance, string> = {
  major: '重大更新',
  normal: '功能更新',
  patch: '问题修复',
}

// ===== 更新日志（新版本追加在最上方）=====
export const UPDATE_LOG: UpdateEntry[] = [
  {
    version: '0.1.11',
    date: '2026-09-02',
    importance: 'normal',
    groups: {
      added: [
        '品牌颜色可调节：手机白底卡联名标块（XMAGE / LEICA / ZEISS / HASSELBLAD）底色与文字色支持自定义',
        'Logo 颜色新增「品牌主色」（官方原色）与「自定义」取色',
        '补充 2024-2026 相机与手机新型号的营销名自动映射（如 α9 III / Galaxy S26 Ultra）',
      ],
      improved: [
        '导出设置的「超采样」「批量回填」「文本映射」增加悬停与常驻说明',
        '滑块轨道在高 DPI 缩放下精确居中',
      ],
      fixed: [
        '佳能 / 哈苏 / 理光官方 Logo 换色不生效的问题',
      ],
      known: [
        '安装包未做代码签名，首次运行可能被 SmartScreen 提示（选择「仍要运行」即可）',
      ],
    },
  },
  {
    version: '0.1.10',
    date: '2026-09-02',
    importance: 'major',
    groups: {
      added: [
        '软件在线更新：首选项可检查更新，自动下载、静默安装并重启生效',
        '更新分发基于 GitHub Releases（附签名校验，更新包被篡改时拒绝安装）',
      ],
    },
  },
  {
    version: '0.1.9',
    date: '2026-09-02',
    importance: 'normal',
    groups: {
      added: ['首选项显卡选择升级为检测列表下拉，覆盖全部显示适配器'],
      fixed: ['远程桌面 / 串流虚拟屏被误判为核显的问题'],
    },
  },
  {
    version: '0.1.8',
    date: '2026-09-02',
    importance: 'normal',
    groups: {
      improved: ['图库改为 Lightroom 式目录权威管理：移除的照片不再于下次启动时复活'],
    },
  },
  {
    version: '0.1.7',
    date: '2026-09-02',
    importance: 'patch',
    groups: {
      improved: ['关于页版本号动态获取，与安装包版本严格一致'],
    },
  },
  {
    version: '0.1.6',
    date: '2026-09-02',
    importance: 'patch',
    groups: {
      added: ['首选项支持一键重启应用（性能 / 数据类设置彻底生效）'],
    },
  },
  {
    version: '0.1.5',
    date: '2026-09-02',
    importance: 'normal',
    groups: {
      improved: ['失效缩略图自动清理；首选项支持手动清除缓存'],
      added: ['应用默认启动界面改为图库'],
    },
  },
  {
    version: '0.1.4',
    date: '2026-09-02',
    importance: 'patch',
    groups: {
      fixed: ['原生菜单「使用帮助」无法打开使用指南弹窗的问题'],
    },
  },
  {
    version: '0.1.3',
    date: '2026-09-02',
    importance: 'normal',
    groups: {
      added: ['安装包改用 NSIS 格式，支持静默安装与覆盖升级'],
    },
  },
  {
    version: '0.1.2',
    date: '2026-09-02',
    importance: 'patch',
    groups: {
      improved: ['内测迭代：稳定性修复与体验优化'],
    },
  },
  {
    version: '0.1.1',
    date: '2026-09-02',
    importance: 'patch',
    groups: {
      improved: ['内测迭代：稳定性修复与体验优化'],
    },
  },
  {
    version: '0.1.0',
    date: '2026-09-01',
    importance: 'major',
    groups: {
      added: [
        '首个内测版本：照片相框与背景合成、图库管理、EXIF 信息展示、批量导出',
        'GPU 首选项（独显 / 核显指定）、打包版终端窗口闪烁修复',
      ],
    },
  },
]

/**
 * 语义化版本比较（支持任意段数，缺失段按 0 处理）：
 * 返回 a<b → -1，a===b → 0，a>b → 1。仅比较数字段（本项目版本均为 0.1.x 形态）。
 */
export function compareVersions(a: string, b: string): number {
  const pa = a.split(/[.-]/).map((s) => Number(s) || 0)
  const pb = b.split(/[.-]/).map((s) => Number(s) || 0)
  const len = Math.max(pa.length, pb.length)
  for (let i = 0; i < len; i++) {
    const va = pa[i] ?? 0
    const vb = pb[i] ?? 0
    if (va !== vb) return va < vb ? -1 : 1
  }
  return 0
}

/** 按版本号查更新条目（未入日志的版本返回 null） */
export function findUpdateEntry(version: string): UpdateEntry | null {
  return UPDATE_LOG.find((e) => e.version === version) ?? null
}
