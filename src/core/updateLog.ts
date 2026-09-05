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
    version: '0.1.22',
    date: '2026-09-05',
    importance: 'patch',
    groups: {
      fixed: [
        '修复桌面端模板库弹窗中照片缩略图不显示的问题（asset 协议图源读盘转 dataURL 后合成，缩略图与大预览均恢复正常）',
      ],
    },
  },
  {
    version: '0.1.21',
    date: '2026-09-05',
    importance: 'normal',
    groups: {
      improved: [
        '画面比例：选择 16:9 / 1:1 等预设后，最终整体画布（含边框/背景）宽高比即所选比例，预览与导出一致',
        '白框参数卡模板：下边留白改由边框承担（背景纯色不再向下延伸），与其余纯色模板形制统一',
      ],
      fixed: [
        '绿色版更新批处理改进（循环重试覆盖 + 启动清理残留）',
      ],
    },
  },
  {
    version: '0.1.20',
    date: '2026-09-04',
    importance: 'patch',
    groups: {
      fixed: [
        '修复绿色版检查更新后无法更新到新版本、残留 FrameLab.exe.new 临时文件的问题（更新批处理改为循环重试覆盖，启动时自动清理残留）',
      ],
    },
  },
  {
    version: '0.1.19',
    date: '2026-09-04',
    importance: 'normal',
    groups: {
      improved: [
        '放大/平移后画布外空白区域也可直接拖动平移，抓手光标更清晰',
        '导出选照片：缩略图右上角新增圆圈勾选按钮，直接勾选/取消该照片',
      ],
      fixed: [
        '缩放超过 800% 或低于 10% 后画面发生偏移的问题（达到上下限后画面保持不动）',
        '导出面板点击缩略图预览时不再清空已勾选的照片集合',
      ],
    },
  },
  {
    version: '0.1.18',
    date: '2026-09-04',
    importance: 'normal',
    groups: {
      improved: [
        '应用图标改为圆角设计：白底圆角方形 + A+Z 徽标，窗口 / 任务栏 / 安装包图标统一为圆角效果',
      ],
    },
  },
  {
    version: '0.1.17',
    date: '2026-09-04',
    importance: 'normal',
    groups: {
      improved: [
        '应用图标背景改为纯白（A+Z 徽标白底版），窗口 / 任务栏 / 安装包图标统一为白底效果',
      ],
    },
  },
  {
    version: '0.1.16',
    date: '2026-09-04',
    importance: 'normal',
    groups: {
      improved: [
        '应用图标更换为全新 A+Z 几何徽标（窗口、任务栏、安装包图标同步更新）',
      ],
      fixed: [
        '0.1.15 更新记录缺失（已补写 0.1.15 条目），并增加发版时更新日志校验，防止再遗漏',
      ],
    },
  },
  {
    version: '0.1.15',
    date: '2026-09-04',
    importance: 'major',
    groups: {
      added: [
        '右栏「背景 / 边框 / INFO信息设置」三栏新增显示开关：可独立隐藏背景层、边框层（照片铺满）、INFO 信息，开关自动联动折叠面板',
        '切换开关即打开或收起对应参数面板，开关状态与应用模板互不干扰',
      ],
      improved: [
        '模板库：左侧模板缩略图改用当前选中照片合成，所见即所得',
        '模板库：右栏大预览显示当前照片真实 EXIF 与品牌 Logo（Logo 颜色随模板背景自动适配）',
        '模板库：白框参数卡分隔竖线覆盖信息文字块高度，不再贯穿底部留白',
      ],
      fixed: [
        '复古CCD 日期戳拖拽可超出照片范围的问题',
        '模板缩略图缺少品牌 Logo、白底上 Logo 不可见的问题',
        '显示开关悬浮时出现多余方形边框/背景的问题',
      ],
    },
  },
  {
    version: '0.1.14',
    date: '2026-09-03',
    importance: 'major',
    groups: {
      added: [
        '相框模板库扩充 8 款新模板：白卡装裱 / 白底居中 / 全幅铭牌条 / 银灰测绘 / 胶片暗房 / 轻量悬浮 / 复古CCD / 杂志编辑',
        '新增杂志编辑布局：顶部大标题（可自定义）+ 底部照片自动取色色卡 + 英文杂志式日期',
        '模板库改双列网格视图，缩略图与真实成片布局完全一致',
        '照片取色板：从照片自动提取 5 色生成色卡',
      ],
      improved: [
        '应用模板后 INFO 信息精确定位（画布高度随模板边框参数自动重算）',
        '品牌识别增强：照片 Make 字段缺失时从 Model 兜底识别（佳能 / 索尼机身代号）',
        '模板批量应用后各照片 EXIF 信息自动回填、颜色随模板背景自适应',
      ],
      fixed: [
        '应用模板后 INFO 信息错位的问题',
        '模板缩略图与真实成片位置不一致的问题',
        '复古CCD 日期戳渲染到画布外的问题',
      ],
    },
  },
  {
    version: '0.1.13',
    date: '2026-09-02',
    importance: 'normal',
    groups: {
      added: [
        '绿色版在线自更新：检查更新后直接下载替换自身，无需安装器、不受 SmartScreen 拦截',
        '更新包经过签名校验，校验失败自动拒绝安装',
      ],
      improved: [
        '首选项「软件更新」按安装版 / 绿色版自动切换更新方式',
      ],
    },
  },
  {
    version: '0.1.12',
    date: '2026-09-02',
    importance: 'normal',
    groups: {
      added: [
        '历史更新记录：升级完成后自动弹出本次更新详情弹窗',
        '首选项「关于 → 更新记录」可查看全部版本的新增功能 / 功能优化 / 问题修复 / 已知问题',
      ],
    },
  },
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
