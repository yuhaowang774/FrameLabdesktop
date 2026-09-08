#!/usr/bin/env bash
# ============================================================
# FrameLab 宣传页一键部署脚本（在本地 Linux/macOS/Git Bash 执行）
# 用法：
#   1. 修改下方变量（服务器 IP、SSH 用户、Nginx 站点根目录）
#   2. chmod +x deploy.sh && ./deploy.sh
# 首次部署请先按 website/docs/DEPLOY.md 完成 Nginx 站点配置。
# ============================================================
set -euo pipefail

SERVER_IP="${SERVER_IP:- your.server.ip}"      # 阿里云 ECS 公网 IP
SSH_USER="${SSH_USER:-root}"                   # SSH 用户
REMOTE_DIR="${REMOTE_DIR:-/var/www/framelab}"  # Nginx 站点根目录

SITE_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "==> 同步站点文件到 ${SSH_USER}@${SERVER_IP}:${REMOTE_DIR}"
# --delete 保证远端与本地完全一致；docs/ 为内部文档，不上传
rsync -avz --delete \
  --exclude 'docs/' \
  --exclude 'deploy.sh' \
  "$SITE_DIR/" "${SSH_USER}@${SERVER_IP}:${REMOTE_DIR}/"

echo "==> 刷新文件权限"
ssh "${SSH_USER}@${SERVER_IP}" "chown -R www-data:www-data ${REMOTE_DIR} 2>/dev/null || chown -R nginx:nginx ${REMOTE_DIR} || true"

echo "==> 完成。提示：静态资源已带版本指纹的缓存策略，HTML 免缓存，无需额外清缓存操作。"
