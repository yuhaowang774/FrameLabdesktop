/* FrameLab 宣传下载页交互脚本（零依赖） */
(function () {
  'use strict';

  var GH_API = 'https://api.github.com/repos/yuhaowang774/FrameLabdesktop';
  var FALLBACK_VERSION = 'v0.2.7';

  /* ---------- 统计数据三层兜底：localStorage 上次实时值 → 构建烘焙值 → 内置常量 ----------
     GitHub API 在部分访客网络下会限流（未认证 60 次/时/IP）或不可达，实时拉取可能失败；
     构建时 scripts/fetch-gh-stats.mjs 把当时的值烘焙进 assets/gh-stats.js，
     叠加本地缓存，保证任何网络环境下数字都不空白。
     缓存带 6 小时时效：过期后退回烘焙值/常量，避免发新版后老访客长期停留在旧版本号。 */
  var LS_STATS_KEY = 'gh-stats-cache';
  var CACHE_TTL_MS = 6 * 60 * 60 * 1000;
  function readCache() {
    try {
      var v = JSON.parse(localStorage.getItem(LS_STATS_KEY) || 'null');
      // 无时间戳的旧格式缓存视为过期（发新版后不被旧值长期压制）
      if (!(v && typeof v === 'object' && typeof v.ts === 'number')) return null;
      if (Date.now() - v.ts > CACHE_TTL_MS) return null;
      return v;
    } catch (_) { return null; }
  }
  var bakedStats = (typeof window.GH_STATS_BAKED === 'object' && window.GH_STATS_BAKED) || {};
  var cachedStats = readCache() || {}; // 无缓存时回退空对象，避免 null 取属性崩溃
  var curStats = {
    stars: cachedStats.stars || bakedStats.stars || 0,
    downloads: cachedStats.downloads || bakedStats.downloads || 0,
    version: cachedStats.version || bakedStats.version || FALLBACK_VERSION
  };
  function cacheStats() {
    try { localStorage.setItem(LS_STATS_KEY, JSON.stringify({ ts: Date.now(), stars: curStats.stars, downloads: curStats.downloads, version: curStats.version })); } catch (_) {}
  }
  function applyStats() {
    setVersion(curStats.version);
    renderTotal(curStats.downloads);
    renderStars(curStats.stars);
  }

  /* ---------- 页脚年份 ---------- */
  var yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  /* ---------- 导航栏滚动状态 ---------- */
  var header = document.getElementById('siteHeader');
  function onScroll() {
    if (header) header.classList.toggle('scrolled', window.scrollY > 8);
  }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ---------- 滚动显现动画 ---------- */
  var reveals = document.querySelectorAll('.reveal');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || !('IntersectionObserver' in window)) {
    reveals.forEach(function (el) { el.classList.add('visible'); });
  } else {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -24px 0px' }
    );
    reveals.forEach(function (el) { io.observe(el); });
  }

  /* ---------- 网页版嵌入窗口等比缩放 ----------
     iframe 以 1280×800 桌面视口渲染完整界面，按容器宽度等比缩小，观感如同开了一个真实窗口。 */
  var embedFrame = document.getElementById('appEmbed');
  var embedBox = embedFrame ? embedFrame.parentElement : null;
  function fitEmbed() {
    if (!embedFrame || !embedBox) return;
    var s = embedBox.clientWidth / 1280;
    embedFrame.style.transform = 'scale(' + s + ')';
  }
  window.addEventListener('resize', fitEmbed, { passive: true });
  fitEmbed();

  /* ---------- 版本号（实时值优先，兜底见三层回退） ---------- */
  function setVersion(v) {
    var pill = document.getElementById('verPill');
    if (pill && v) pill.textContent = v;
  }

  /* ---------- 累计下载数（汇总全部 Releases 资产 download_count） ---------- */
  function renderTotal(n) {
    var el = document.getElementById('dlTotal');
    if (el && typeof n === 'number' && n > 0) el.textContent = n.toLocaleString('en-US');
  }

  /* ---------- star 数 ---------- */
  function renderStars(n) {
    if (!(typeof n === 'number' && n > 0)) return;
    var chip = document.getElementById('starChip');
    var count = document.getElementById('starCount');
    if (count) count.textContent = n >= 1000 ? (n / 1000).toFixed(1) + 'K' : String(n);
    if (chip) chip.hidden = false;
  }

  /* 先渲染兜底值（缓存 → 烘焙 → 常量），实时拉取成功后再覆盖 */
  applyStats();

  if ('fetch' in window) {
    try {
      // 最新版本号
      fetch(GH_API + '/releases/latest', { headers: { Accept: 'application/vnd.github+json' } })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
          if (data && typeof data.tag_name === 'string' && /^v?\d/.test(data.tag_name)) {
            curStats.version = data.tag_name.charAt(0) === 'v' ? data.tag_name : 'v' + data.tag_name;
            cacheStats();
            setVersion(curStats.version);
          }
        })
        .catch(function () { /* 网络受限时保留兜底值 */ });

      // star 数
      fetch(GH_API, { headers: { Accept: 'application/vnd.github+json' } })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
          if (data && typeof data.stargazers_count === 'number') {
            curStats.stars = data.stargazers_count;
            cacheStats();
            renderStars(curStats.stars);
          }
        })
        .catch(function () { /* 忽略 */ });

      // 累计下载数（releases 可能多页，逐页汇总）
      (function sumDownloads() {
        var total = 0;
        function page(n) {
          return fetch(GH_API + '/releases?per_page=100&page=' + n, { headers: { Accept: 'application/vnd.github+json' } })
            .then(function (r) { return r.ok ? r.json() : []; })
            .then(function (list) {
              if (!Array.isArray(list) || !list.length) return total;
              list.forEach(function (rel) {
                (rel.assets || []).forEach(function (a) { total += a.download_count || 0; });
              });
              return list.length === 100 ? page(n + 1) : total;
            });
        }
        page(1).then(function (total) {
          curStats.downloads = total;
          cacheStats();
          renderTotal(total);
        }).catch(function () { /* 失败保持兜底值 */ });
      })();
    } catch (_) { /* 忽略 */ }
  }
})();
