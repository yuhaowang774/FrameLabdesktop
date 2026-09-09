# FrameLab 宣发素材库

定位文案（统一口径）：开源免费 / 本地小工具 / 给照片挂品牌 Logo 和 EXIF 参数 / 杂志模板 / 无损输出 / 照片不出你的电脑。

## 目录

- `demo-photos/` 演示照片（`DSC02720.JPG` 主用：SONY ILCE-6000，EXIF 完整含镜头；`test_with_exif.jpg` 备用）
- `screenshots/截图指南.md` **手动截图指南**（6 场景/操作路径/规格/命名/QC 清单）；截图完成后按日期建目录存放
- `bilibili/` B站发布四件套（分镜脚本 / 发布文案 / 录屏与压制 / 数据跟踪）

## 截图工作流（当前：手动）

1. 按 `screenshots/截图指南.md` 准备应用与演示照片
2. 逐场景截图，按命名规范存入 `screenshots/<日期>/`
3. 交给 AI 做 QC 并回填下方交付清单

> 备用：CDP 自动化截图工具 `scripts/cdp-shot.mjs` 保留（Node 22 直连 WebView2 调试端口；需 Rust 侧 `--remote-debugging-port` 开关支持，env var 会被宿主 additional_browser_args 覆盖）。

## 命名规范

小写中划线三段式：`{用途}-{场景}-{规格}.png`（例 `bilibili-cover-1146x717.png`、`web-hero-edit-2560x1600.png`）

## 交付清单（2026-09-10 首批，已 QC）

| 文件 | 尺寸 | 用途 |
|---|---|---|
| screenshots/2026-09-10/web-hero-edit.png | 2519×1576 | Hero 大图：杂志模板 + SONY Logo + 镜头/参数行（官网 Hero / README 头图备选） |
| screenshots/2026-09-10/bilibili-cover-1146x717.png | 1146×717 | B站封面底图（AI 从 hero 裁切 1.6:1，待加标题字） |
| screenshots/2026-09-10/web-export-panel.png | 2519×1575 | 无损导出：JPG 高画质/超采样/批量，输出 35.3MB 预览 |
| screenshots/2026-09-10/web-library-grid.png | 2519×1574 | 图库批量管理（109 张网格 + 文件名/尺寸） |
| screenshots/2026-09-10/web-templates-grid.jpg | 2115×1280 | 模板库弹窗（共 10 套 + 批量应用；JPG，建议有空补 PNG 重截） |
| screenshots/2026-09-10/web-info-exif.png | 455×1279 | EXIF 参数面板（真实数据：16mm f/5.6 1/125s ISO100 + E PZ 16-50mm） |
| screenshots/2026-09-10/web-panel-brand-logo.png | 448×1081 | 品牌 Logo 面板（Sony / α6000 / 杂志双栏布局） |
| screenshots/2026-09-10/web-panel-photo-bg.png | 450×782 | 照片/背景设置面板（立体阴影/纯色/模糊） |
| screenshots/2026-09-10/web-panel-border-ratio.png | 448×799 | 边框/画幅面板（16 种比例预设） |

## 视频分工

AI 已产出：分镜脚本 / 发布文案 / 录屏压制参数 / 数据跟踪模板（`bilibili/`）。
用户待办：按分镜录屏 → ffmpeg 压制 → 按 `发布文案.md` 发布 → 每周填 `数据跟踪.md`。
