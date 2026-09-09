# FrameLab 宣传页 · Cloudflare Pages 部署文档与维护指南

> 架构：GitHub 仓库 → Cloudflare Pages 自动构建 → 全球 CDN（免费：无限流量/请求、自动 HTTPS）
> 站点类型：纯静态单页（`website/` 目录，`docs/` 内部文档随仓库管理，不影响站点）
> 首次上线全程约 5 分钟。

---

## 一、首次部署（Dashboard 三步）

1. 登录 [dash.cloudflare.com](https://dash.cloudflare.com) → 左侧 **Workers & Pages → Create → Pages → Connect to Git**
2. 授权 GitHub 并选择仓库 **FrameLabdesktop**（main 分支）
3. 构建配置（三件事）：
   - **Framework preset**：`None`
   - **Build command**：`npm run build -- --base=/app/ && node scripts/copy-app-to-website.mjs && node scripts/fetch-gh-stats.mjs`
   - **Build output directory**：`/website`
4. **Save and Deploy** → 约 2 分钟后获得 `https://<项目名>.pages.dev` 地址，HTTPS 自动生效

> 构建命令产出三部分：`website/`（宣传页 + `_headers`）、`website/app/`（网页版 FrameLab，供 Hero 内嵌 iframe 在线体验，`--base=/app/` 保证子路径资源引用正确）、`website/assets/gh-stats.js`（构建时拉取的 GitHub 星数/累计下载/最新版本兜底值——访客网络下 api.github.com 常被限流或不可达，烘焙值保证数字永不空白，运行时仍会尝试实时更新并写 localStorage 缓存）。

代码适配已就绪：`website/_headers` 提供 HTML 免缓存 + 资产长缓存 + 安全头（替代原 Nginx 配置）。

## 二、绑定自定义域名（可选）

Pages 项目 → **Custom domains → Set up a domain** → 填入域名：

- 域名 DNS 托管在 Cloudflare：自动添加 CNAME，几分钟生效
- 域名在其它注册商：按提示到该注册商加一条 CNAME → `<项目名>.pages.dev`
- 证书自动签发续期，无需人工管理

> Cloudflare 不要求 ICP 备案。绑定后需同步更新 `index.html`（canonical / og:url / JSON-LD url）、`sitemap.xml`、`robots.txt` 中的站点地址。

## 三、日常更新（零操作）

```bash
git add website && git commit -m "docs: 更新宣传页" && git push
```

push 到 main 后 Pages 自动重新构建发布（约 1 分钟）。HTML 已配置免缓存，用户刷新即见新版；CSS/JS/字体/图片长缓存 7 天（文件名变更才会更新时改用查询参数或新文件名）。

## 四、访问统计

1. Pages 项目 → **Analytics** → 启用 **Cloudflare Web Analytics**（免费、无 cookie、不影响性能），可看 PV/UV/访客国家/引荐来源
2. 在 `index.html` 的 `</head>` 前插入 Analytics 提供的 `<script>` 代码片段（设置页会给出）
3. 下载点击量：Cloudflare 无内置出站点击统计，如需精确计数可在仓库 issues 中查看流量趋势近似替代，或后续以 Pages Functions + KV 实现计数端点（当前未启用）

## 五、检查清单（上线后）

- [ ] `https://<项目名>.pages.dev/` 打开正常：粒子背景模糊效果、软件截图、下载按钮
- [ ] 「立即下载」跳转 GitHub Releases 最新版
- [ ] 手机（390px 宽）无横向滚动条
- [ ] `robots.txt` 与 `sitemap.xml` 可访问
- [ ] Pages 项目 **Settings → Analytics** 已开启 Web Analytics
- [ ] （可选）Search Console / 百度站长提交 sitemap

## 六、故障与维护

| 场景 | 处理 |
|---|---|
| push 后未更新 | Pages 部署记录查看构建日志；确认输出目录为 `/website` |
| 版本号/下载数显示「—」 | GitHub API 被限流（每小时 60 次匿名额度），页面自动回退内置值，稍后自动恢复 |
| 字体/图片 404 | 检查 `website/assets/` 文件是否已提交进仓库 |
| 回滚到旧版本 | Pages → Deployments → 选中历史部署 → **Rollback to this deployment**（一键秒回） |
| 构建额度 | 免费版每月 500 次构建，正常迭代足够 |

## 七、与原阿里云方案的差异说明

- 无需服务器、无需 SSH、无需 Nginx 配置、无需证书管理——全部由 Cloudflare 托管
- 原 `/track/` 点击上报端点已随 `main.js` 上报代码移除（静态托管无服务端）；统计改用 Web Analytics
- 原安装包服务器直链方案未启用：下载仍跳 GitHub Releases（后续如需国内加速可改用 Pages 托管安装包，单文件 ≤25MB，用 wrangler 直传不占仓库体积）
