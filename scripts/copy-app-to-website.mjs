// 将网页版构建产物（dist/）复制到宣传页目录 website/app/，
// 供 Cloudflare Pages 一并发布（宣传页 Hero 内嵌 iframe 在线体验）。
// 用法：vite build --base=/app/ 之后执行本脚本。
import { cpSync, rmSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dist = join(root, 'dist')
const dest = join(root, 'website', 'app')

if (!existsSync(dist)) {
  console.error('[copy-app] dist/ 不存在，请先执行 vite build')
  process.exit(1)
}

rmSync(dest, { recursive: true, force: true })
cpSync(dist, dest, { recursive: true })
console.log('[copy-app] dist/ -> website/app/ 完成')
