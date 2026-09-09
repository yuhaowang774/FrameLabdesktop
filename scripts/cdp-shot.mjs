// CDP 驱动 WebView2 截图/交互（Node ≥22，零依赖）
// 前置：$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS='--remote-debugging-port=9222'; npm run tauri:dev
// 用法：
//   node scripts/cdp-shot.mjs eval "<js>"          # 页面内执行 JS，输出 JSON 结果
//   node scripts/cdp-shot.mjs click "文本"          # 按可见文本点击元素
//   node scripts/cdp-shot.mjs shot <file> [w] [h] [dsf]  # 设视口并截图 PNG
const PORT = 9222
const targets = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
const page = targets.find(t => t.type === 'page')
if (!page) { console.error('no page target'); process.exit(1) }
const ws = new WebSocket(page.webSocketDebuggerUrl)
let seq = 0
const pending = new Map()
ws.onmessage = e => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
}
await new Promise(r => { ws.onopen = r })
function send(method, params = {}) {
  const id = ++seq
  ws.send(JSON.stringify({ id, method, params }))
  return new Promise(res => pending.set(id, res))
}
async function evalJs(expr) {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
  if (r.result?.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails))
  return r.result?.result?.value
}
const [cmd, ...rest] = process.argv.slice(2)
if (cmd === 'eval') {
  console.log(JSON.stringify(await evalJs(rest[0])))
} else if (cmd === 'click') {
  const text = JSON.stringify(rest[0])
  const ok = await evalJs(`(() => {
    const els = [...document.querySelectorAll('button,[role=button],a,h3,h4,label,span,div,li')]
    const el = els.reverse().find(e => e.childElementCount === 0 && e.textContent.trim().includes(${text}))
    if (!el) return false
    el.click(); return true
  })()`)
  console.log(ok ? 'clicked' : 'NOT FOUND: ' + rest[0])
  process.exit(ok ? 0 : 1)
} else if (cmd === 'shot') {
  const [file, w = '1280', h = '800', dsf = '2'] = rest
  await send('Page.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: +w, height: +h, deviceScaleFactor: +dsf, mobile: false })
  await new Promise(r => setTimeout(r, 800))
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  if (!shot.result?.data) { console.error('capture failed: ' + JSON.stringify(shot).slice(0, 200)); process.exit(1) }
  const { writeFileSync } = await import('node:fs')
  writeFileSync(file, Buffer.from(shot.result.data, 'base64'))
  console.log('saved', file, `${w}x${h}@${dsf}x`)
} else {
  console.error('unknown command'); process.exit(1)
}
process.exit(0)
