# FrameLab 宣传下载页 · 开发与部署计划

> 版本基准：FrameLab v0.2.0（2026-09-08）
> 部署目标：阿里云 ECS + Nginx（Linux）
> 本文档是网页开发与部署的执行基准，实施过程中的关键决策均记录于此。

---

## 一、需求分析与规划

### 1.1 目标受众与核心信息

| 维度 | 结论 |
|---|---|
| 受众 | 摄影爱好者 / 摄影博主 / 社交媒体内容创作者（发图带参数信息卡的需求方） |
| 核心信息 1 | 「为照片加上品牌 Logo、相机参数与日期，本地处理、无损输出」——一句话讲清产品 |
| 核心信息 2 | 免费 + 自动更新 + 隐私安全（不上传图片），消除下载顾虑 |
| 转化目标 | 点击「下载 Windows 版」按钮 → GitHub Releases 最新版安装包 |
| 次级目标 | 提交反馈（GitHub Issues / 邮箱）、Star 仓库 |

### 1.2 整体风格与色彩方案

> 2026-09-08 二次迭代：应用户要求对标 [dshdesktop.com/zh](https://www.dshdesktop.com/zh/) 的视觉风格——
> 深蓝夜空渐变底、白色主按钮、玻璃拟态、左对齐排版、大数字统计、悬浮联系药丸、极简 Footer。

| Token | 值 | 用途 |
|---|---|---|
| 背景层次 | `radial-gradient` 蓝光晕（顶部右上/左上）→ `#0a0f1e` → `#05070d`，底部微光衔接页脚 | 全页氛围 |
| `--text` | `#f2f4f8` | 主文本 |
| `--muted` | `#98a0b3` | 次级文本 |
| `--border` | `rgba(255,255,255,.12)` | 分隔线、玻璃描边 |
| 主按钮 | 白底 `#fff` + 黑字 `#0a0d14`，hover 上浮 | 立即下载 / 联系我们 |
| 副按钮 | 深蓝玻璃 `rgba(20,28,48,.55)` + blur | 查看 GitHub |
| `--star` | `#eac54f` | GitHub star 徽章 |

- 排版：Hero 左对齐（对标参考站），大标题纯白 `clamp(2.4rem→3.9rem)`
- 字体（2026-09-08 对标参考站更新）：**DM Sans 可变字体**（`assets/fonts/dm-sans-latin.woff2` 62KB 自托管，OFL 开源许可，覆盖拉丁/数字/常用符号，字重 100–1000）+ 中文回退苹方/雅黑——与参考站完全同构；`font-display: swap` 不阻塞渲染
- 视觉素材（2026-09-08 用户提供）：`assets/icon.png`（软件图标，导航 + favicon）与 `assets/screenshot.jpg`（软件实际截图，替代 CSS mockup）
- 背景特效（2026-09-08 用户素材）：**瓦肯三角粒子交互背景**（[particles-bg.js](../assets/particles-bg.js)）——`WYHlogo.jpg` 暗色笔画采样为粒子（亮度 70–200 映射，避免与文字抢对比度），鼠标/触摸涡流扰动 + 弹性回归；Canvas `fixed z-index:0 pointer-events:none` 置于内容层下，窄屏自动放大采样间隔降粒子数，`prefers-reduced-motion` 仅静态一帧，图片缺失静默降级纯渐变
- 数据元素：累计下载数（GitHub Releases 全量资产求和，实时）、star 数徽章、版本药丸（GitHub API，失败回退内置值）

### 1.3 页面结构（单页锚点导航，总长控制在约两屏）

> 2026-09-08 需求收敛：页面信息密度过高，砍掉功能卡片 / 版本时间线 / 用户评价三个模块，
> 仅保留「软件简介、下载、联系方式」三个主模块，两屏内完成全部信息传递。

```
header（sticky 导航：Logo + 药丸标签 | 下载 / GitHub / 联系我们）
├─ Hero（左对齐）：标题 + 副文案 + 白色「立即下载」/ 玻璃「查看 GitHub ⭐」+ 累计下载数 + 软件实际截图 + 平台行
├─ 悬浮联系药丸（底部居中固定）：意见反馈 / 邮件联系
└─ footer：版权 + 品牌声明 | 下载 / GitHub / 使用指南 / 反馈 + ICP 备案占位
```

### 1.4 交互设计

- 平滑锚点滚动（CSS `scroll-behavior`）
- 滚动显现动画（`IntersectionObserver`，`prefers-reduced-motion` 时禁用）
- 导航栏滚动后加深玻璃底色；移动端收起药丸标签、压缩链接间距（无汉堡菜单，导航项精简至 3 个）
- 实时数据：版本号 / star 数 / 累计下载数经 GitHub API 获取，失败静默回退内置值（离线环境页面完好）
- 下载按钮全部 `rel="noopener"` 外链直指 GitHub Releases；`data-track` 属性标记下载点击位（配合 Nginx 日志统计）

### 1.5 响应式策略

| 断点 | 布局 |
|---|---|
| ≥1024px（桌面） | 左对齐 Hero + 软件截图（约 2/3 宽）、导航完整、悬浮药丸居中 |
| 640–1023px（平板） | 截图等比缩放、导航完整 |
| <640px（手机） | 单列堆叠、导航精简（药丸隐藏）、字号 `clamp()` 流式缩放、CTA 弹性全宽 |

### 1.6 下载转化路径设计

```
首屏 Hero CTA（最强入口）
  → 导航栏常驻下载按钮（滚动全程可见）
  → #download 区双平台卡片（系统要求 + 安装说明 + 隐私承诺）
  → 每个按钮均直达 GitHub Releases latest
```

顾虑消除：CTA 下方「免费 · 本地处理不上传 · 自动更新」信任行 + 下载区安全说明。

---

## 二、设计阶段说明（无图稿实现方式）

按约束「不自主创建任何图片」，设计稿以 **HTML/CSS 实现即原型**（live prototype）：

- **原型** = 本页 `index.html` 本身，桌面/平板/手机三档视口即三份设计稿
- **产品图标** = CSS 绘制「白底圆角方块 + A+Z 徽标」（与真实应用图标 v0.1.16+ 一致）
- **功能图标** = 内联 SVG 线性图标（相框/徽标/参数/工作流/批量/画质 6 枚，代码绘制）
- **导航结构与引导流程** = 1.3/1.6 所列；下载流程单跳（官网 → GitHub Releases，不中转、不篡改安装包，保证安全可靠）

## 三、开发阶段（实施）

| 项 | 方案 |
|---|---|
| 技术 | 原生 HTML5 + CSS3 + JavaScript（零框架、零外部依赖、零位图请求） |
| 文件 | `index.html` / `assets/styles.css` / `assets/main.js` / `assets/favicon.svg` / `robots.txt` / `sitemap.xml` |
| 性能 | 系统字体、SVG 内联、JS `defer`、关键 CSS 单文件、目标 Lighthouse Performance ≥ 95 |
| SEO | 语义化标签、单 H1、meta description/OG/Twitter Card、JSON-LD `SoftwareApplication`、`robots.txt`、`sitemap.xml` |
| 可访问性 | 焦点可见、跳转链接、aria 标签、对比度 AA、`prefers-reduced-motion` |

## 四、测试阶段（清单）

1. 跨浏览器：Chrome（实机）、Edge/Firefox/Safari（文档给出手测清单；CSS 仅用基线特性，无实验性 API）
2. 视口实测：1440 / 768 / 390 三档（浏览器实机截图验证）
3. 交互：锚点滚动、移动菜单、显现动画、hover 态、下载外链正确性
4. 降级：断网/接口失败时版本徽章回退内置版本号
5. 校验：HTML 结构、meta 完整性、控制台零报错

## 五、部署阶段（阿里云 + Nginx）

详见 [DEPLOY.md](./DEPLOY.md)。要点：

- 服务器准备（安全组 80/443、Nginx 安装）→ 上传静态文件 → Nginx 站点配置（gzip、缓存策略、安全头）→ HTTPS（certbot/阿里云证书）→ 域名解析与备案 → 上线前检查
- 监控：Nginx 访问日志统计下载点击（文档附命令），可选接入阿里云云监控

## 六、交付物清单

| 交付物 | 位置 |
|---|---|
| 网页源代码 | `website/index.html`、`website/assets/*`、`website/robots.txt`、`website/sitemap.xml` |
| 设计稿与原型 | 本页 live prototype（即原型，见第二节说明）+ 本文档设计规范 |
| 部署文档与维护指南 | `website/docs/DEPLOY.md` + `website/deploy.sh` |
| 测试报告与优化建议 | `website/docs/TEST-REPORT.md` |
