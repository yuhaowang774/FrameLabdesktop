// 构建时拉取 GitHub 公开数据，烘焙为宣传页兜底统计（website/assets/gh-stats.js）。
// 背景：访客网络下 api.github.com 常被限流（未认证 60 次/时/IP）或不可达，
// 运行时实时拉取会失败；构建环境网络通常优于访客环境，部署时取一次值烘焙进静态文件，
// 宣传页即可「永不空白」——实时拉取成功则覆盖显示，失败则用烘焙值/localStorage 缓存。
// 用法：node scripts/fetch-gh-stats.mjs（Cloudflare Pages 构建命令最后一步；本地可手动跑）
// 本机注意：Node 内置 CA 库可能验证 GitHub 证书失败（UNABLE_TO_VERIFY_LEAF_SIGNATURE），
// 加 --use-system-ca 改用 Windows 证书库即可：node --use-system-ca scripts/fetch-gh-stats.mjs
import { writeFileSync, existsSync, readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dest = join(root, 'website', 'assets', 'gh-stats.js')
const API = 'https://api.github.com/repos/yuhaowang774/FrameLabdesktop'
const TIMEOUT_MS = 8000

async function jfetch(url) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const r = await fetch(url, { headers: { Accept: 'application/vnd.github+json' }, signal: ctrl.signal })
    if (!r.ok) throw new Error(`${url} -> HTTP ${r.status}`)
    return await r.json()
  } finally {
    clearTimeout(t)
  }
}

const stats = { stars: 0, downloads: 0, version: '' }
try {
  const [repo, latest] = await Promise.all([
    jfetch(API),
    jfetch(`${API}/releases/latest`).catch(() => null), // 无 Release 时不阻塞星数
  ])
  stats.stars = repo.stargazers_count || 0
  if (latest && typeof latest.tag_name === 'string') stats.version = latest.tag_name
  // 累计下载：分页汇总全部 Release 资产的 download_count（与宣传页运行时逻辑一致）
  let total = 0
  for (let page = 1; page <= 10; page++) {
    const list = await jfetch(`${API}/releases?per_page=100&page=${page}`)
    if (!Array.isArray(list) || !list.length) break
    for (const rel of list) for (const a of rel.assets || []) total += a.download_count || 0
    if (list.length < 100) break
  }
  stats.downloads = total
} catch (e) {
  // 拉取失败：保留仓库中已提交的 gh-stats.js（上次构建的烘焙值），绝不覆盖为空
  console.error('[gh-stats] 拉取失败，保留已有烘焙值:', String(e))
  process.exit(0)
}

// 已有文件且新值全部为 0（疑似异常响应）：同样不覆盖
if (existsSync(dest) && !stats.stars && !stats.downloads && !stats.version) {
  console.error('[gh-stats] 新值全为 0，疑似异常，保留已有烘焙值')
  process.exit(0)
}

const js = `/* 构建时自动生成（scripts/fetch-gh-stats.mjs）：宣传页兜底统计数据，请勿手改 */
window.GH_STATS_BAKED = ${JSON.stringify(stats)};\n`
writeFileSync(dest, js)
console.log('[gh-stats] 烘焙完成:', JSON.stringify(stats))
