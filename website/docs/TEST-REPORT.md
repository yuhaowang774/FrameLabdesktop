# FrameLab 宣传页 · 测试报告与优化建议

> 测试日期：2026-09-08 · 测试环境：Windows 11 · Chromium（浏览器自动化实测）+ 本地静态服务器
> 页面版本：对标 dshdesktop.com 风格的重构版（深蓝夜空 / 左对齐 Hero / 大数字统计）

---

## 一、测试结果总览

| 类别 | 项 | 结果 |
|---|---|---|
| 功能 | 页面加载与渲染 | ✅ 通过，控制台零报错、零警告 |
| 功能 | 版本号动态获取 | ✅ GitHub API 生效（显示 v0.2.0），失败回退内置值 |
| 功能 | 累计下载数统计 | ✅ 实测拉取 Releases 资产求和（67），`toLocaleString` 千分位 |
| 功能 | star 数徽章 | ✅ 实测显示（3），千位转 K 格式 |
| 功能 | 下载链接正确性 | ✅ 立即下载 / 导航与页脚下载位均指向 `releases/latest`，macOS 指向 `releases`；全部 `rel="noopener"` |
| 功能 | 联系入口 | ✅ 悬浮药丸（意见反馈 → Issues / 邮件联系 → mailto）、导航「联系我们」、页脚反馈均可达 |
| 功能 | 点击上报 | ✅ `data-track` 位（hero/nav/footer 下载、悬浮联系）触发 sendBeacon `/track/<name>` |
| 交互 | 滚动显现动画 | ✅ IntersectionObserver 触发、一次性；`prefers-reduced-motion` 下禁用 |
| 交互 | 导航栏玻璃态 | ✅ 滚动 >8px 出现磨砂底与分隔线 |
| 响应式 | 桌面（1024+） | ✅ 左对齐 Hero、mockup 约 2/3 宽、悬浮药丸居中 |
| 响应式 | 手机（390×844，iframe 实测） | ✅ 无横向溢出、按钮弹性全宽、mockup 侧栏折叠、总高 1.5 屏 |
| 性能 | 资源体积 | ✅ 3 个自有文件（HTML ~14KB / CSS ~15KB / JS ~5KB，未压缩原始值），零位图、零外部依赖、系统字体、JS defer |
| 性能 | 渲染 | ✅ 全 CSS 渐变与内联 SVG，无图片请求；唯一运行时网络调用为 3 个 GitHub API（异步，不阻塞渲染） |
| SEO | meta 完整性 | ✅ title/description/keywords/canonical/OG/Twitter Card/JSON-LD `SoftwareApplication`、语义化标签、单 H1、robots.txt、sitemap.xml |
| 可访问性 | 基线 | ✅ skip-link、`:focus-visible`、aria-label/expanded、`role="img"` 描述 mockup、对比度 AA |

**页面长度实测**：桌面 1.39 屏 / 手机 1.5 屏（达成「两页之内」目标）。

## 二、已修复问题记录

| # | 问题 | 修复 |
|---|---|---|
| 1 | GitHub `published_at` 为 UTC，日期显示比产品内日志（北京时间）早一天 | 改为 `new Date()` 本地时区渲染 |
| 2 | 移动端导航「下载」链接被挤压换行 | `.nav-link` 加 `white-space: nowrap` |
| 3 | 首版信息密度过高（6 模块 6.1 屏） | 按需求砍至 3 模块（简介/下载/联系） |
| 4 | 局部静态服务器缓存导致验证误判 | 测试服务器以 `-c-1` 禁缓存；Nginx 生产配置对 HTML 免缓存 |

## 三、跨浏览器兼容性说明

CSS 仅使用基线特性（flex/grid/clamp/radial-gradient/IntersectionObserver 回退已做），预期兼容 Chrome/Edge 88+、Firefox 78+、Safari 14+（`backdrop-filter` 带 `-webkit-` 前缀）。GitHub API 不可达时全部数据有回退值，任何浏览器均可完整展示。建议上线后按此清单在 Safari（iOS）与 Firefox 各过一遍首屏与下载按钮。

## 四、优化建议（按优先级）

1. **P1 域名替换**：上线前将 `index.html`（canonical/OG/JSON-LD）与 `sitemap.xml`、`robots.txt` 中的 `framelab.example.com` 全局替换为真实域名（当前 4 处/文件）。
2. **P2 真实下载计数口径**：当前统计为 Releases 全部资产下载次数（含历史版本）。如需「本次版本下载量」，可改用 `/releases/latest` 的 assets 求和（`main.js` 中 `sumDownloads` 一处改动）。
3. **P2 社媒预览图**：OG 当前无 `og:image`。发布后可截一张应用真实截图上传服务器并补 `<meta property="og:image">`，社交分享点击率会明显更好。
4. **P3 性能加分项**：页面已足够轻；如追求 Lighthouse 满分，可将 GitHub API 请求合并为一个（`/releases?per_page=1` 同时含版本与资产数）。
5. **P3 SEO 迭代**：当前单页内容较精简；若后续要竞争「照片相框」「EXIF 水印」等关键词，建议增加功能详情/图文教程子页并互链。
6. **P3 备案信息**：Footer 已留 ICP 备案注释位，备案下发后取消注释并填入备案号。
