# FrameLab 宣发准备设计（清理 / B站视频 / CDP 截图）

日期：2026-09-09
状态：已确认（用户已批准整体设计）

## 背景与目标

FrameLab 进入宣发阶段。目标：清理项目无用文件并建立归档机制、产出 B站视频发布全套文档、用 CDP 自动化产出真实宣传截图、建立命名规范与交付/数据跟踪机制。

已确认的关键决策（AskUserQuestion 结果）：
- 视频制作：AI 产出全套文档（分镜/参数/命令/文案），用户按脚本录屏
- 发布平台：仅 B站（其余平台后续按需扩展）
- 截图产出：**用户手动截图**（2026-09-10 变更：CDP 自动化取消），AI 提供截图指南（场景/规格/命名/QC）
- src-tauri/target（21GB）：保留，不清理

## 一、项目清理与归档机制

### 归档机制
- 项目根新建 `_archive/`，加入 `.gitignore`
- 本地垃圾文件**移动**至 `_archive/2026-09/`（归档即备份，不直接删除）
- `_archive/2026-09/README.md` 记录清理审计：删除项、理由、去向

### 清理清单

| 类别 | 文件 | 处置 |
|---|---|---|
| A 本地垃圾（gitignored） | devserver.err、devserver.log、tauri-dev-err.log、tauri-dev-run.log、tauri-dev.log、web-dev.log、tsconfig.tsbuildinfo、tsconfig.node.tsbuildinfo、vite.config.js、vite.config.d.ts、.gitmsg、verify-export.html、.codebuddy（空目录） | 移入 `_archive/2026-09/` |
| B git 废弃物 | `tools/verify-templates.html`（模板 16 项像素断言验收页；无代码引用，仅历史文档记录） | git rm + 复制入 `_archive/2026-09/`（git 历史 + 本地归档双保险，未来模板开发可取回复用） |
| B 转宣发素材 | `test-assets/test_with_exif.jpg`（带 EXIF） | git mv → `marketing/demo-photos/`（备用演示图），test-assets 目录随之消失 |
| 新增宣发素材 | `DSC02720.JPG`（项目根，6.2MB，SONY ILCE-6000，EXIF 完整含镜头型号，6000×3376） | git add → `marketing/demo-photos/`，**主演示照片**（CDP 截图/录屏共用） |
| C 保留 | design-assets/（新旧界面截图、图标原图）、release/、src-tauri/target、dist/ | 不动 |
| 不动 | frame 仓库（d:\A\frame，已归档）本地测试 JPG | 维持既有约定，不提交 |

### 清理后验证
- `npx vitest run` 全过
- `npm run build`（vue-tsc + vite）通过
- `git status` 干净

## 二、B站视频发布包（marketing/bilibili/）

### 平台规格（锁定）
- 分辨率 1920×1080，16:9；录制 60fps；MP4（H.264 + AAC）
- 码率 8-12 Mbps（B站二压后画质更稳）
- 建议时长 60~90 秒；前 5 秒必须呈现产品成品（完播率）；无片头广告
- 封面 1146×717（1.6:1）

### 产出文档（4 件）
1. `分镜脚本.md`：90 秒逐镜头脚本（镜头号/时长/画面/操作步骤/字幕文案）；主线：拖入照片 → 选杂志模板 → EXIF 自动标注 → 品牌 Logo 挂载 → 无损导出
2. `发布文案.md`：标题 3 备选、简介（GitHub 仓库 + framelab-studio.pages.dev 下载入口）、标签集 10 个、分区建议（科技-软件应用）
3. `录屏与压制.md`：OBS 参数（1080p60、CQP 18）+ ffmpeg 一键转码命令
4. `数据跟踪.md`：周记录模板（播放/完播率/三连/评论/涨粉）；发布时间建议：工作日 18-20 点

## 三、宣传截图（marketing/screenshots/）——手动截图版

- **执行方式（2026-09-10 变更）**：用户按指南手动截图（`Win+Shift+S`），AI 产出 `marketing/screenshots/截图指南.md`（场景清单/操作路径/规格/命名/QC 清单）
- 场景清单（6 个）：
  1. Hero 编辑大图（杂志模板选中态，含 EXIF 标注）
  2. 模板库网格
  3. EXIF / 品牌 Logo 设置面板
  4. 导出面板（格式/画质）
  5. 图库视图（多选态）
  6. B站封面专用干净构图（后期裁 1146×717）
- 主图规格 ≥1920×1080（建议 2560×1600）；应用原生观感，主图不后期调色、不加标注；封面文字交剪映/PPT

## 四、目录结构与命名规范

```
marketing/
├── README.md                        # 素材总索引：文件→用途映射、交付清单
├── demo-photos/
│   └── test_with_exif.jpg
├── screenshots/
│   └── 2026-09-09/
│       └── {用途}-{场景}-{规格}.png  # 例 bilibili-cover-1146x717.png
└── bilibili/
    ├── 分镜脚本.md
    ├── 发布文案.md
    ├── 录屏与压制.md
    └── 数据跟踪.md
_archive/
└── 2026-09/
    ├── README.md                    # 清理审计记录
    └── （归档的原文件）
```

命名规范：小写中划线，`{用途}-{场景}-{规格}` 三段式，截图按批次日期分目录。

## 五、QC 与交付

- 清理回归：vitest + build + git status 三项通过
- 截图 QC：逐张检查 100% 缩放文字可读、模板/EXIF 数据真实正确、分辨率与规格一致
- 视频 QC（用户录屏后自查清单）：分辨率/帧率/码率达标、前 5 秒见产品、封面 1.6:1、音频清晰
- 交付清单写入 `marketing/README.md`

## 六、执行顺序

1. 清理：建 `_archive/` → 归档 A 类 → git rm B 类 → git mv 素材 → 回归验证 → commit
2. marketing 骨架 + README 索引
3. CDP 截图批次（6 场景）
4. B站四件套文档
5. QC + 交付清单收尾

## 风险与对策

- CDP 截图依赖 tauri dev 正常启动：沿用既有 CDP 验证路径；失败则回退 vite dev + Chrome 截 WebView 主体
- test_with_exif.jpg 若被隐藏测试引用（grep 已确认无引用）：删除前跑 vitest 验证兜底
- 清理操作全部可逆：A 类在 _archive 可取回，B 类走 git 历史
