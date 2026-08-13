# Frame · 照片边框水印工具 — 设计文档

- 日期：2026-08-13
- 状态：待审查
- 参考实现：`https://app.proplusmax.com/apro/desktopUI.html`（αPro，纯网页端，DOM→Canvas 导出有损）

## 1. 目标与非目标

### 目标
- 做一个网页端照片边框水印工具，完整复刻 αPro 的功能集，并**改进导出为保真输出**。
- 给照片加"模糊背景 + 品牌 Logo + 相机型号 + EXIF 参数"的专业边框，类似相机厂商官方样片风格。

### 非目标（首版不做）
- 不做视频水印、不做滤镜/胶片特效、不做多图拼图。
- 不做后端与云同步，所有数据本地存储。
- 不做账号/付费/多端同步。

## 2. 关键决策

| 维度 | 决策 |
|---|---|
| 形态 | 网页版（浏览器即用，后续可由 Tauri/Electron 包装为桌面版） |
| 功能范围 | 完整复刻 αPro + 保真导出改进 |
| 技术栈 | Vite + Vue 3 (`<script setup>` + TS) + 原生 Canvas + exifr |
| 视觉风格 | 忠实复刻原版：左控制栏 + 右预览、暗色为主、磨砂玻璃控件、棋盘格透明预览区、Light/Dark 主题 |
| 架构 | 方案 A：混合状态驱动 + Canvas 手工合成导出 |
| 品牌 Logo | 14 个品牌，SVG 矢量，素材从公开来源搜索获取 |

## 3. 架构（方案 A）

```
用户操作 ──▶ frameConfig (Vue ref，单一数据源)
                │
        ┌───────┴────────┐
        ▼                ▼
  useCssVars          exporter.ts
  (watch→CSS变量)     (Canvas手工合成)
        │                │
        ▼                ▼
   预览实时更新       保真导出图片
```

- **预览路径**：`frameConfig` → `useCssVars` watch → 写 `:root` CSS 变量 → 预览自动更新。保留原版"CSS 变量驱动布局"的优雅与性能。
- **导出路径**：`exporter` 读取**同一份** `frameConfig` → Canvas `drawImage`+`fillText` 合成 → 保真输出。
- **单一数据源**：预览与导出共享 `frameConfig`，从根本上避免原版"预览和导出各算一遍容易不一致"的隐患。

## 4. 数据模型 `FrameConfig`

单一响应式模型，集中所有参数（预览与导出共同来源）。已实现于 `src/core/types.ts`：

```ts
interface FrameConfig {
  bgMode: 'default' | 'custom' | 'none'
  overlayAlign: 'left' | 'center' | 'right'; overlayBottom: number
  blur: number; padding: number; scale: number        // 布局
  radius: number; shadow: number                       // 质感
  brand: string; showLogo: boolean; logoSize: number; logoOpacity: number
  showExif: boolean; exifText: string
  fontFamily: string; fontSize: number; textWeight: number; textOpacity: number
  distPhotoLogo: number; distLogoText: number; distBottom: number
  showCameraModel: boolean; cameraModel: string
  cameraModelFont: string; cameraModelSize: number; cameraModelWeight: number
  cameraModelGap: number; cameraModelOpacity: number; cameraModelItalic: boolean
  cameraModelOffsetX: number; cameraModelOffsetY: number
  theme: 'light' | 'dark'
}
```

## 5. 功能模块清单（完整复刻 αPro）

### 5.1 图像源
- 单图上传 / 批量模式（多选 `multiple`）
- 批量模式必须先选一个"预设配置"（从历史记录选），否则报错

### 5.2 背景模式（三选一）
- **原背景**(default)：用原图本身模糊+变暗作边框背景
- **自定义**(custom)：上传一张图作背景
- **无背景**(none)：不要边框，footer 信息以 absolute 叠加在原图上，可调叠加位置（居左/中/右 + 距底边）。无背景模式下"布局与质感"控件全部 disabled

### 5.3 布局与质感
| 参数 | 范围 | 默认 | CSS 变量 |
|---|---|---|---|
| 背景模糊 | 0–100px | 40 | canvas filter |
| 边框宽 Padding | 20–200px | 80 | `--frame-padding` |
| 原图缩放 | 50–100% | 90 | `--img-scale` |
| 圆角 | 0–100px | 20 | `--border-radius` |
| 立体阴影 | 0–1 | 0.5 | `--shadow-opacity` |

### 5.4 品牌与参数
- Light/Dark 主题（切换 Logo 路径 `./assets/logo/` ↔ `./assets/darklogo/`，改 `--footer-text-color`）
- 品牌 Logo 预设：14 个内置品牌（见 §9）
- 自定义 Logo：上传（IndexedDB 持久化，上限 5 个），可重命名、可删除（删除模式）
- Logo 显示/隐藏、大小(10–150px)、透明度
- EXIF 参数：显示/隐藏 + 一键"识别 Exif"（自动填入）+ 手动输入框；字体 8 选；文字大小、粗细(100–900)、透明度
- 间距控制：Logo 距原图、参数距 Logo、参数距底边
- 相机型号：显示/隐藏、正常/斜体、型号文本、独立字体/大小/粗细/距Logo/透明度、水平&垂直位置微调(-60~60px)

### 5.5 历史记录
- "保存当前配置" → localStorage（key `photoFrameHistory`，数组，≤100 条）
- 点击历史项恢复配置，可删除
- 历史记录同时也是批量模式的"预设"来源

### 5.6 导出
- "下载原格式图片"：JPG 输入→JPG(quality 0.95)，否则 PNG；2 倍分辨率；文件名 `frame_时间戳.ext`
- 批量：`frame_batch_序号_时间戳.ext`，逐张递归处理

## 6. 数据流

1. 拖滑块 → 更新 `frameConfig` ref
2. `useCssVars` watch → 写 `:root` CSS 变量 → 预览实时更新
3. "识别 Exif" → `useExif`（exifr 库）读图 → 回填 `exifText`
4. "下载" → `exporter.export(frameConfig, sourceImage, {scale:2})` → Canvas 合成 → 下载
5. "保存配置" → `useHistory` 序列化 `frameConfig` → localStorage
6. 批量：循环每张图 → 回填 EXIF → 调 exporter → 逐张下载

## 7. 保真导出 `exporter.ts`（核心创新，区别于原版）

不用 dom-to-image，纯 Canvas 手工合成：

1. 建 canvas，逻辑尺寸 1200×动态高（按内容算）
2. 绘制黑底
3. `bgMode≠none`：`drawImageProp` 绘模糊背景（`ctx.filter = blur() brightness(0.7)`）
4. 算 padding/scale，绘制主图（圆角用 `clip` 路径，阴影用 `shadowBlur`）
5. 绘制 footer：Logo（`drawImage`，先 `await loadImage`）+ 相机型号 + EXIF（`fillText`）
6. **字体就绪**：`await document.fonts.ready` 后再绘制，避免字体未加载导致文字错位
7. `canvas.toBlob` → `<a download>`，JPG `quality:0.95`，PNG 无损；支持 2x/3x 倍率

### `bgRenderer.ts`（预览背景渲染 + 导出复用）
- `drawImageProp(ctx, img, ...)`：经典 cover 模式裁剪算法（按宽高比缩放取大值，居中裁剪，填满画布）
- 模糊时向外扩展 `blur*3` 像素，避免边缘透明

## 8. 持久化

| 数据 | 存储 | key/库 |
|---|---|---|
| 配置历史/批量预设 | localStorage | `photoFrameHistory` (JSON 数组, ≤100) |
| 相机型号设置 | localStorage | 单独 key |
| 自定义 Logo 图 | IndexedDB | 库 `PhotoFrameDB`，store `logos`，keyPath=`name`，上限 5 |

## 9. 品牌 Logo 资源方案

- **14 个品牌**：Sony, Nikon, Canon, Fujifilm, Hasselblad, Leica, Ricoh, Zeiss, Pentax, DJI, Panasonic, Olympus, 沧野(caye), 徐州老味菜(xuzhou)
- **格式**：SVG 矢量（缩放不糊），暗色主题用反白版（`./assets/darklogo/`）
- **来源**：实现阶段从公开来源（Wikipedia 商标页 / SimpleIcons 等开源图标库）搜索获取矢量 SVG
- **版权说明**：品牌 Logo 为各自公司商标，本工具仅用于用户给自己照片添加拍摄设备标识（个人/非商用场景），不重新分发 Logo 本身

## 10. 错误处理

- 图片加载失败 → 磨砂弹窗提示，不崩溃
- EXIF 读取失败 → 回退手动输入（沿用原版）
- 自定义 Logo 超 5 个 → 阻止并提示
- 导出前 `await document.fonts.ready`
- 批量单张失败 → 跳过继续下一张，最终汇总

## 11. 测试策略

遵循用户规则**默认不写自动化测试代码**。改用**手动验证清单**，每阶段一份 checklist：
- 上传单图 / 拖滑块实时预览
- EXIF 识别（含无 EXIF 回退）
- 14 个品牌 Logo 切换 + 自定义 Logo 增删
- 三种背景模式（原/自定义/无）+ 无背景叠加位置
- 导出 JPG/PNG 清晰度对比原版（验证保真改进）
- 批量处理 + 历史预设保存/恢复/删除

## 12. 目录结构

```
frame/
├── docs/superpowers/specs/          # 本设计文档
├── public/assets/{logo,darklogo}/   # 内置品牌 Logo (SVG)
├── src/
│   ├── components/
│   │   ├── layout/      ControlPanel.vue · Workspace.vue
│   │   ├── controls/    ImageSource · BackgroundMode · LayoutStyle · BrandExif · HistoryList
│   │   ├── preview/     FrameContainer · BgCanvas · MainPhoto · FooterInfo
│   │   └── common/      RangeSlider · ToggleGroup · GlassModal
│   ├── composables/     useFrameConfig · useCssVars · useExif · useLogoStore · useHistory
│   ├── core/            exporter.ts · bgRenderer.ts · types.ts · constants.ts
│   ├── App.vue · main.ts · style.css · vite-env.d.ts
├── index.html · package.json · vite.config.ts · tsconfig*.json · .gitignore
```

## 13. 组件与 composable 职责

| 单元 | 职责 | 依赖 |
|---|---|---|
| `useFrameConfig` | `frameConfig` 状态 + 初始化默认值 | `types.ts` |
| `useCssVars` | watch `frameConfig` → 写 `:root` CSS 变量 | `useFrameConfig` |
| `useExif` | exifr 读取 4 标签 → 拼接 `Xmm f/X 1/Xs ISOX` | exifr |
| `useLogoStore` | IndexedDB 增删查 + 内置品牌表 | `constants.ts` |
| `useHistory` | localStorage 历史预设 CRUD (≤100) | `types.ts` |
| `exporter.ts` | Canvas 手工合成导出（保真） | `bgRenderer`, `FrameConfig` |
| `bgRenderer.ts` | `drawImageProp` cover 算法 + 模糊背景 | — |
| `ControlPanel` | 左栏容器，组合 5 个 controls | controls/* |
| `Workspace` | 右栏容器 + `fitPreview` 缩放 | `FrameContainer` |
| `FrameContainer` | 1200px 边框容器，CSS 变量驱动布局 | `BgCanvas`/`MainPhoto`/`FooterInfo` |
| `RangeSlider` | 滑块 + 进度填充 + 数值显示 | — |
| `ToggleGroup` | 切换按钮组（批量/主题/背景模式等） | — |
| `GlassModal` | 磨砂弹窗（提示/输入/确认/二次按钮） | — |

## 14. 验收标准

1. 14 个品牌 Logo 可切换，暗色主题用反白版
2. 三种背景模式均正常，无背景模式叠加位置可调
3. EXIF 一键识别正确（焦距/光圈/快门/ISO），无 EXIF 时回退手动输入
4. 导出 JPG/PNG 清晰度**明显优于** dom-to-image 方案（保真改进达成）
5. 批量处理多图，逐张导出，单张失败不中断
6. 历史预设保存/恢复/删除正常，可作为批量预设
7. 自定义 Logo 上传/重命名/删除正常，上限 5 个
8. 响应式：768px 以下转上下布局

## 15. 后续演进（非首版）

- Tauri/Electron 包装为桌面版，接入 sharp 做更高保真处理
- 多图拼图 / 胶片边框 / 滤镜
- 35mm 等效焦距换算、镜头识别
- 内嵌 Web Font 保证跨设备字体一致
