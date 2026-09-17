// 范式扫描器（合规版本，2026-09-16）
// 用途：只读扫描 D:\FRAMEELF\templates_decoded 的竞品模板 JSON，提取**版式范式指纹**
//       （几何比例 / 信息区方位 / 文字行构成 / 装饰层构成），集群后输出清单，
//       用于「以自有引擎参数重写同范式模板」的排期与去重。
//
// 合规边界（AGENTS.md）：本脚本**只统计结构与比例**，不复制、不导出竞品的
//   素材（相机壳 PNG / Logo SVG / 字体文件）、示例文案与预览图；
//   输出的报告不含竞品原文案，也不落任何竞品资源到本仓库。
//
// 用法：node scripts/scan-frameelf-paradigms.mjs [语料目录]
// 产物：docs/frameelf-范式清单.md（覆盖度判定由脚本内 COVERAGE 表人工维护，见文末）
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = fileURLToPath(new URL('..', import.meta.url))
const SRC_DIR = process.argv[2] ?? process.env.FRAMEELF_DIR ?? 'D:/FRAMEELF/templates_decoded'
const OUT_MD = join(REPO, 'docs', 'frameelf-范式清单.md')

if (!existsSync(SRC_DIR)) {
  console.error('语料目录不存在：' + SRC_DIR)
  process.exit(1)
}

// 语料文件带 UTF-8 BOM（PowerShell 导出所致），统一去 BOM 后再解析
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8').replace(/^\uFEFF/, ''))

// ===== 1. 读取元数据（_index.json：分类 / 尺寸 / 预览图 URL，仅用分类与尺寸）=====
const indexFile = join(SRC_DIR, '_index.json')
const meta = existsSync(indexFile) ? readJson(indexFile) : []
const metaByIndex = new Map(meta.map((m) => [m.index, m]))

// ===== 2. 逐个模板提取指纹 =====
const nodesOf = (root) => {
  const out = []
  const walk = (n) => {
    if (!n || typeof n !== 'object') return
    out.push(n)
    for (const c of n.children ?? []) walk(c)
  }
  walk(root)
  return out
}
const pct = (v, base) => (base ? Math.round((v / base) * 1000) / 10 : 0)
const bucket = (v, steps) => steps.find((s) => v <= s.max)?.name ?? steps[steps.length - 1].name

/** 信息区（EXIFFrame）相对画布的方位与厚度 */
function infoBand(node, cw, ch) {
  if (!node) return { key: 'none', note: '无信息区' }
  if (node.frameType === 'opposite' || node.floatAlign) {
    return { key: `浮动:${node.floatAlign ?? '?'}`, note: `浮动水印（距照片 ${node.floatDistance ?? 0}px）` }
  }
  const x = node.x ?? 0
  const y = node.y ?? 0
  const h = node.height ?? 0
  const w = node.width ?? 0
  const bottomThick = pct(ch - y, ch)
  const topThick = pct(y + h, ch)
  const rightThick = pct(cw - x, cw)
  const leftThick = pct(x + w, cw)
  const candidates = [
    { dir: '底部横带', thick: bottomThick },
    { dir: '顶部横带', thick: topThick },
    { dir: '右缘竖带', thick: rightThick },
    { dir: '左缘竖带', thick: leftThick },
  ].sort((a, b) => a.thick - b.thick)
  const b = candidates[0]
  const size = bucket(b.thick, [
    { max: 8, name: '窄(≤8%)' },
    { max: 16, name: '中(8~16%)' },
    { max: 26, name: '厚(16~26%)' },
    { max: 101, name: '特厚(>26%)' },
  ])
  return { key: `${b.dir}${size}`, note: `信息区厚 ${b.thick}%（${Math.round(b.thick === bottomThick ? h : w)}px）` }
}

/** 文字行构成：行数 + 数据类型序列 + 对齐 + 字号（相对画布宽） */
function textSpec(texts, cw) {
  if (!texts.length) return { key: '无文字', note: '' }
  const kinds = texts.map((t) => {
    const f = String(t.EXIFFormat ?? '')
    if (!f) return '固定文案'
    if (/\[device\]|\[make\]|\[model\]/.test(f)) return '器材'
    if (/\[lens\]/.test(f)) return '镜头'
    if (/\[f\]|\[s\]|\[iso\]|\[mm\]|\[speed\]/.test(f)) return '参数'
    if (/\[sign\]/.test(f)) return '署名'
    if (/yyyy|MM|dd|HH/.test(f)) return '日期'
    if (/\[city\]|\[gps\]|\[place\]|\[country\]/.test(f)) return '位置'
    if (/\[weekcn\]|\[monthcn\]|\[daycn\]|农历|干支/.test(f)) return '农历'
    return '其他'
  })
  const align = texts[0]?.textAlign ?? 'left'
  const sizes = texts.map((t) => pct((t.fontSize ?? 0) * (t.scaleX ?? t.globalScale ?? 1), cw))
  const maxSize = Math.max(...sizes)
  const sizeCls = bucket(maxSize, [
    { max: 1.2, name: '小字(≤1.2%)' },
    { max: 2, name: '中字(1.2~2%)' },
    { max: 3.2, name: '大字(2~3.2%)' },
    { max: 99, name: '特大(>3.2%)' },
  ])
  const upper = texts.some((t) => t.textCase === 'upper')
  return {
    key: `${texts.length}行[${kinds.join('/')}]${align}${sizeCls}${upper ? '大写' : ''}`,
    note: `字号 ${maxSize}%（相对画布宽），行距/字距按比例缩放`,
  }
}

/** 画布比例档（范式骨架维度：方幅 / 竖幅 / 长竖幅 / 横幅 / 宽横幅） */
const ratioBucket = (r) => (r < 0.62 ? '长竖幅' : r < 0.95 ? '竖幅' : r <= 1.05 ? '方幅' : r <= 1.6 ? '横幅' : '宽横幅')

/** 装饰层构成 */
function decorSpec(nodes) {
  const count = (tag) => nodes.filter((n) => n.tag === tag).length
  const parts = []
  const logo = nodes.filter((n) => n.tag === 'Logo')
  if (logo.length) {
    const types = [...new Set(logo.map((l) => l.EXIFLogoType ?? 'custom'))]
    parts.push(`Logo×${logo.length}(${types.join('/')})`)
  }
  const cam = nodes.filter((n) => n.tag === 'CameraLogo' || n.filmFrame || n.photoFrame)
  if (cam.length) parts.push(`相机壳/胶片框×${cam.length}`)
  if (count('Swatch')) parts.push(`色卡×${count('Swatch')}`)
  if (count('SwatchLine')) parts.push(`色卡条×${count('SwatchLine')}`)
  if (count('Polygon')) parts.push(`多边形×${count('Polygon')}`)
  if (count('Rect')) parts.push(`色块×${count('Rect')}`)
  if (count('Line') + count('SplitLine')) parts.push(`线条×${count('Line') + count('SplitLine')}`)
  if (count('ImageBg')) parts.push('背景图')
  if (count('CalendarBox')) parts.push('日历格')
  if (count('ImageGroup')) parts.push('拼图组')
  return parts.length ? parts.join(' + ') : '无装饰层'
}

/** 装饰层「类别集合」（骨架维度：只看有没有，不看数量） */
function decorFlags(nodes) {
  const has = (tag) => nodes.some((n) => n.tag === tag)
  const flags = []
  const logo = nodes.filter((n) => n.tag === 'Logo')
  if (logo.length) flags.push(`Logo(${[...new Set(logo.map((l) => l.EXIFLogoType ?? 'custom'))].join('/')})`)
  if (nodes.some((n) => n.tag === 'CameraLogo' || n.filmFrame || n.photoFrame)) flags.push('相机壳')
  if (has('Swatch') || has('SwatchLine')) flags.push('色卡')
  if (has('Polygon')) flags.push('多边形')
  if (has('Rect')) flags.push('色块')
  if (has('Line') || has('SplitLine')) flags.push('线条')
  if (has('ImageBg')) flags.push('背景图')
  if (has('CalendarBox')) flags.push('日历格')
  if (has('ImageGroup')) flags.push('拼图组')
  return flags.length ? flags.join('+') : '纯底'
}

/** 单行数据类型（EXIFFormat 占位符 → 我们侧的语义类别） */
function kindOf(t) {
  const f = String(t.EXIFFormat ?? '')
  if (!f) return '固定文案'
  if (/\[device\]|\[make\]|\[model\]/.test(f)) return '器材'
  if (/\[lens\]/.test(f)) return '镜头'
  if (/\[f\]|\[s\]|\[iso\]|\[mm\]|\[speed\]/.test(f)) return '参数'
  if (/\[sign\]/.test(f)) return '署名'
  if (/yyyy|MM|dd|HH/.test(f)) return '日期'
  if (/\[city\]|\[gps\]|\[place\]|\[country\]/.test(f)) return '位置'
  if (/\[weekcn\]|\[monthcn\]|\[daycn\]/.test(f)) return '农历'
  return '其他'
}

/** 文字骨架：行数 + 主体数据类型（不看具体文案与字号档） */
function kindSpec(kinds) {
  if (!kinds.length) return '无文字'
  const tally = new Map()
  for (const k of kinds) tally.set(k, (tally.get(k) ?? 0) + 1)
  const main = [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0]
  const extras = ['器材', '署名', '日期', '位置', '农历'].filter((k) => k !== main && tally.has(k))
  return `${kinds.length}行·主${main}${extras.length ? '+' + extras.join('/') : ''}`
}

const rows = []
const files = []
for (const dir of readdirSync(SRC_DIR)) {
  const full = join(SRC_DIR, dir)
  let entries = []
  try {
    entries = readdirSync(full)
  } catch {
    continue // _index.json 等文件跳过
  }
  for (const f of entries) {
    if (f.endsWith('.json') && !f.startsWith('_')) files.push({ category: dir, file: join(full, f) })
  }
}

for (const { category, file } of files) {
  let doc
  try {
    doc = readJson(file)
  } catch {
    console.warn('解析失败，跳过：' + file)
    continue
  }
  const page = doc.json ?? doc
  const nodes = nodesOf(page)
  const card = nodes.find((n) => n.tag === 'Card') ?? page
  const cw = page.width ?? card.width ?? 0
  const ch = page.height ?? card.height ?? 0
  const photo = nodes.find((n) => n.tag === 'Photo')
  const frame = nodes.find((n) => n.tag === 'EXIFFrame')
  const texts = nodes.filter((n) => n.tag === 'TextBox' || n.tag === 'LText')
  const split = frame?.splitLineIncr || nodes.some((n) => n.tag === 'SplitLine')
  const band = infoBand(frame, cw, ch)
  const kinds = texts.map(kindOf)
  const tspec = textSpec(texts, cw)
  const decor = decorSpec(nodes)

  // 模板 id：优先取页内回填，否则从文件名 `<id>_<名称>.json` 的第一段取（id 为 17 位字母数字）
  const base = file.replace(/^.*[\\/]/, '').replace(/\.json$/, '')
  const id = String(page.templateIdx ?? '').replace(/^.*\//, '') || (base.match(/^([A-Za-z0-9]{10,})_/)?.[1] ?? base)
  const m = metaByIndex.get(id)
  const photoArea = photo ? pct((photo.width ?? 0) * (photo.height ?? 0), cw * ch) : 0
  const photoAspect = photo ? Math.round(((photo.width ?? 1) / (photo.height ?? 1)) * 100) / 100 : 0
  const canvasRatio = ch ? Math.round((cw / ch) * 100) / 100 : 0
  const bgFill = typeof page.fill === 'string' ? page.fill : '渐变'
  const blur = page.enableBlurBg || card.enableBlurBg ? '模糊底' : '实底'

  // 范式骨架（聚类用，粗粒度）：画布档 × 排布 × 信息区方位厚度 × 文字骨架 × 分割线 × 装饰类别 × 底色
  const skeleton = [
    ratioBucket(canvasRatio),
    `${card.frameAlign ?? '?'}/${card.framePosition ?? '?'}`,
    band.key,
    kindSpec(kinds),
    split ? '分割线' : '无分割线',
    decorFlags(nodes),
    blur,
  ].join(' | ')
  // 详细指纹（明细表用，含字号档与装饰数量）
  const detail = [skeleton, tspec.key, tspec.note, decor].join(' · ')
  const has = (tag) => nodes.some((n) => n.tag === tag)

  rows.push({
    category,
    hasGroup: has('ImageGroup'),
    hasShell: nodes.some((n) => n.tag === 'CameraLogo' || n.filmFrame || n.photoFrame),
    hasImageBg: has('ImageBg'),
    hasCalendar: has('CalendarBox'),
    hasSwatch: has('Swatch') || has('SwatchLine'),
    hasPolygon: has('Polygon'),
    logoTypes: [...new Set(nodes.filter((n) => n.tag === 'Logo').map((l) => l.EXIFLogoType ?? 'custom'))],
    lines: texts.length,
    kinds,
    floating: card.frameAlign === 'float',
    index: id,
    name: m?.name ?? '',
    canvas: `${cw}×${ch}`,
    canvasRatio,
    photoArea,
    photoAspect,
    align: card.frameAlign ?? '?',
    position: card.framePosition ?? '?',
    band: band.key,
    bandNote: band.note,
    textSpec: tspec.key,
    textNote: tspec.note,
    split: Boolean(split),
    decor,
    bgFill,
    blur,
    skeleton,
    detail,
  })
}

// ===== 3. 集群（按范式骨架）=====
const clusters = new Map()
for (const r of rows) {
  const list = clusters.get(r.skeleton) ?? []
  list.push(r)
  clusters.set(r.skeleton, list)
}
const clusterList = [...clusters.entries()]
  .map(([fp, members], i) => ({ id: i + 1, fingerprint: fp, members }))
  .sort((a, b) => b.members.length - a.members.length || a.id - b.id)

// ===== 3b. 落地档位判定（按「我们引擎需要什么能力」分级）=====
// A 现有内置字段可直接重写 / B 需要既有扩展能力或自由元素手工拼装 / C 依赖素材（需自绘或降级）/ D 需架构改造
const GROUP_BY_CATEGORY = {
  白边边框: '经典',
  简约边框: '极简轻量',
  小黑框: '极简轻量',
  经典水印: '水印署名',
  无边水印: '水印署名',
  个人水印: '水印署名',
  大师水印: '大师水印',
  ColorWalk: '多彩色卡',
  多彩边框: '多彩色卡',
  色卡边框: '多彩色卡',
  胶片边框: '胶片复古',
  拍立得: '胶片复古',
  杂志边框: '杂志编辑',
  作品边框: '创意排版',
  模糊背景: '暗调影廊',
  特效边框: '创意排版',
  节日边框: '创意排版',
  旅行票根: '纸品印刷',
  相机边框: '联名卡',
  大疆: '联名卡',
  富士: '胶片复古',
  手机边框: '设备样机',
  运动边框: '运动边框',
  日历边框: '日历边框',
  作品边框: '创意排版',
  节日边框: '创意排版',
  特效边框: '创意排版',
  富士: '胶片复古',
  模糊背景: '暗调影廊',
  黑白边框: '极简轻量',
  拍立得: '胶片复古',
  旅行票根: '纸品印刷',
}

/** 语料目录名带 01_/02_ 前缀，查表前先剥掉 */
const groupOf = (category) => GROUP_BY_CATEGORY[String(category).replace(/^\d+_/, '')] ?? '待定'

function classify(r) {
  if (r.hasGroup) return { level: 'D', why: '拼图组（多照片架构，需独立立项）' }
  const needs = []
  if (r.hasShell) needs.push('相机壳/胶片框素材')
  if (r.hasImageBg) needs.push('背景图素材')
  if (r.hasCalendar) needs.push('日历格（可复用 calendar 布局）')
  if (r.kinds.includes('农历')) needs.push('农历/干支文本（自由元素暂无占位符，需小扩展或改用月历布局）')
  if (r.hasSwatch) needs.push('色卡条（palette/paletteHex 现成）')
  if (r.hasPolygon) needs.push('多边形色卡（现成 Rect/Polygon 近似）')
  if (r.logoTypes.length) needs.push(`品牌 Logo（自绘 modelMarks/brand-logos 现成：${r.logoTypes.join('/')}）`)
  if (r.lines > 4) needs.push(`${r.lines} 行文字块（自由元素拼装）`)
  if (r.floating) needs.push('浮层水印（float 九宫格对齐现成）')
  const asset = r.hasShell || r.hasImageBg
  const needsWork = r.kinds.includes('农历') || r.hasSwatch || r.hasPolygon || r.logoTypes.length || r.hasCalendar
  const level = asset ? 'C' : r.lines <= 4 && !needsWork ? 'A' : 'B'
  return { level, why: needs.length ? needs.join('；') : '纯文字/线条排版，现有字段直接可写' }
}

// ===== 4. 与现有内置模板比对（从 useTemplates.ts 提取：id/名称/分组）=====
function existingTemplates() {
  const text = readFileSync(join(REPO, 'src/composables/useTemplates.ts'), 'utf8')
  const start = text.indexOf('const BUILTIN')
  const end = text.indexOf('const LEGACY_GROUPS')
  const body = text.slice(start, end < 0 ? undefined : end)
  const out = []
  const re = /\{\s*\n\s*id: '([^']+)',\s*\n\s*(?:group: '([^']*)',\s*\n\s*)?name: '([^']+)'/g
  let m
  while ((m = re.exec(body))) out.push({ id: m[1], group: m[2] ?? '', name: m[3] })
  return out
}
const existing = existingTemplates()

// ===== 6. 输出报告 =====
for (const r of rows) r.judged = classify(r)
const byLevel = { A: [], B: [], C: [], D: [] }
for (const r of rows) byLevel[r.judged.level].push(r)
const byCat = new Map()
for (const r of rows) byCat.set(r.category, (byCat.get(r.category) ?? 0) + 1)
const capTally = new Map()
for (const r of rows) {
  const caps = r.judged.why.split('；')
  for (const c of caps) if (c && r.judged.level !== 'D') capTally.set(c, (capTally.get(c) ?? 0) + 1)
}

const lines = []
const esc = (s) => String(s).replace(/\|/g, '/')
lines.push('# FrameElf 语料范式清单与落地排期（自动生成）')
lines.push('')
lines.push(`> 生成时间：${new Date().toISOString().slice(0, 10)}；语料：\`${SRC_DIR}\``)
lines.push('> 工具：`scripts/scan-frameelf-paradigms.mjs`（只读扫描，仅统计结构与比例）')
lines.push('>')
lines.push('> **合规说明**：本清单只记录版式骨架与几何比例，不含竞品素材、字体文件、示例文案与预览图；')
lines.push('> 落地时一律用 FrameLab 自有引擎参数、自有命名与文案、自绘素材重写（见 AGENTS.md 合规边界）。')
lines.push('')
lines.push('## 一、语料概览')
lines.push('')
lines.push(`- 模板总数：**${rows.length}** 套，分布在 **${byCat.size}** 个分类`)
lines.push(`- 设计重复度：**${clusterList.length}** 个骨架簇 → 语料基本是「一模板一设计」，不存在可批量合并的大簇`)
lines.push(`- 现有内置模板：**${existing.length}** 套（` + '`useTemplates.ts` 的 BUILTIN，另有 5 套 rc_ 晋升款）')
lines.push('- 落地档位定义：**A** 现有内置字段可直接重写 / **B** 用既有扩展能力或自由元素手工拼装 / **C** 依赖素材（需自绘或降级）/ **D** 需架构改造（暂缓）')
lines.push('')
lines.push('| 分类 | 套数 |')
lines.push('|---|---|')
for (const [c, n] of [...byCat.entries()].sort((a, b) => b[1] - a[1])) lines.push(`| ${c} | ${n} |`)
lines.push('')
lines.push('## 二、落地档位统计')
lines.push('')
lines.push('| 档位 | 套数 | 说明 |')
lines.push('|---|---|---|')
lines.push(`| A 可直接重写 | **${byLevel.A.length}** | 纯文字/线条排版，bgMode / padding / borderRatio / infoLayout / overlayAlign 等现有字段即可 |`)
lines.push(`| B 需拼装/近似 | **${byLevel.B.length}** | 色卡、Logo、5~8 行文字块、浮动水印等，需用既有扩展能力或自由元素手工排 |`)
lines.push(`| C 依赖素材 | **${byLevel.C.length}** | 相机壳/胶片框/背景图等素材，需自绘，或降级为无素材版本后按 A/B 做 |`)
lines.push(`| D 暂缓 | **${byLevel.D.length}** | 拼图（多照片架构，独立立项） |`)
lines.push('')
lines.push('**能力需求频次**（C/D 组除外）')
lines.push('')
lines.push('| 需要的能力 | 涉及套数 |')
lines.push('|---|---|')
for (const [c, n] of [...capTally.entries()].sort((a, b) => b[1] - a[1])) lines.push(`| ${esc(c)} | ${n} |`)
lines.push('')
lines.push('## 三、逐套明细与落地判定')
lines.push('')
lines.push('| 档位 | 分类 | id | 画布 | 照片占比 | 信息区 | 文字骨架 | 装饰层 | 需要的能力 | 建议分组 |')
lines.push('|---|---|---|---|---|---|---|---|---|---|')
const sorted = [...rows].sort(
  (a, b) => a.judged.level.localeCompare(b.judged.level) || a.category.localeCompare(b.category) || a.index.localeCompare(b.index),
)
for (const r of sorted) {
  lines.push(
    `| ${r.judged.level} | ${r.category} | ${r.index} | ${r.canvas} | ${r.photoArea}% | ${esc(r.band)} | ${esc(r.textSpec)} | ${esc(r.decor)} | ${esc(r.judged.why)} | ${groupOf(r.category)} |`,
  )
}
lines.push('')
lines.push('## 四、建议批次')
lines.push('')
lines.push('**第 1 批（A 档，现有能力直接落地）**：')
lines.push('')
lines.push('| # | 分类 | id | 画布 | 信息区 | 文字骨架 | 建议分组 |')
lines.push('|---|---|---|---|---|---|---|')
byLevel.A.slice(0, 15).forEach((r, i) =>
  lines.push(`| ${i + 1} | ${r.category} | ${r.index} | ${r.canvas} | ${esc(r.band)} | ${esc(r.textSpec)} | ${groupOf(r.category)} |`),
)
lines.push('')
lines.push(`> A 档共 ${byLevel.A.length} 套，可按分类分批推进；B 档 ${byLevel.B.length} 套需先定「自由元素拼装」的统一范式；C 档 ${byLevel.C.length} 套待素材方案（自绘相机壳 or 降级）。`)
lines.push('')
lines.push('## 五、样张照片匹配方案（用你的照片取代竞品样张）')
lines.push('')
lines.push('- **照片池**：`C:\\Users\\Administrator\\Desktop\\模版照片`（79 张，与 `src/assets/gallery/` 同源）。')
lines.push('- **占用情况**：`$MAP` 有 79 条历史映射，当前 47 套内置模板占用 47 张，约 32 张未被占用——新模板优先选未占用的照片。')
lines.push('- **匹配规则**（沿用既有原则）：画幅方向优先（方幅→1:1 照片 / 竖幅→竖构图 / 横幅→横构图），其次版式气质（高调白框配浅调、暗调款配夜景、胶片款配胶片感人像、色卡款配色彩浓烈、纸质模板配静物特写）。')
lines.push('- **落库**：在 `scripts/gen-template-samples.ps1` 的 `$MAP` 追加 `<模板id> = \'<照片文件名特征串>\'`，跑一次脚本生成 `src/assets/template-samples/<id>.jpg`（长边 1000 / q80）。')
lines.push('- **守护**：`src/core/templateSamples.test.ts` 要求「每个内置模板都有样张」，缺图即测试失败——所以新模板必须与样张同批提交。')
lines.push('- **先看效果**：`npm run gallery` 打开 `template-gallery.html`，同一模板可换多张照片对比后再回填 `$MAP`。')
lines.push('')
lines.push('## 六、下一步')
lines.push('')
lines.push('1. 从第 1 批里确认**具体哪几套**要落地（逐套给自有命名/desc/参数）；')
lines.push('2. 在 `src/composables/useTemplates.ts` 的 `BUILTIN` 里追加（自有 id/参数，不复制竞品几何数值）；')
lines.push('3. 每套配一张用户照片作样张（`scripts/gen-template-samples.ps1` 的 `$MAP`）→ 生成 `src/assets/template-samples/<id>.jpg`；')
lines.push('4. 跑测试 + 画廊核验 + 桌面端逐组目视。')
writeFileSync(OUT_MD, lines.join('\n') + '\n', 'utf8')

console.log(`模板 ${rows.length} 套；骨架簇 ${clusterList.length} 个；现有内置 ${existing.length} 套`)
console.log(`档位：A=${byLevel.A.length} B=${byLevel.B.length} C=${byLevel.C.length} D=${byLevel.D.length}`)
console.log('报告：' + OUT_MD)
console.log('能力需求 TOP：')
for (const [c, n] of [...capTally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log(`  ${String(n).padStart(3)} 套  ${c}`)
