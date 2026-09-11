// 同域统计代理（Cloudflare Pages Functions，随站点自动部署，无需额外建 Worker）：
// 聚合 GitHub 公开数据（星数 / 最新版本 / 累计下载）并做 5 分钟边缘缓存。
// 访客能打开本页就一定能访问同域 /api/gh-stats（可达性与页面本身一致）。
//
// 上游策略（针对 Cloudflare 边缘共享出口 IP 极易耗尽 GitHub 匿名限额 60 次/时/IP）：
// - 最新版本：github.com/yuhaowang774/FrameLabdesktop/releases/latest 的 302 重定向
//   Location 含 tag 名（如 /releases/tag/v0.2.7）——github.com 网页不限流、无需鉴权，最可靠
// - 星数 / 下载量：api.github.com；若在 Pages 后台配置了环境变量 GITHUB_TOKEN（只需公开库
//   读权限，classic token 零勾选即可），则带鉴权调用（5,000 次/时），稳定实时；
//   未配置时尝试匿名，403 则跳过（前端自动回退直连/烘焙值兜底）
// - 仅上游拿到有效数据才写边缘缓存；失败响应 no-store，避免瞬时故障被钉死 5 分钟
const GH_API = 'https://api.github.com/repos/yuhaowang774/FrameLabdesktop'
const GH_REPO_URL = 'https://github.com/yuhaowang774/FrameLabdesktop'
const TTL = 300 // 边缘/浏览器缓存秒数

export async function onRequestGet(context) {
  const env = context.env || {}
  const ghHeaders = { Accept: 'application/vnd.github+json' }
  if (env.GITHUB_TOKEN) ghHeaders.Authorization = `Bearer ${env.GITHUB_TOKEN}`

  const cache = caches.default
  const cacheKey = new Request(context.request.url, context.request)
  const fresh = new URL(context.request.url).searchParams.has('fresh')
  if (!fresh) {
    const hit = await cache.match(cacheKey)
    if (hit) return hit
  }

  const stats = { stars: 0, downloads: 0, version: '' }
  const tasks = []

  // 版本号：重定向探测（免鉴权、不限流）
  tasks.push(
    fetch(`${GH_REPO_URL}/releases/latest`, { redirect: 'manual' })
      .then((r) => {
        const m = (r.headers.get('location') || '').match(/\/releases\/tag\/(v?\d[^/?#]*)/)
        if (m) stats.version = m[1]
      })
      .catch(() => {}),
  )

  // 星数
  tasks.push(
    fetch(GH_API, { headers: ghHeaders })
      .then((r) => (r.ok ? r.json() : null))
      .then((repo) => {
        if (repo && typeof repo.stargazers_count === 'number') stats.stars = repo.stargazers_count
      })
      .catch(() => {}),
  )

  // 累计下载：分页汇总全部 Release 资产的 download_count（与宣传页/烘焙脚本口径一致）
  tasks.push(
    (async () => {
      let total = 0
      let okAny = false
      for (let page = 1; page <= 10; page++) {
        const r = await fetch(`${GH_API}/releases?per_page=100&page=${page}`, { headers: ghHeaders })
        if (!r.ok) break
        okAny = true
        const list = await r.json()
        if (!Array.isArray(list) || !list.length) break
        for (const rel of list) for (const a of rel.assets || []) total += a.download_count || 0
        if (list.length < 100) break
      }
      if (okAny) stats.downloads = total
    })().catch(() => {}),
  )

  await Promise.all(tasks)

  const useful = stats.version || stats.stars > 0 || stats.downloads > 0
  const res = new Response(JSON.stringify(stats), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      // 无有效数据：no-store 让下一次请求立即重试，不把瞬时故障缓存 5 分钟
      'cache-control': useful ? `public, max-age=${TTL}` : 'no-store',
    },
  })
  if (useful) context.waitUntil(cache.put(cacheKey, res.clone()))
  return res
}
