# FrameLab 宣传页 · 阿里云部署文档与维护指南

> 目标环境：阿里云 ECS（Linux）+ Nginx + 域名 + HTTPS
> 站点类型：纯静态单页（`website/` 目录，不含 `docs/` 与 `deploy.sh`）
> 全程约 30–60 分钟（不含域名备案等待）。

---

## 一、前置准备

| 项 | 说明 |
|---|---|
| ECS 实例 | 最低配置即可（1 核 2G），操作系统建议 Ubuntu 22.04 / Alibaba Cloud Linux 3 |
| 安全组 | ECS 控制台 → 安全组 → 放行入方向 `80/tcp`（HTTP）与 `443/tcp`（HTTPS） |
| 域名 | 在阿里云（或其他注册商）购买；**必须完成 ICP 备案**后才能在国内 ECS 对外提供 Web 服务（备案约 1–2 周，期间可先用 IP 或境外节点调试） |
| 域名解析 | 云解析 DNS → 添加 A 记录：`@`（或 `www`）→ ECS 公网 IP，TTL 默认 |
| 上传账号 | 可用 root 或具备 `/var/www` 写权限的普通用户；推荐配置 SSH 密钥登录 |

---

## 二、安装 Nginx

```bash
sudo apt update && sudo apt install -y nginx   # Ubuntu/Debian
# sudo dnf install -y nginx && sudo systemctl enable --now nginx   # Alibaba Cloud Linux/RHEL
```

## 三、上传站点文件

站点根目录定为 `/var/www/framelab`。上传 `website/` 下的内容（**不含** `docs/`、`deploy.sh`）：

**方式 A：一键脚本（推荐，Linux/macOS/Git Bash 本地执行）**

```bash
cd website
SERVER_IP=<你的ECS公网IP> SSH_USER=root ./deploy.sh
```

**方式 B：手动 scp**

```bash
scp -r index.html assets robots.txt sitemap.xml root@<ECS_IP>:/var/www/framelab/
```

**方式 C：宝塔面板** —— 文件管理中上传并解压至站点根目录即可（Nginx 配置在面板「网站 → 设置 → 配置文件」中按第四节调整）。

## 四、Nginx 站点配置

新建 `/etc/nginx/conf.d/framelab.conf`（Ubuntu 亦可用 sites-available + 软链）：

```nginx
# 累计下载/联系点击统计：JS sendBeacon 上报端点，仅记日志，返回 204
location /track/ {
    access_log /var/log/nginx/framelab-track.log;
    return 204;
}

server {
    listen 80;
    server_name framelab.example.com;          # ← 替换为你的域名，调试期可写 _（任意）
    root /var/www/framelab;
    index index.html;

    # gzip 压缩（文本资源）
    gzip on;
    gzip_comp_level 5;
    gzip_min_length 512;
    gzip_types text/css application/javascript application/json image/svg+xml text/plain;

    # 缓存策略：HTML 不缓存（发版即生效），静态资产 7 天
    location / {
        try_files $uri $uri/ =404;
        add_header Cache-Control "no-cache, must-revalidate";
    }
    location ~* \.(css|js|svg|png|ico)$ {
        add_header Cache-Control "public, max-age=604800";
    }

    # 安全响应头
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}
```

```bash
sudo nginx -t && sudo systemctl reload nginx
```

> 注意：服务器需能访问 GitHub API（页面 JS 从浏览器发起，与服务器无关；服务器仅托管静态文件）。

## 五、HTTPS

**方式 A：Let's Encrypt 免费证书（certbot 自动续期）**

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d framelab.example.com --redirect   # --redirect 自动 80→443
```

**方式 B：阿里云免费证书** —— 数字证书管理服务 → 免费证书 → 申请并绑定域名 → 下载 Nginx 格式 → 上传 `.pem/.key` 至 `/etc/nginx/certs/`，在 server 块追加：

```nginx
server {
    listen 443 ssl;
    server_name framelab.example.com;
    root /var/www/framelab;
    index index.html;
    ssl_certificate     /etc/nginx/certs/framelab.pem;
    ssl_certificate_key /etc/nginx/certs/framelab.key;
    # ……其余 location/add_header 同第四节
}
```

## 六、上线前检查清单

- [ ] `curl -I http://<域名>/` 返回 200，且 `Cache-Control: no-cache`
- [ ] 浏览器实测：版本药丸/star/累计下载数正常显示（若为「—」检查服务器是否能被浏览器直连，API 为浏览器端请求）
- [ ] 「立即下载」能跳转 GitHub Releases 最新版
- [ ] 手机视口（390px）无横向滚动条
- [ ] HTTPS 证书生效，HTTP 自动跳转
- [ ] `robots.txt`、`sitemap.xml` 可访问；**将 `index.html` 与 `sitemap.xml` 中的 `framelab.example.com` 替换为真实域名**
- [ ] 向 Google Search Console / 百度站长平台提交 sitemap

## 七、监控与数据跟踪

**1. 访问情况（PV/UV）**

```bash
# 今日 PV
grep "$(date +%d/%b/%Y)" /var/log/nginx/access.log | wc -l
# 今日 UV（独立 IP）
grep "$(date +%d/%b/%Y)" /var/log/nginx/access.log | awk '{print $1}' | sort -u | wc -l
```

**2. 下载/联系点击统计**（页面按钮点击时 JS 已自动上报 `/track/<name>`）

```bash
# 各按钮点击次数（download-hero=首屏下载 download-windows/footer=下载位 dock-*=联系位）
awk '{print $7}' /var/log/nginx/framelab-track.log | sort | uniq -c | sort -rn
```

**3. 可选增强**：阿里云云监控（ECS CPU/带宽/磁盘告警）· 接入「百度统计 / Google Analytics」（在 `index.html` 底部加统计脚本即可）· 日志轮转（logrotate 默认已含 nginx）。

## 八、日常维护

| 操作 | 步骤 |
|---|---|
| 内容更新 | 改本地 `website/` → 重跑 `deploy.sh`（rsync 增量秒级）；HTML 免缓存无需清 CDN |
| 版本发布日 | 无需改页面（版本号自动拉取 GitHub latest）；可选更新 `sitemap.xml` 的 `lastmod` |
| 证书续期 | certbot 自动续期（`systemctl status certbot.timer` 确认）；阿里云证书到期前 30 天续申请 |
| 故障排查 | `nginx -t`（配置）· `/var/log/nginx/error.log`（错误）· 安全组/防火墙（连不通） |
| 备份 | 站点文件即 git 仓库 `website/` 目录，天然版本化；服务器无需额外备份静态文件 |
