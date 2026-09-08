/* FrameLab 宣传下载页交互脚本（零依赖） */
(function () {
  'use strict';

  var GH_API = 'https://api.github.com/repos/yuhaowang774/FrameLabdesktop';
  var FALLBACK_VERSION = 'v0.2.0';

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

  /* ---------- 下载/联系点击上报（Nginx /track/ 端点记日志，部署见 docs/DEPLOY.md） ---------- */
  document.addEventListener('click', function (e) {
    var el = e.target instanceof Element ? e.target.closest('[data-track]') : null;
    if (!el) return;
    var name = el.getAttribute('data-track');
    try {
      if (navigator.sendBeacon) {
        navigator.sendBeacon('/track/' + encodeURIComponent(name));
      } else {
        new Image().src = '/track/' + encodeURIComponent(name) + '?t=' + Date.now();
      }
    } catch (_) { /* 统计失败不影响主流程 */ }
  });

  /* ---------- 版本号同步（GitHub API，失败静默回退内置值） ---------- */
  function setVersion(v) {
    var pill = document.getElementById('verPill');
    if (pill) pill.textContent = v;
  }
  setVersion(FALLBACK_VERSION);

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

  if ('fetch' in window) {
    try {
      // 最新版本号
      fetch(GH_API + '/releases/latest', { headers: { Accept: 'application/vnd.github+json' } })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
          if (data && typeof data.tag_name === 'string' && /^v?\d/.test(data.tag_name)) {
            setVersion(data.tag_name.charAt(0) === 'v' ? data.tag_name : 'v' + data.tag_name);
          }
        })
        .catch(function () { /* 网络受限时保留内置版本号 */ });

      // star 数
      fetch(GH_API, { headers: { Accept: 'application/vnd.github+json' } })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (data) {
          if (data && typeof data.stargazers_count === 'number') renderStars(data.stargazers_count);
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
        page(1).then(renderTotal).catch(function () { /* 失败保持占位 — */ });
      })();
    } catch (_) { /* 忽略 */ }
  }
})();
