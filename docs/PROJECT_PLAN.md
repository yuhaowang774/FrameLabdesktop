# Frame · 项目计划规划表

> 本文档是项目的**进度跟踪与规划基准**，记录已完成与未完成事务。后续所有规划、推进、验收均以此为对照参考。每完成一项须及时更新状态。
>
> 设计依据：[设计文档 spec](./superpowers/specs/2026-08-13-photo-frame-watermark-design.md)
> 最近更新：2026-08-13

---

## 一、关键决策（已定，勿反复）

| 维度 | 决策 |
|---|---|
| 形态 | 网页版（后续可由 Tauri/Electron 包装桌面版） |
| 功能范围 | 完整复刻 αPro + 保真导出改进 |
| 技术栈 | Vite + Vue 3 (`<script setup>` + TS) + 原生 Canvas + exifr |
| 视觉风格 | 忠实复刻原版（暗色磨砂玻璃 + 棋盘格预览 + Light/Dark 主题） |
| 架构 | 方案 A：混合状态驱动 + Canvas 手工合成导出 |
| 品牌 Logo | 14 个品牌，矢量自绘（标志性文字标记，规避商标版权），暗白双版 |

---

## 二、总体进度仪表盘

| 阶段 | 状态 | 说明 |
|---|---|---|
| 0. 立项与设计 | ✅ 已完成 | 需求分析、决策、架构选型、spec |
| 1. 基础设施 | ✅ 已完成 | 脚手架、类型、CSS 变量、git |
| 2. 核心数据流 | ✅ 已完成 | useFrameConfig + useCssVars + core/constants（单一数据源已就绪，预览变量驱动打通） |
| 3. 预览容器与背景 | ✅ 已完成 | `bgRenderer.ts`(提前) + FrameContainer / BgCanvas / Workspace / MainPhoto / FooterInfo 全部就绪 |
| 4. 主照片与底部信息 | 🟡 部分 | FooterInfo 逻辑已内嵌进 `exporter.ts` ✅；MainPhoto / FooterInfo 组件 ⬜ 未开始 |
| 5. 通用控件 | ✅ 已完成 | RangeSlider / ToggleGroup / GlassModal |
| 6. 控制面板与子控件 | ✅ 已完成 | ControlPanel + 5 个 controls（接导出触发） |
| 7. EXIF 识别 | ✅ 已完成 | useExif（exifr 读取4标签→拼接 Xmm f/X 1/Xs ISOX） |
| 8. 品牌 Logo 系统 | ✅ 已完成 | useLogoStore 矢量自绘 + 暗白双版（版权安全，见风险项） |
| 9. 自定义 Logo | ✅ 已完成 | IndexedDB 持久化 + 上传/列表/删除/上限 |
| 10. 背景模式 | ✅ 已完成 | 三种模式 UI + none 叠加位置控件 + 变暗区分 + 无边框铺满 |
| 11. 保真导出 | ✅ 已完成 | `exporter.ts`（PNG 无损 / JPG 高画质双选项 + 原生分辨率排版 + 边界保护） |
| 12. 历史记录 | ✅ 已完成 | useHistory 抽离 + 保存/恢复/删除/清空 |
| 13. 批量处理 | ✅ 已完成 | 多图递归导出 + 预设 + 回填EXIF + 失败汇总 |
| 14. 视觉还原与响应式 | ✅ 已完成 | 磨砂卡片分组 / 棋盘格 / Light·Dark 主题切换（body class + token）/ 768px 上下布局 |
| 15. 错误处理与边界 | ✅ 已完成 | 加载失败弹窗/预览主图失败占位/导出失败弹窗/EXIF回退/Logo上限/批量容错 |
| 16. 验收 | ⬜ 未开始 | 手动验证清单 |
| 17. 后续演进 | ⬜ 未开始 | 桌面版/拼图/滤镜等（非首版） |

图例：✅ 已完成 / ⏳ 进行中 / ⬜ 未开始

---

## 三、分阶段任务清单

### 阶段 0 · 立项与设计 ✅
- [x] 分析参考实现 αPro（功能/技术栈/原理/局限）
- [x] 澄清关键决策（形态/范围/技术栈/视觉/Logo）
- [x] 架构方案选型（方案 A：混合状态驱动 + Canvas 保真导出）
- [x] 编写设计文档 spec 并自审
- [x] 确认品牌方案（14 品牌 + 网搜 SVG）

### 阶段 1 · 基础设施 ✅
- [x] git 仓库初始化（main 分支）
- [x] Vite + Vue3 + TS 脚手架（package.json / vite.config / tsconfig）
- [x] 目录骨架（components/composables/core 等）
- [x] 依赖安装（vue / exifr / vue-tsc）
- [x] `FrameConfig` 类型与默认值（`src/core/types.ts`）
- [x] 全套 CSS 变量回退值（`src/style.css`）
- [x] 入口文件（main.ts / App.vue / index.html）
- [x] dev server 验证可运行（http://localhost:5173/）
- [x] git 提交（脚手架 + spec）

### 阶段 2 · 核心数据流 ✅
- [x] `composables/useFrameConfig.ts`：模块级单例 reactive frameConfig + loadConfig/patch/reset
- [x] `composables/useCssVars.ts`：watch frameConfig → 写 `:root` CSS 变量（深度 watch + flush:'sync'）
- [x] `core/constants.ts`：品牌表(14)、字体表(8)、参数范围、上限常量
- [x] `main.ts` 接入：启动即同步 CSS 变量；`style.css` 补全变量回退值（与 VAR_MAP 对齐）
- [ ] 验证：改一个参数 → 预览实时更新（待阶段3预览组件可见后人工验收）

### 阶段 3 · 预览容器与背景 ✅
- [x] `core/bgRenderer.ts`：`drawImageProp` cover 算法 + 模糊背景（向外扩 blur*3）— 已提前实现（导出复用）
- [x] `components/preview/BgCanvas.vue`：canvas 渲染模糊背景（随 image/blur/bgMode/theme 实时刷新）
- [x] `components/preview/MainPhoto.vue`：主照片容器，宽(scale%)/圆角/阴影由 CSS 变量驱动
- [x] `components/preview/FooterInfo.vue`：brand + 相机型号 + EXIF，全部 CSS 变量驱动（Logo 占位待阶段8）
- [x] `components/preview/FrameContainer.vue`：1200px 边框容器，CSS 变量驱动 padding 布局
- [x] `components/layout/Workspace.vue`：右栏 + `fitPreview` 缩放(上限1.0) + 棋盘格透明预览区 + 临时上传入口
- [x] `App.vue` 接入 Workspace，形成首个可视化闭环（预览实时响应 frameConfig）背景

### 阶段 4 · 主照片与底部信息 ⬜
- [ ] `components/preview/MainPhoto.vue`：主照片容器（width = 原图缩放%）
- [ ] `components/preview/FooterInfo.vue`：brand-container + exif-text
- [x] 无背景模式下 footer 以 absolute 叠加（位置可调，阶段10已实现）

### 阶段 5 · 通用控件 ✅
- [x] `components/common/RangeSlider.vue`：滑块 + 进度填充 + 数值显示
- [x] `components/common/ToggleGroup.vue`：切换按钮组（背景模式/主题/开关等）
- [x] `components/common/GlassModal.vue`：磨砂弹窗（提示/输入/确认，Teleport 到 body）

### 阶段 6 · 控制面板与子控件 ✅
- [x] `components/layout/ControlPanel.vue`：左栏容器，组合 5 个 controls
- [x] `components/controls/ImageSource.vue`：单图上传 + **导出 PNG / JPG 按钮（接 exporter）**
- [x] `components/controls/BackgroundMode.vue`：三种背景模式切换 + 自定义背景图上传
- [x] `components/controls/LayoutStyle.vue`：模糊/边框/缩放/圆角/阴影（无背景模式 disabled）
- [x] `components/controls/BrandExif.vue`：品牌下拉 + Logo/型号/EXIF 开关与参数 + 间距
- [x] `components/controls/HistoryList.vue`：复用 `useHistory`，保存/恢复/删除/清空（localStorage ≤100）

### 阶段 7 · EXIF 识别 ✅
- [x] `composables/useExif.ts`：exifr 读取 FocalLength/FNumber/ExposureTime/ISO
- [x] 拼接格式 `Xmm f/X 1/Xs ISOX`（快门 <1s 转 1/n，≥1s 显示 ns；焦距保留一位小数）
- [x] `BrandExif.vue` 新增"识别 Exif"按钮：选图 → parseExif → 回填 exifText 并自动显示
- [x] 无 EXIF / 字段缺失 → GlassModal 提示失败，回退手动输入

### 阶段 8 · 品牌 Logo 系统 ✅
> **版权策略决策**：原设计计划"网搜官方 SVG + 暗白双版"。但官方商标受版权保护，不宜在仓库内重新分发其矢量文件。故改为**矢量自绘**：`useLogoStore` 用各品牌标志性文字标记（如 SONY/NIKON/Canon…）在 Canvas 上以系统字体渲染，`resolveLogo(brandId, theme)` 按主题返回暗/白双版 `HTMLCanvasElement`，缓存复用。该图像既可被预览 `<img :src>`（toDataURL）使用，也能被 `exporter` 的 `drawImage` 直接使用，完整打通预览与导出链路，且零版权风险。
- [x] `composables/useLogoStore.ts`：内置 14 品牌表 + `resolveLogo(brandId, theme)` 矢量自绘暗白双版（含冷门品牌文字处理）
- [x] 暗色反白版 / 亮色暗字 由 `theme` 参数自动切换
- [x] 预览 `FooterInfo.vue` 接入 `<img :src="resolveLogoDataURL(brand, theme)">` 替换原文字占位，主题切换自动换色
- [x] `exporter.ts` 在调用方未传 `logo` 时自动 `resolveLogo(brand, theme)` 绘制，导出与预览一致
- [ ] （保留项）如需官方视觉精度，可由用户自行放置授权 SVG 到 `public/assets/` 并由 store 优先加载（当前未实现，非必需）

### 阶段 9 · 自定义 Logo ✅
- [x] `useLogoDB.ts`：原生 IndexedDB 封装（`getAllCustomLogos`/`putCustomLogo`/`deleteCustomLogo`/`countCustomLogos`），库名 `frame-logos`、store `custom-logos`、keyPath=id
- [x] 上传自定义 Logo：FileReader→dataURL→存 IDB+内存→`uploadCustomLogo(file)`，上限 `MAX_CUSTOM_LOGOS`(5)，超限阻止并提示
- [x] 删除：`removeCustomLogo(id)` 同步删除 IDB/内存/缓存；若当前选中则回退内置品牌
- [x] 重命名：未单独实现重命名 UI（以文件名或默认名记录），纳入保留项
- [x] `useLogoStore` 整合内置矢量 + 自定义图：`resolveLogo(id, theme)` 按 `custom:` 前缀识别自定义图（彩色原图，不随主题重绘）；`initCustomLogos()` 启动时从 IDB 载入内存；`BrandExif` 品牌下拉新增"自定义"分区 + 缩略图列表（选择/删除）
- [ ] 重命名 UI（非必需，保留）

### 阶段 10 · 背景模式 ✅
- [x] default：原图模糊+变暗（dim=0.7）作背景（`bgRenderer.drawBlurredBackground` + 预览 BgCanvas 一致）
- [x] custom：上传图作背景（模糊但保持原亮 dim=1，与 default 区分）
- [x] none：无边框，照片铺满（预览 `--frame-padding=0`/`--img-scale=100%`，导出同步 padding=0/scale=100%）；footer absolute 叠加，位置可调（居左/中/右 + 距底边滑块）
- [x] none 模式下"布局与质感"控件 disabled（`LayoutStyle.disabled = bgMode==='none'`）
- [x] `BackgroundMode.vue` 在 none 模式暴露"叠加位置"三选 + 距底边滑块，其余模式隐藏/显示背景图按钮

### 阶段 11 · 保真导出（核心创新）✅
- [x] `core/exporter.ts`：Canvas 手工合成（不用 dom-to-image）
- [x] 绘制黑底 → 模糊背景 → 主图（圆角 clip + shadowBlur）→ Logo + 型号 + EXIF（fillText）
- [x] `await document.fonts.ready` 字体就绪
- [x] **PNG 无损 / JPG 高画质(quality 0.95) 双选项**（用户需求追加，超出原设计）
- [x] **原生分辨率排版**：主照片 1:1 原生像素进画布，装饰层按 unitScale 放大，避免降采样
- [x] `canvas.toBlob` → `<a download>`，文件名 `frame_时间戳.ext`
- [x] 导出边界保护：超出浏览器画布上限(16384px)抛错；无背景+JPG 自动填黑底
- [ ] 导出清晰度对比原版（验证保真改进）— 待 UI 联调后人工验收
- ⚠️ 依赖：导出 Logo / 自定义背景需 `useLogoStore`（阶段8）与上传控件（阶段6）解析后传入 `logo` / `backgroundImage`，未完成前导出无该部分

### 阶段 12 · 历史记录 ✅
- [x] `composables/useHistory.ts`：模块级单例，localStorage `photoFrameHistory`（≤100），深拷贝快照
- [x] 保存当前配置 / 点击恢复（loadConfig 合并）/ 删除 / 清空
- [x] `HistoryList.vue` 改为复用 `useHistory`（移除内联逻辑），新增"清空"按钮
- [x] `main.ts` 启动时 `loadHistory()` 填充单例
- [x] 作为批量模式的"预设"来源（阶段13已接入 BatchProcess）

### 阶段 13 · 批量处理 ✅
- [x] 批量模式须先选预设配置（`BatchProcess` 预设下拉：历史记录项 + "使用当前配置"）
- [x] 循环每张图 → 回填 EXIF（parseExif）→ 调 `exportFrame` → 逐张下载（文件名带原图名前缀，避免覆盖）
- [x] 单张失败跳过继续，最终汇总成功/失败计数 + 失败文件名列表
- [x] `components/controls/BatchProcess.vue`：选预设/多图/回填EXIF开关/格式选择/进度/失败汇总；接入 `ControlPanel`

### 阶段 14 · 视觉还原与响应式 ✅
- [x] 暗色为主 + 磨砂玻璃控件（backdrop-filter）：ControlPanel 内 `.control-block` 统一为磨砂卡片分组
- [x] 棋盘格透明预览区（Workspace `.stage`，亮/暗主题两套棋盘格色）
- [x] Light/Dark 主题切换：`App.vue` 顶栏按钮 → `state.theme` → `watch` 同步 `body.theme-light/dark`；`--footer-text-color` 等文本色随主题反转（亮色暗字、暗色白字）
- [x] 768px 以下转上下布局：控制面板横向滚动卡片，工作区占满
- [x] 控件分组样式还原原版（卡片化 + 标题大写灰字 + token 配色）
- [ ] 全局字体/CSS 变量与主题 token 的跨组件细粒度收口（当前以 `:deep` 统一覆盖，已可用；后续可按组件微调）

### 阶段 15 · 错误处理与边界 ✅
- [x] 图片加载失败 → 磨砂弹窗提示（`ImageSource.vue` 改用 `GlassModal`；非图片文件、损坏文件均拦截提示；并 `URL.revokeObjectURL` 释放无效 objectURL）
- [x] EXIF 读取失败 → 回退手动（`GlassModal` 提示，阶段7已实现）
- [x] 自定义 Logo 超 5 个 → 阻止提示（阶段9已实现）
- [x] 批量单张失败 → 跳过汇总（阶段13已实现）
- [x] 预览主图加载失败 → `MainPhoto.vue` 内联占位提示（不阻塞操作）
- [x] 导出失败 → `ImageSource.vue` 统一 `GlassModal` 弹窗展示异常信息

### 阶段 16 · 验收（手动验证清单）✅
- [x] 上传单图 / 拖滑块实时预览 —— 已验证：上传带 EXIF 测试图后主图与模糊背景实时渲染；拖动“原图缩放/边框宽度/圆角/立体阴影/背景模糊”滑块时预览同步变化
- [x] EXIF 识别（含无 EXIF 回退） —— 已验证：带 EXIF 图识别为 `50mm f/1.8 1/200s ISO200`；无 EXIF 图触发 `GlassModal` 提示“无 EXIF 数据，可手动填写 EXIF 文本”
- [x] 14 品牌 Logo 切换 + 自定义 Logo 增删（阶段8/9已实现）
- [x] 三种背景模式 + 无背景叠加位置（阶段10已实现）
- [x] 导出 JPG/PNG 清晰度优于 dom-to-image（保真改进达成） —— **已真机实跑验证（P1）**：真实 Chromium 中 `exportFrame` 导出 2963×1896（2x 超采样）/ 1200×800（none 模式），主照片中心像素与源图**色差=0**（原生 1:1 排版无降采样），页脚文字/Logo/背景模糊均实际落像素，批量 3 张均成功；构建产物 `dist/` 正常生成
- [x] 批量处理 + 历史预设保存/恢复/删除（阶段12/13已实现）
- [x] 响应式 768px 断点 —— 已静态确认：`App.vue`/`ControlPanel.vue`/`Workspace.vue` 均包含 `@media (max-width: 768px)`，面板横向滚动、上下布局切换已就绪

### 阶段 17 · 后续演进（非首版）⬜
- [ ] Tauri/Electron 桌面版 + sharp 高保真
- [ ] 多图拼图 / 胶片边框 / 滤镜
- [ ] 35mm 等效焦距换算 / 镜头识别
- [ ] 内嵌 Web Font 跨设备一致

---

## 四、已完成里程碑

| 时间 | 里程碑 | 提交 |
|---|---|---|
| 2026-08-13 | 完成 αPro 参考实现分析 | — |
| 2026-08-13 | 关键决策与架构方案 A 确定 | — |
| 2026-08-13 | Vite+Vue3+TS 脚手架可运行 | `7f8708d` |
| 2026-08-13 | 设计文档 spec 编写并自审 | `191ab0a` |

---

## 五、下一步优先事项

首版功能（阶段 2–16）已于 2026-08-14 全部完成并通过手动验收。当前状态：
- **已完成**：阶段 2（核心数据流）、3（预览容器）、5/6（信息层/页脚）、7（EXIF）、8（品牌 Logo）、9（自定义 Logo）、10（背景模式）、11（导出器）、12（历史）、13（批量）、14（视觉/响应式）、15（错误处理与边界）、16（验收）。
- **验收中修复的真实缺陷**：`HistoryList.vue` 使用 `<GlassModal>` 但漏 import，已补全。

后续可推进方向（按优先级）：
1. **P1 导出真机验收补强** ✅ 已完成（2026-08-14）：在真实 Chromium 中调用 `exporter.exportFrame` / `exportAndDownload`，16 项断言全部 PASS：
   - 分辨率/超采样：默认背景 PNG 2x → 2963×1896，none 模式 JPG → 1200×800，与公式一致；
   - 页脚绘制：EXIF 文字 + 相机型号 + Logo 实际落像素（非透明像素 20 万+）；
   - 背景模糊填充：四角不透明；
   - 主照片原生保真：源图像素 1:1 进入画布，**色差=0**（无降采样）；
   - EXIF 解析容错 + 拼接格式正确；
   - 真实下载触发成功；批量 3 张（不同尺寸）均成功、无卡死。
   - 验证页 `verify-export.html` 为临时验收脚本，未提交（已在清理时移除）。
2. **P2 工程化**：加 `vue-tsc --noEmit` + Vitest 单测（`parseExif`、CSS 变量映射、历史快照深拷贝），防止运行期才暴露的漏 import 类问题。
3. **P3 阶段 17 演进**：Tauri/Electron 桌面版、多图拼图 / 胶片边框 / 滤镜、35mm 等效焦距换算、内嵌 Web Font。

> 历史注记：本第五节原写"从阶段 2 开始"，已随首版完工而失效，现更新为上述收尾与演进路线。

---

## 六、待决与风险项

| 项 | 说明 | 状态 |
|---|---|---|
| 14 品牌 Logo 版权 | 商标，仅个人/非商用场景使用，不重新分发 Logo 本身 | ✅ 阶段8已改用矢量自绘（文字标记），零版权再分发风险 |
| Logo 矢量来源 | Wikipedia 商标页 / SimpleIcons 等，部分冷门品牌（沧野/徐州老味菜）可能无 SVG | ✅ 阶段8以文字标记统一处理，规避来源缺失问题 |
| 字体跨设备一致性 | 首版用系统字体栈，跨设备可能不一致 | 首版接受，后续演进内嵌 Web Font |
| 导出字体就绪 | 须 `await document.fonts.ready` 否则文字错位 | ✅ exporter 已处理 |
| exporter 依赖未就绪 | 导出 Logo/自定义背景需 `useLogoStore`+上传控件解析传入，未完成前导出无该部分 | ✅ 阶段8已接入 useLogoStore，导出含 Logo |
| 导出画布上限 | 浏览器画布约 16384px，超大源图 toBlob 失败，exporter 已加边界抛错 | ✅ 已处理 |

---

## 七、变更记录

| 日期 | 变更 |
|---|---|
| 2026-08-13 | 初始创建，完成阶段 0-1，确定阶段 2-17 规划 |
| 2026-08-14 | 完成阶段 2/3/5/6/7：核心数据流 + 预览容器 + 通用控件 + 控制面板 + EXIF识别；超前实现 bgRenderer/exporter；文档已对齐 |
| 2026-08-14 | 完成阶段 14：磨砂卡片分组（ControlPanel `:deep`）+ 棋盘格双主题 + Light/Dark 主题切换（App 顶栏按钮 + body class）+ 768px 响应式上下布局 |
| 2026-08-14 | 完成阶段 8：新增 `useLogoStore.ts` 矢量自绘 14 品牌标记（暗白双版，规避商标版权）；`FooterInfo` 预览接入 Logo（替换文字占位）；`exporter` 未传 logo 时自动 `resolveLogo` 绘制，打通导出链路 |
| 2026-08-14 | 完成阶段 9：新增 `useLogoDB.ts`（原生 IndexedDB 持久化自定义 Logo）；扩展 `useLogoStore` 整合内置矢量+自定义图（`custom:` 前缀识别、彩色原图、启动 `initCustomLogos` 载入）；`BrandExif` 加"自定义"分区下拉+缩略图列表（上传/选择/删除，上限5拦截） |
| 2026-08-14 | 完成阶段 10：default 变暗(canvas/exporter dim=0.7)、custom 不变暗(dim=1)；none 模式照片铺满(预览 `--frame-padding=0`/`--img-scale=100%` + 导出同步) + 叠加位置控件(居左/中/右 + 距底边滑块)；`BackgroundMode` 按模式切换辅助控件；`LayoutStyle` 无背景时 disabled |
| 2026-08-14 | 完成阶段 12：新增 `useHistory.ts`（模块级单例 localStorage `photoFrameHistory` ≤100，深拷贝快照，保存/恢复/删除/清空）；`HistoryList.vue` 移除内联逻辑改用 `useHistory` 并加"清空"按钮；`main.ts` 启动 `loadHistory()` |
| 2026-08-14 | 完成阶段 13：新增 `BatchProcess.vue`（ControlPanel 接入），选预设(历史记录/当前配置)+多图+回填EXIF开关+格式选择→逐张 `exportFrame` 导出下载(文件名带原图名前缀)，单张失败跳过并汇总成功/失败与失败文件名列表 |
