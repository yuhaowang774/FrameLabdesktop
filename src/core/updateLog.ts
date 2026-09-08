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
    version: '0.2.2',
    date: '2026-09-08',
    importance: 'patch',
    groups: {
      fixed: [
        '大幅降低内存占用：缩略图生成改用「解码即降采样」并立即释放位图，不再滞留每张数百 MB 的全尺寸解码缓存（此前仅 6 张照片常驻内存即可达 2GB、峰值 4GB）',
        '批量导出改为逐张释放解码位图：不再随导出张数累积内存（此前几十张批量导出会持续上涨直至崩溃）',
        '预览画布内存占用减半（降采样上限 6144 → 4096，仍覆盖 4K 显示尺寸；导出质量不受影响）',
      ],
    },
  },
  {
    version: '0.2.1',
    date: '2026-09-08',
    importance: 'patch',
    groups: {
      fixed: [
        '修复胶片条 / 导出页多选照片后应用崩溃（Out of Memory 白屏错误页）的问题：桌面端缩略图此前一直生成失败并回退直接解码原图，多张大图同时解码耗尽内存——现缩略图真正生成成功（读盘转同源源图），且全局限流同时最多解码 2 张，批量导入也不会再撑爆内存',
        '缩略图未就绪时显示占位底色，不再回退加载原图',
      ],
      added: [
        '新增运行时错误弹窗：脚本错误 / 异步错误 / 组件错误 / 资源加载失败会弹窗提醒并展示详情，可一键复制反馈给开发者；错误详情自动记录到本地日志（AppData/FrameLab/logs）',
        '新增启动看门狗（白屏自愈）：启动失败时显示恢复界面，支持「清除缓存并重启」「禁用 GPU 加速重启」一键自救，错误同样落盘便于定位',
      ],
    },
  },
  {
    version: '0.2.0',
    date: '2026-09-08',
    importance: 'normal',
    groups: {
      improved: [
        '导出界面全面适配不同屏幕尺寸：宽屏采用「左配置 / 右选片」双栏布局，空间利用更充分；窗口拖窄时自动堆叠为单列',
        '导出页缩略图网格随窗口大小伸缩（列宽与高度自适应），吸底任务卡在窄窗口下自动堆叠、按钮等宽排列',
        '导出预览弹窗升级：大屏图片区域更大（宽度封顶 1100px），图片高度随弹窗自适应，窄窗口下文件名与按钮自动换行',
        '新增项目 README 与仓库简介',
      ],
    },
  },
  {
    version: '0.1.31',
    date: '2026-09-07',
    importance: 'major',
    groups: {
      added: [
        '照片自由旋转：编辑照片新增任意角度滑杆（-180°~180°，0.5° 细步），可拉直地平线 / 微调构图',
        '底部工具栏新增「同步设置」：把当前照片的相框 / 背景 / INFO 样式一键同步到按住 Ctrl 多选的照片（对标 Lightroom；各照片保留自身 EXIF，且可在各自历史中撤销）',
        '撤销 / 重做移至底部工具栏常驻入口（不再折叠在左栏面板内；Ctrl+Z / Ctrl+Shift+Z 与原生菜单不变）',
        'INFO 信息设置新增「组合拖动」与「整体居中」：多个信息元素成组整体移动、一键对齐画布中轴，拖动时自动吸附居中参考线',
        '自定义 Logo 支持文本直接生成：输入文字即可生成文字标，与上传 Logo 同样持久化、全链路可用',
        '新增意见反馈入口：使用指南与帮助菜单可直接查看反馈邮箱，或前往 GitHub 提 Issue',
      ],
      improved: [
        '整体性能优化：滑块拖动、Logo 换色、模糊背景等高频操作显著更流畅（历史快照合帧、Logo 多级缓存、画布重复合帧）',
        'Logo 颜色变化即时生效：取色器连续拖动不再延迟（此前要等数秒才变色）',
        '手机品牌 Logo 更换为官方矢量图形（小米 / 华为 / 三星 / 一加 / OPPO / vivo / 荣耀 / 魅族 / 苹果），切换品牌自动套用品牌主色；Redmi / realme / iQOO 无官方矢量，保持文字标',
        '「我的模板」升级为与相框模板库同构的弹窗：当前照片实时合成预览、批量应用、保存表单内嵌弹窗顶部',
        '已保存的模板支持重命名（我的模板弹窗内 ✎ 按钮）',
        '新导入照片默认带 60 边框（此前默认无边框，需手动调大才能看到边框效果）',
        '更新记录显示各版本发布的具体时间',
      ],
      fixed: [
        '修复照片在画布上显示不完整、位置偏移的问题（旋转 / 裁剪合成管线坐标基准错误，预览与导出均受影响）',
        '修复编辑照片中旋转 90° 后照片比例失真的问题（编辑器预览改用与导出完全同源的合成管线）',
        '移除右栏面板头的背景 / 边框 / INFO 显示开关：面板头仅保留折叠与复位，避免与面板内部开关混淆',
        '移除「型号距 Logo」间距设置（多数布局下无可见效果，间距由布局引擎统一决定）',
      ],
    },
  },
  {
    version: '0.1.30',
    date: '2026-09-06',
    importance: 'normal',
    groups: {
      improved: [
        '移除「修改历史记录」面板：撤销 / 重做按钮移至编辑页左栏原位置（Ctrl+Z / Ctrl+Shift+Z 快捷键与菜单不变）',
        '窗口标题改为显示当前版本号（FrameLab vX.X.X）',
      ],
      fixed: [
        '修复软件更新后图库照片全部丢失的问题：图库目录与选中照片改为随应用数据文件持久化，更新 / 重装后自动还原（旧数据首次启动自动迁移，无需任何操作）',
        '修复拖拽或点击「导入」按钮导入的照片重启软件后不保留的问题：桌面端拖拽与导入现均按磁盘路径记录，与菜单「导入照片…」一致',
      ],
    },
  },
  {
    version: '0.1.29',
    date: '2026-09-06',
    importance: 'normal',
    groups: {
      added: [
        '编辑页左栏新增「我的模板」面板：可把当前相框 / 背景 / INFO 样式一键保存为自定义模板，并支持应用与删除（原导出页「保存当前配置为模板」入口移入左栏）',
        '帮助菜单新增「GitHub 项目主页」入口',
      ],
      improved: [
        '首选项默认导出格式改为 JPG 高画质（此前默认 PNG 无损；已显式选择过格式的用户不受影响）',
        '相框模板库换图提速：新增源图与渲染结果缓存，在模板间来回对比切换基本瞬时',
        '模板库切换模板不再闪烁：缩略图与大预览改为静默换图，旧图保留至新图就绪后直接替换',
      ],
      fixed: [
        '修复编辑画布中相机品牌 Logo 偏小：拖拽热区内边距不再压缩 Logo 高度，实际大小与模板库缩略图 / 导出成片一致',
        '修复相框模板库左侧网格缩略图的 INFO 固定显示内置示意文本（型号 / 参数 / 日期 / 镜头 / 品牌 Logo），与当前照片实际信息不符的问题',
      ],
    },
  },
  {
    version: '0.1.28',
    date: '2026-09-06',
    importance: 'patch',
    groups: {
      fixed: [
        '修复应用模板后拍摄日期与 EXIF 参数行重叠：日期行高度改按实际生效字号预留（此前按机型字号预留，单独调大日期字号时溢出行距）',
        '修复悬浮（inline）布局下拍摄日期与 EXIF 参数行完全重叠：日期改为参数下方独立居中一行',
      ],
    },
  },
  {
    version: '0.1.27',
    date: '2026-09-06',
    importance: 'patch',
    groups: {
      fixed: [
        '修复安装版在非默认安装目录（管理员权限安装 / 自定义路径）被误判为便携版，导致检查更新报 404 的问题（改为按卸载程序特征识别安装版）',
        '修复 0.1.26 安装包被 Windows Defender 误报 Trojan:Win32/Sabsik.FL.A!ml：打开链接 / 系统设置页改用系统 API（ShellExecuteW），不再创建 cmd 子进程',
      ],
    },
  },
  {
    version: '0.1.26',
    date: '2026-09-06',
    importance: 'normal',
    groups: {
      improved: [
        '便携版（绿色版）更新入口改进：不再发布更新时明确提示「下载安装版」并一键打开 GitHub Releases（替代晦涩的 404 报错）',
      ],
    },
  },
  {
    version: '0.1.25',
    date: '2026-09-06',
    importance: 'normal',
    groups: {
      improved: [
        '安装版更新改为静默安装（quiet 模式，无进度窗口，下载后自动完成替换并重启）',
        '便携版（免安装单文件）更新入口增加引导：建议安装安装版以获得全自动更新',
      ],
      fixed: [
        '修复应用模板后「显示镜头型号」无法在画布上显示/拖拽的问题（镜头行在经典 / 双栏 / 悬浮布局均升级为独立可拖拽元素）',
        '修复绿色版在线更新失败：等待旧进程完全退出后再替换 exe，加大防病毒扫描重试余量（残留 FrameLab.exe.new 问题）',
      ],
    },
  },
  {
    version: '0.1.24',
    date: '2026-09-06',
    importance: 'normal',
    groups: {
      improved: [
        '杂志编辑模板标题改为衬线斜体刊头字（Didot 系）+ 新默认文案「Fragments of Light」，与原参考样张拉开区分度',
        '取色色卡在桌面端改用可绘制图源提取，颜色随照片真实变化（此前静默回退兜底色）',
      ],
      fixed: [
        '修复参数行关闭时勾选「显示镜头型号」画布上不显示镜头信息的问题（镜头行升级为独立行，可拖拽定位）',
        '修复桌面端导出报「Tainted canvases may not be exported」失败的问题（asset 协议图源统一读盘转 dataURL 后合成）',
      ],
    },
  },
  {
    version: '0.1.23',
    date: '2026-09-05',
    importance: 'patch',
    groups: {
      fixed: [
        '修复绿色版放在中文路径时在线更新失败的问题（更新脚本改为纯 ASCII 相对路径，不受系统代码页影响；替换改为改名法，重启更快更稳）',
      ],
    },
  },
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
 * 各版本发布的具体时刻（HH:mm，24 小时制），与 UPDATE_LOG 按版本号对应。
 * 数据来源：git 提交历史中「版本 X.X.X」发版提交的时间；缺省（如 0.1.0 早期）不显示时刻。
 */
export const RELEASE_TIMES: Record<string, string> = {
  '0.2.2': '20:17',
  '0.2.1': '19:58',
  '0.2.0': '00:58',
  '0.1.31': '01:50',
  '0.1.30': '18:06',
  '0.1.29': '12:00',
  '0.1.28': '03:17',
  '0.1.27': '02:53',
  '0.1.26': '02:13',
  '0.1.25': '02:02',
  '0.1.24': '01:03',
  '0.1.23': '00:03',
  '0.1.22': '23:32',
  '0.1.21': '22:10',
  '0.1.20': '20:49',
  '0.1.19': '20:29',
  '0.1.18': '19:30',
  '0.1.17': '19:00',
  '0.1.16': '18:49',
  '0.1.15': '18:18',
  '0.1.14': '13:19',
  '0.1.13': '22:52',
  '0.1.12': '21:43',
  '0.1.11': '20:53',
  '0.1.10': '13:43',
  '0.1.9': '13:28',
  '0.1.8': '12:08',
  '0.1.7': '11:41',
  '0.1.6': '11:29',
  '0.1.5': '11:17',
  '0.1.4': '11:10',
  '0.1.3': '11:00',
  '0.1.2': '10:44',
  '0.1.1': '10:20',
}

/** 版本完整发布时间显示文本（YYYY-MM-DD [HH:mm]） */
export function formatReleaseTime(version: string, date: string): string {
  const t = RELEASE_TIMES[version]
  return t ? `${date} ${t}` : date
}

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
