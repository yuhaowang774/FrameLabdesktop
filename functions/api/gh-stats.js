// 同域统计代理（Cloudflare Pages Functions，随站点自动部署，无需额外建 Worker）：
// 聚合 GitHub 公开数据（星数 / 最新版本 / 累计下载）并做 5 分钟边缘缓存。
// 背景：api.github.com 对访客常限流（未认证 60 次/时/IP，国内共享出口 IP 更易耗尽）或不可达；
// 访客能打开本页就一定能访问同域 /api/gh-stats（可达性与页面本身一致），
// 边缘缓存把上游请求压缩到每 5 分钟一次，避开限流。
// 前端 main.js 优先请求本接口，失败自动回退直连 api.github.com。
const GH_API = 'https://api.github.com/repos/yuhaowang774/FrameLabdesktop'
const TTL = 300 // 边缘/浏览器缓存秒数

const GH_HEADERS = { Accept: 'application/vnd.github+json' }

export async function onRequestGet(context) {
  const cache = caches.default
  const cacheKey = new Request(context.request.url, context.request)
  const hit = await cache.match(cacheKey)
  if (hit) return hit

  const stats = { stars: 0, downloads: 0, version: '' }
  try {
    const [repo, latest] = await Promise.all([
      fetch(`${GH_API}`, { headers: GH_HEADERS }).then((r) => (r.ok ? r.json() : null)),
      fetch(`${GH_API}/releases/latest`, { headers: GH_HEADERS }).then((r) => (r.ok ? r.json() : null)),
    ])
    if (repo && typeof repo.stargazers_count === 'number') stats.stars = repo.stargazers_count
    if (latest && typeof latest.tag_name === 'string') stats.version = latest.tag_name
    // 累计下载：分页汇总全部 Release 资产的 download_count（与宣传页/烘焙脚本口径一致）
    let total = 0
    for (let page = 1; page <= 10; page++) {
      const r = await fetch(`${GH_API}/releases?per_page=100&page=${page}`, { headers: GH_HEADERS })
      if (!r.ok) break
      const list = await r.json()
      if (!Array.isArray(list) || !list.length) break
      for (const rel of list) for (const a of rel.assets || []) total += a.download_count || 0
      if (list.length < 100) break
    }
    stats.downloads = total
  } catch {
    /* 上游异常：保持 0 值返回，前端按「无有效字段」走直连回退 */
  }

  const res = new Response(JSON.stringify(stats), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': `public, max-age=${TTL}`,
    },
  })
  context.waitUntil(cache.put(cacheKey, res.clone()))
  return res
}
