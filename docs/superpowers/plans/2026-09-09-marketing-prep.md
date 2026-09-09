# FrameLab 宣发准备实施计划（清理 / B站包 / CDP截图）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 完成宣发阶段三件事——项目清理归档（零破坏验证）、B站视频发布全套文档、CDP 自动化产出 6 张真实宣传截图，并以 marketing/ 目录统一交付。

**Architecture:** 清理走「归档即备份」（`_archive/` + git rm/mv）；截图用 Node 内置 WebSocket 直连 WebView2 CDP（`--remote-debugging-port=9222`），预置 AppData catalog JSON 让应用启动即载入演示照片（操作前备份用户图库，操作后恢复）；文案与规格以静态文档交付 `marketing/bilibili/`。

**Tech Stack:** PowerShell 5.1（文件操作）、Node ≥22（内置 WebSocket + fetch 驱动 CDP）、Tauri 2 dev（WebView2）、vitest/vue-tsc（清理回归）、B站规格 1080p60/MP4/1146×717 封面。

**Spec:** `docs/superpowers/specs/2026-09-09-marketing-prep-design.md`

## 执行变更记录

- **2026-09-10：CDP 自动截图取消（用户指示）**，改为用户手动截图 + AI 提供指南（`marketing/screenshots/截图指南.md`）。Task 4（预置图库）/ Task 5（六场景截图）不再执行；Task 3 的 `scripts/cdp-shot.mjs` 保留（未来运行时验证可复用）。
- CDP 尝试结论（留档）：`WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS` 会被宿主侧 `additional_browser_args`（lib.rs L1184）覆盖，需在 Rust 侧追加 `--remote-debugging-port` 才能生效（已验证 CDP UP Edg/152）；该实验性改动已还原，未入库。
- 坑留档：PS5.1 `Set-Content -Encoding UTF8` 写 JSON 带 BOM → 前端 `JSON.parse` 失败被静默吞掉 → 触发 localStorage 旧目录迁移覆盖 seed。写 AppData JSON 必须用 `[IO.File]::WriteAllText` + `UTF8Encoding($false)`。
- 演示照片改用用户指定 `DSC02720.JPG`（spec/plan 已同步，commit 2d8f586）。

**Git 提交身份**（本机全局身份未配置，所有 commit 必须带）：
`git -c user.name=yuhaowang774 -c user.email=yuhaowang774@users.noreply.github.com commit ...`

---

### Task 1: 归档机制与本地垃圾清理（A 类）

**Files:**
- Create: `_archive/2026-09/README.md`
- Modify: `.gitignore`（追加 `_archive/`）
- Move: 根目录 13 项本地垃圾 → `_archive/2026-09/`

- [ ] **Step 1: 建 `_archive/2026-09/` 目录**

```powershell
New-Item -ItemType Directory -Force d:\A\FrameLab\_archive\2026-09 | Out-Null
```

- [ ] **Step 2: 归档 A 类文件（移动，不删除）**

```powershell
$dst = 'd:\A\FrameLab\_archive\2026-09'
$files = 'devserver.err','devserver.log','tauri-dev-err.log','tauri-dev-run.log','tauri-dev.log','web-dev.log','tsconfig.tsbuildinfo','tsconfig.node.tsbuildinfo','vite.config.js','vite.config.d.ts','.gitmsg','verify-export.html'
foreach ($f in $files) { if (Test-Path "d:\A\FrameLab\$f") { Move-Item "d:\A\FrameLab\$f" "$dst\$f" -Force } }
if (Test-Path d:\A\FrameLab\.codebuddy) { Remove-Item d:\A\FrameLab\.codebuddy -Recurse -Force }
```

- [ ] **Step 3: 复制 verify-templates.html 入归档（B 类双保险，Task 2 再 git rm）**

```powershell
Copy-Item d:\A\FrameLab\tools\verify-templates.html d:\A\FrameLab\_archive\2026-09\verify-templates.html
```

- [ ] **Step 4: `.gitignore` 追加 `_archive/`**

在 `.gitignore` 末尾追加一行（用 Edit 工具）：

```
_archive/
```

- [ ] **Step 5: 写 `_archive/2026-09/README.md`（清理审计记录）**

内容：

```markdown
# 2026-09 清理归档（宣发准备）

审计与执行日期：2026-09-09。执行人：AI（FrameLab 宣发准备，spec 见 docs/superpowers/specs/2026-09-09-marketing-prep-design.md）。

## 归档清单（A 类：本地垃圾，gitignored，可再生）

| 文件 | 类型 | 说明 |
|---|---|---|
| devserver.err / devserver.log | 日志 | 2026-08 dev server 残留（.err 为 0 字节） |
| tauri-dev-err.log / tauri-dev-run.log / tauri-dev.log | 日志 | tauri dev 输出残留 |
| web-dev.log | 日志 | 网页开发日志残留 |
| tsconfig.tsbuildinfo / tsconfig.node.tsbuildinfo | 缓存 | vue-tsc -b 增量缓存，构建自动再生 |
| vite.config.js / vite.config.d.ts | 缓存 | tsc 误编译 vite.config.ts 的产物，构建自动再生 |
| .gitmsg | 临时 | 历史提交信息草稿 |
| verify-export.html | 调试页 | 2026-08 导出验证用调试页（gitignored） |
| .codebuddy/ | 空目录 | 外部工具残留，已直接删除 |
| verify-templates.html | 调试页副本 | git 跟踪文件，本目录存副本，git rm 后可从此取回（模板 16 项像素断言验收页） |

## B 类（git 跟踪）处置
- tools/verify-templates.html → git rm（本目录有副本）
- test-assets/test_with_exif.jpg → git mv 至 marketing/demo-photos/（备用演示图，非删除）
- DSC02720.JPG（项目根新增）→ marketing/demo-photos/（主演示照片，SONY ILCE-6000 EXIF 完整）

## 恢复方式
任意文件均可从本目录取回；git rm 的文件另可从 git 历史恢复：`git checkout <commit>^ -- <path>`
```

- [ ] **Step 6: 验证根目录已清爽**

```powershell
Get-ChildItem d:\A\FrameLab -File | Select-Object Name
```
预期：不再出现上述 12 个文件；`Get-ChildItem d:\A\FrameLab\_archive\2026-09` 应列出 13 项（12 文件 + verify-templates 副本）+ README。

---

### Task 2: B 类 git 处置 + marketing 素材迁移 + 回归验证

**Files:**
- Delete: `tools/verify-templates.html`（git rm）
- Move: `test-assets/test_with_exif.jpg` → `marketing/demo-photos/test_with_exif.jpg`（git mv，备用演示图）
- Add: `DSC02720.JPG`（项目根）→ `marketing/demo-photos/DSC02720.JPG`（主演示照片，git add）

- [ ] **Step 1: git mv/add 演示素材 + git rm 调试页**

```powershell
New-Item -ItemType Directory -Force d:\A\FrameLab\marketing\demo-photos | Out-Null
git -C d:\A\FrameLab mv test-assets/test_with_exif.jpg marketing/demo-photos/test_with_exif.jpg
Move-Item d:\A\FrameLab\DSC02720.JPG d:\A\FrameLab\marketing\demo-photos\DSC02720.JPG
git -C d:\A\FrameLab rm tools/verify-templates.html
git -C d:\A\FrameLab add .gitignore _archive/2026-09/README.md marketing/demo-photos/DSC02720.JPG
git -C d:\A\FrameLab status --short
```
预期 status：`R test-assets/... → marketing/demo-photos/...`、`A marketing/demo-photos/DSC02720.JPG`（6.2MB）、`D tools/verify-templates.html`、`.gitignore`、`_archive/2026-09/README.md`（_archive 应为忽略态）。

- [ ] **Step 2: 回归验证（清理零破坏）**

```powershell
npm --prefix d:\A\FrameLab test
npm --prefix d:\A\FrameLab run build
```
预期：vitest 全过（此前 238 用例基线）；vue-tsc 0 错误 + vite build 成功。**若 vitest 因引用 test-assets 失败**（grep 已确认无引用，此处为兜底）：停止执行，向用户报告，从 `_archive` 或 git 历史恢复。

- [ ] **Step 3: Commit**

```bash
git -C d:\A\FrameLab -c user.name=yuhaowang774 -c user.email=yuhaowang774@users.noreply.github.com commit -m "chore: 宣发前项目清理——归档本地日志/缓存，DSC02720+test-assets 入 marketing 演示素材，移除调试验收页"
```

---

### Task 3: CDP 截图驱动脚本

**Files:**
- Create: `scripts/cdp-shot.mjs`

- [ ] **Step 1: 确认 Node 内置 WebSocket 可用**

```powershell
node -e "console.log(typeof WebSocket)"
```
预期输出 `function`（Node ≥22）。若输出 `undefined`：`npm --prefix d:\A\FrameLab i -D ws` 并把脚本首行 `const ws = new WebSocket(...)` 改为 `const { WebSocket } = await import('ws')`。

- [ ] **Step 2: 写 `scripts/cdp-shot.mjs`**

```js
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
```

注意：脚本每条命令独立连接、执行完即退出（幂等，便于逐场景分步驱动）。

- [ ] **Step 3: Commit**

```bash
git -C d:\A\FrameLab add scripts/cdp-shot.mjs
git -C d:\A\FrameLab -c user.name=yuhaowang774 -c user.email=yuhaowang774@users.noreply.github.com commit -m "chore: CDP 截图驱动脚本（WebView2 远程调试端口直连，eval/click/shot 三命令）"
```

---

### Task 4: 预置演示图库（备份→seed→启动验证）

**Files:**
- Modify（用户数据，操作后恢复）: `%APPDATA%\com.framelab.app\framelab-catalog.json`

- [ ] **Step 1: 备份用户现有图库**

```powershell
$dir = "$env:APPDATA\com.framelab.app"
New-Item -ItemType Directory -Force "$dir\_marketing_backup" | Out-Null
if (Test-Path "$dir\framelab-catalog.json") { Copy-Item "$dir\framelab-catalog.json" "$dir\_marketing_backup\framelab-catalog.json.bak" -Force; 'backed up' } else { 'no existing catalog' }
```
记录输出是 `backed up` 还是 `no existing catalog`（决定 Task 7 恢复动作）。

- [ ] **Step 2: 写入演示 catalog**

```powershell
@'
{"folder":null,"paths":["D:\\A\\FrameLab\\marketing\\demo-photos\\test_with_exif.jpg"],"activePath":"D:\\A\\FrameLab\\marketing\\demo-photos\\test_with_exif.jpg"}
'@ | Set-Content -Encoding UTF8 "$env:APPDATA\com.framelab.app\framelab-catalog.json"
```

- [ ] **Step 3: 启动 tauri dev（后台，带 CDP 端口）**

```powershell
$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS='--remote-debugging-port=9222'
npm --prefix d:\A\FrameLab run tauri:dev
```
用 run_in_background 启动（编译后窗口弹出，vite 端口 5180 strictPort）。

- [ ] **Step 4: 验证 CDP 连通 + 演示图库生效**

```powershell
node d:\A\FrameLab\scripts\cdp-shot.mjs eval "document.title"
node d:\A\FrameLab\scripts\cdp-shot.mjs eval "document.body.innerText.includes('DSC02720') || document.querySelectorAll('img').length"
```
预期：返回 `"FrameLab"` 类标题；第二个表达式为 `true` 或数量 >0。**若连不上**：确认窗口已弹出、端口未被占用（`curl http://127.0.0.1:9222/json/version`）；**若图库为空**：读 `src-tauri/tauri.conf.json` 的 identifier 核对 AppData 目录名是否为 `com.framelab.app`，不符则按真实 identifier 重写 seed 文件并重启应用。

---

### Task 5: 六场景截图执行

**Files:**
- Create: `marketing/screenshots/2026-09-09/` 下 6 张 PNG

统一约定：截图前先 `eval` 确认场景状态成立（选择器/文本按实际 DOM 用 `eval "document.body.innerText"` 探查调整，click 命令按可见文本点击）；每张截完立即用 Read 工具目检 PNG（清晰度/内容正确/无弹窗遮挡），不合格调整后重截。

- [ ] **Step 1: 场景1 Hero 编辑大图**（杂志模板选中态 + EXIF 标注可见）

```powershell
node d:\A\FrameLab\scripts\cdp-shot.mjs shot d:\A\FrameLab\marketing\screenshots\2026-09-09\web-hero-edit-2560x1600.png 1280 800 2
```
前置交互：确认工作区已显示照片预览（catalog seed 已带 activePath）；若默认模板不是杂志类，经模板面板点选一款杂志模板再截。产出 2560×1600@2x。

- [ ] **Step 2: 场景2 模板库网格**

```powershell
node d:\A\FrameLab\scripts\cdp-shot.mjs click "相框模板库"
node d:\A\FrameLab\scripts\cdp-shot.mjs shot d:\A\FrameLab\marketing\screenshots\2026-09-09\web-templates-grid-2560x1600.png 1280 800 2
```
面板名以实际 UI 为准（探查 `document.body.innerText` 找「模板」相关入口）。

- [ ] **Step 3: 场景3 EXIF/品牌信息面板**

```powershell
node d:\A\FrameLab\scripts\cdp-shot.mjs click "品牌"
node d:\A\FrameLab\scripts\cdp-shot.mjs shot d:\A\FrameLab\marketing\screenshots\2026-09-09\web-info-exif-2560x1600.png 1280 800 2
```
入口文本在「品牌/信息/EXIF」之间按实际 UI 探查确定；确保面板展开且 EXIF 字段有真实数据。

- [ ] **Step 4: 场景4 导出面板**

```powershell
node d:\A\FrameLab\scripts\cdp-shot.mjs click "导出"
node d:\A\FrameLab\scripts\cdp-shot.mjs shot d:\A\FrameLab\marketing\screenshots\2026-09-09\web-export-panel-2560x1600.png 1280 800 2
```

- [ ] **Step 5: 场景5 图库多选**

进入图库模块（探查导航/底部工具栏入口文本），确认网格显示演示照片后截图（多选态可选：若 Shift 多选无法注入则用单选全览）：

```powershell
node d:\A\FrameLab\scripts\cdp-shot.mjs shot d:\A\FrameLab\marketing\screenshots\2026-09-09\web-library-grid-2560x1600.png 1280 800 2
```

- [ ] **Step 6: 场景6 B站封面构图**

回到场景1状态（照片+杂志模板预览满幅），按封面比例 1.6:1 出图：

```powershell
node d:\A\FrameLab\scripts\cdp-shot.mjs shot d:\A\FrameLab\marketing\screenshots\2026-09-09\bilibili-cover-1146x717.png 1146 717 1
```

- [ ] **Step 7: 全部截图 QC**

```powershell
Get-ChildItem d:\A\FrameLab\marketing\screenshots\2026-09-09 | Select-Object Name, Length
```
逐张 Read 目检：①100% 放大文字可读 ②EXIF/模板数据真实非占位 ③分辨率与命名一致 ④无调试痕迹（devtools/控制台弹窗）。

---

### Task 6: B站发布四件套文档

**Files:**
- Create: `marketing/bilibili/分镜脚本.md`、`发布文案.md`、`录屏与压制.md`、`数据跟踪.md`

- [ ] **Step 1: 写 `分镜脚本.md`**（核心内容如下，照搬成文）

| # | 时长 | 画面 | 操作 | 字幕/口播 |
|---|---|---|---|---|
| 1 | 0-5s | 成品开场：挂好 Logo+EXIF 的杂志风照片缓慢缩放 | 无操作，静置展示 | 「发图前，最后一步」 |
| 2 | 5-12s | 图库导入 | 拖入照片进图库 | 「拖进来，就能用」 |
| 3 | 12-25s | 模板库浏览→点选杂志模板 | 打开相框模板库，滚动网格，点选 | 「杂志级模板 · 16 种画幅」 |
| 4 | 25-40s | 品牌/EXIF 面板 | 填品牌 Logo，指 EXIF 自动读取的机型/参数行 | 「EXIF 自动读取 · 品牌 Logo 一键挂载」 |
| 5 | 40-50s | 导出面板 | 选 JPG 高画质，导出，打开成片 | 「无损导出 JPG / PNG」 |
| 6 | 50-60s | 桌面/任务栏特写 | 强调无登录无上传 | 「照片不出你的电脑」 |
| 7 | 60-75s | 图库多选批量套模板（可选，时间紧可剪） | Shift 多选→批量导出 | 「批量处理，一次搞定」 |
| 8 | 75-90s | 成品拼图 + 结尾卡 | 静态 + 下载地址 | 「开源免费 · 下载地址在简介」 |

录制要点：1080p60（规格见录屏与压制.md）；每镜头之间停顿 1s 方便剪辑；镜头 3-5 是核心卖点，节奏放慢。

- [ ] **Step 2: 写 `发布文案.md`**（照搬成文）

标题（3 备选，B站 ≤80 字）：
1. 开源免费！给照片自动挂 Logo 和 EXIF 参数的桌面小工具，照片不出电脑
2. 做了个本地照片相框工具：杂志模板 + EXIF 自动标注，一键无损导出
3. 摄影师发图前的最后一步，我把它做成了免费开源软件

简介：
```
FrameLab 是一款开源免费的本地照片相框工具：给照片挂品牌 Logo 和 EXIF 参数，杂志模板一键套用，无损导出 JPG/PNG——照片不出你的电脑。

下载（Win10/11，约 12MB）：https://framelab-studio.pages.dev
GitHub（求个 Star）：https://github.com/yuhaowang774/FrameLabdesktop

安装一次支持自动更新，永久免费。
```

标签（10）：效率工具、开源项目、摄影后期、软件推荐、桌面软件、照片处理、水印、EXIF、独立开发、程序员
分区：科技 → 软件应用；封面：`bilibili-cover-1146x717.png`（可后期加标题字）
发布时间：工作日 18:00-20:00 或周末 10:00-12:00

- [ ] **Step 3: 写 `录屏与压制.md`**（照搬成文）

OBS 设置：窗口采集 FrameLab（或显示器采集 1920×1080）；输出分辨率 1920×1080、60fps；录制编码 x264（CQP 18）或 NVENC（RTX 5060 Ti，CQP 17）；录制格式 MKV（防崩溃）。
压制（发布前）：
```
ffmpeg -i raw.mkv -c:v libx264 -crf 18 -preset slow -pix_fmt yuv420p -c:a aac -b:a 192k bilibili-final.mp4
```
NVENC 版：`-c:v h264_nvenc -cq 19` 替换 libx264 段。
自查清单：分辨率 1920×1080 / 60fps；前 5 秒见产品成品；总长 60-90s；音轨清晰或用纯字幕+BGM；B站二压后检查画质（上传后自己看一遍成片）。

- [ ] **Step 4: 写 `数据跟踪.md`**（照搬成文）

```markdown
# B站数据跟踪（周更）

| 周次 | 日期 | 播放 | 完播率 | 点赞 | 投币 | 收藏 | 转发 | 评论 | 涨粉 | 备注 |
|---|---|---|---|---|---|---|---|---|---|---|
| W1 |  |  |  |  |  |  |  |  |  |  |

## 复盘要点（每周填）
- 完播率 <30%：考虑压缩到 60s / 前 5 秒换更强的成品镜头
- 点击率低：换封面/标题（A/B：保留另一版下次用）
- 评论高频问题：整理进 website FAQ 或下期视频选题
- 转发来源：若摄影社群传播强，下期做摄影向选题（如「卡片机扫街出片流程」）
```

- [ ] **Step 5: Commit**

```bash
git -C d:\A\FrameLab add marketing/bilibili
git -C d:\A\FrameLab -c user.name=yuhaowang774 -c user.email=yuhaowang774@users.noreply.github.com commit -m "docs: B站发布四件套——分镜脚本/发布文案/录屏压制参数/数据跟踪模板"
```

---

### Task 7: 收尾——恢复图库、README 索引、交付清单

**Files:**
- Create: `marketing/README.md`
- Restore: `%APPDATA%\com.framelab.app\framelab-catalog.json`

- [ ] **Step 1: 关闭 tauri dev，恢复用户图库**

```powershell
$dir = "$env:APPDATA\com.framelab.app"
if (Test-Path "$dir\_marketing_backup\framelab-catalog.json.bak") {
  Copy-Item "$dir\_marketing_backup\framelab-catalog.json.bak" "$dir\framelab-catalog.json" -Force
} else {
  Remove-Item "$dir\framelab-catalog.json" -Force -ErrorAction SilentlyContinue
}
```
（即：Task 4 备份了就还原，没备份就删除 seed——目录空文件等价空图库，也可写入 `{"folder":null,"paths":[],"activePath":null}`，二选一，保持与备份前语义一致。）

- [ ] **Step 2: 写 `marketing/README.md`**（素材总索引 + 交付清单）

```markdown
# FrameLab 宣发素材库

定位文案（统一口径）：开源免费 / 本地小工具 / 给照片挂品牌 Logo 和 EXIF 参数 / 杂志模板 / 无损输出 / 照片不出你的电脑。

## 目录
- `demo-photos/` 演示照片（`DSC02720.JPG` 主用：SONY ILCE-6000，EXIF 完整含镜头；`test_with_exif.jpg` 备用）
- `screenshots/<日期>/` 宣传截图（CDP 真实截图，2x 高清）
- `bilibili/` B站发布四件套（分镜/文案/压制/数据跟踪）

## 截图产出方式（复现步骤）
1. `$env:WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS='--remote-debugging-port=9222'; npm run tauri:dev`
2. 备份并预置 `%APPDATA%\com.framelab.app\framelab-catalog.json`（见 plans/2026-09-09-marketing-prep.md Task 4）
3. `node scripts/cdp-shot.mjs shot <file> <w> <h> <dsf>`（eval/click 驱动场景）
4. 截完恢复 catalog

## 命名规范
小写中划线三段式：`{用途}-{场景}-{规格}.png`（例 `bilibili-cover-1146x717.png`、`web-hero-edit-2560x1600.png`）

## 交付清单（2026-09-09 批次）
| 文件 | 用途 |
|---|---|
| screenshots/2026-09-09/web-hero-edit-2560x1600.png | 官网 Hero / README 头图备选 |
| screenshots/2026-09-09/web-templates-grid-2560x1600.png | 模板丰富度展示 |
| screenshots/2026-09-09/web-info-exif-2560x1600.png | EXIF/Logo 功能展示 |
| screenshots/2026-09-09/web-export-panel-2560x1600.png | 无损导出展示 |
| screenshots/2026-09-09/web-library-grid-2560x1600.png | 图库管理展示 |
| screenshots/2026-09-09/bilibili-cover-1146x717.png | B站封面底图 |

## 视频分工
AI 已产出：分镜脚本 / 发布文案 / 压制命令（bilibili/）。待办：用户按分镜录屏 → ffmpeg 压制 → 按 发布文案.md 发布 → 每周填 数据跟踪.md。
```

- [ ] **Step 3: 最终验证 + Commit + Push**

```powershell
git -C d:\A\FrameLab status --short   # 应只有 marketing/ 新增
npm --prefix d:\A\FrameLab test       # 回归最后确认
git -C d:\A\FrameLab add marketing
git -C d:\A\FrameLab -c user.name=yuhaowang774 -c user.email=yuhaowang774@users.noreply.github.com commit -m "docs: 宣发素材库上线——README 索引/命名规范/交付清单"
git -C d:\A\FrameLab push
```

---

## Self-Review 结论

- **Spec 覆盖**：清理归档（Task 1-2）、归档机制+审计记录（Task 1）、B站规格+四件套+排期（Task 6，排期=发布时间+周更跟踪）、CDP 截图 6 场景+演示照片（Task 3-5）、命名规范+交付清单+QC（Task 5 Step7 / Task 7）、target 保留（不涉及操作，符合 spec）✓
- **占位符扫描**：Task 5 交互文本（「品牌」「导出」入口）为运行时探查并给出探查命令与调整规则，非占位；其余步骤均含完整命令/内容 ✓
- **一致性**：目录名 `marketing/`、`_archive/2026-09/`、文件名与 spec 第四节一致；demo 照片路径 `marketing/demo-photos/DSC02720.JPG`（主）全程一致 ✓
