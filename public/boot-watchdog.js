// FrameLab 启动看门狗（白屏自愈）。
// 必须是普通脚本（非 module）并在所有模块之前执行；CSP script-src 'self' 允许同源脚本。
// 职责：
//  1) 尽早捕获 window error / unhandledrejection，供恢复界面展示与落盘；
//  2) main.ts 挂载成功后调用 __MARK_BOOTED__ 取消看门狗；
//  3) 8 秒后 #app 仍为空 → 判定启动失败：把错误经 write_boot_log 落盘，
//     并渲染恢复界面（清除缓存并重启 / 禁用 GPU 重启 / 重新加载 / 复制错误信息）。
// 覆盖的典型场景：更新后 WebView2 缓存了旧 index.html 引用失效资源、更新半安装、
// GPU 驱动 / 显卡缓存损坏导致的白屏等。
;(function () {
  'use strict'
  var errors = []
  window.__BOOT_ERRORS__ = errors
  window.addEventListener('error', function (e) {
    var msg
    if (e && e.target && (e.target.tagName === 'SCRIPT' || e.target.tagName === 'LINK')) {
      msg = '资源加载失败: ' + (e.target.src || e.target.href || '')
    } else {
      msg = (e && (e.message || e.type)) || 'unknown error'
      if (e && e.filename) msg += ' @' + e.filename + ':' + (e.lineno || 0)
    }
    errors.push(msg)
  }, true)
  window.addEventListener('unhandledrejection', function (e) {
    var r = e && e.reason
    errors.push('Promise 拒绝: ' + ((r && (r.stack || r.message)) || String(r)))
  })

  var booted = false
  window.__MARK_BOOTED__ = function () { booted = true }

  function invoke(cmd, args) {
    try {
      var t = window.__TAURI__
      if (t && t.core && t.core.invoke) return t.core.invoke(cmd, args)
    } catch (_) { /* 非 Tauri 环境（网页端）忽略 */ }
    return Promise.reject(new Error('not-tauri'))
  }

  function bootLog(content) {
    invoke('write_boot_log', { content: content }).catch(function () { /* 落盘失败静默 */ })
  }

  function showFallback(detail) {
    var app = document.getElementById('app')
    if (!app || app.childElementCount > 0) return
    var esc = function (s) {
      return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    }
    var wrap = document.createElement('div')
    wrap.style.cssText =
      'position:fixed;inset:0;background:#1a1a1a;color:#ddd;display:flex;align-items:center;justify-content:center;font-family:system-ui,sans-serif;z-index:99999'
    wrap.innerHTML =
      '<div style="max-width:640px;width:92%;background:#242424;border:1px solid #3a3a3a;padding:24px 28px">' +
      '<h2 style="margin:0 0 8px;font-size:16px;font-weight:600;color:#fff">FrameLab 启动遇到问题</h2>' +
      '<p style="margin:0 0 14px;font-size:13px;line-height:20px;color:#aaa">应用未能在预期时间内启动。可尝试以下修复；错误详情已记录，也可复制后发送给开发者。</p>' +
      '<pre id="bl-detail" style="max-height:180px;overflow:auto;background:#161616;border:1px solid #3a3a3a;padding:10px;font-size:11px;line-height:16px;color:#9a9a9a;white-space:pre-wrap;word-break:break-all;user-select:text"></pre>' +
      '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:16px">' +
      '<button id="bl-cache" style="flex:1;min-width:150px;height:32px;background:#e8e8e8;color:#111;border:none;font-size:13px;cursor:pointer">清除缓存并重启（推荐）</button>' +
      '<button id="bl-gpu" style="flex:1;min-width:150px;height:32px;background:transparent;color:#ddd;border:1px solid #4a4a4a;font-size:13px;cursor:pointer">禁用 GPU 加速并重启</button>' +
      '<button id="bl-reload" style="height:32px;padding:0 14px;background:transparent;color:#aaa;border:1px solid #3a3a3a;font-size:13px;cursor:pointer">重新加载</button>' +
      '<button id="bl-copy" style="height:32px;padding:0 14px;background:transparent;color:#aaa;border:1px solid #3a3a3a;font-size:13px;cursor:pointer">复制错误信息</button>' +
      '</div>' +
      '<p style="margin:14px 0 0;font-size:11px;color:#777;line-height:16px">若以上均无效：请重启电脑，或到 GitHub Releases 重新下载安装包覆盖安装。</p>' +
      '</div>'
    document.body.appendChild(wrap)
    var pre = wrap.querySelector('#bl-detail')
    pre.textContent = detail
    wrap.querySelector('#bl-cache').onclick = function () {
      this.textContent = '正在清理并重启…'
      this.disabled = true
      invoke('queue_webview_cache_clean').catch(function () {
        pre.textContent = '清理失败（非桌面环境或权限不足）。请重启电脑，或重新安装应用。'
      })
    }
    wrap.querySelector('#bl-gpu').onclick = function () {
      this.textContent = '正在以安全模式重启…'
      this.disabled = true
      invoke('queue_disable_gpu').catch(function () {
        pre.textContent = '操作失败（非桌面环境）。请重启电脑后重试。'
      })
    }
    wrap.querySelector('#bl-reload').onclick = function () { location.reload() }
    wrap.querySelector('#bl-copy').onclick = function () {
      var btn = this
      try {
        navigator.clipboard.writeText(detail).then(function () {
          btn.textContent = '已复制 ✓'
          setTimeout(function () { btn.textContent = '复制错误信息' }, 2000)
        })
      } catch (_) { /* 剪贴板不可用：用户可手动选中 pre 文本 */ }
    }
    bootLog(detail)
  }

  // 8 秒阈值：慢盘机器上恢复历史/桌面 shell 可能需要数秒，避免误报
  setTimeout(function () {
    var app = document.getElementById('app')
    if (booted || (app && app.childElementCount > 0)) {
      // 已挂载：若启动期间捕获到错误，仅落盘供诊断，不打扰用户
      if (errors.length) bootLog(errors.join('\n'))
      return
    }
    showFallback(errors.length ? errors.join('\n') : '等待 8 秒后应用仍未挂载（未捕获到错误）')
  }, 8000)
})()
