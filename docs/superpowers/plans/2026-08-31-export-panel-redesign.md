# 导出界面精装改造实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按方案 A 精装导出界面：视觉强化 + 输出预估 + 页内进度/汇总/取消 + 预览弹窗增强（分辨率/体积/1:1 查看/打开所在文件夹）。

**Architecture:** 从 `exportFrame` 提取画布尺寸计算为纯函数 `computeExportMetrics`（导出与预估同源）；文本映射规则提取为 `core/textRules.ts`；ExportPanel 单文件改造（分组头卡片 + 吸底任务卡 + 页内进度 + 预览增强）；Tauri 新增 `reveal_path` command 定位导出文件。完成后按双端约定同步 src/ 到 `d:\A\frame`。

**Tech Stack:** Vue 3 `<script setup>` + TS、原生 Canvas、Vitest、Tauri 2（Rust command）。

**Spec:** `docs/superpowers/specs/2026-08-31-export-panel-redesign-design.md`

**关键事实（执行者必读）：**
- `DESIGN_CONTAINER = 1200` 在 `src/core/constants.ts:215`；`rotatedSize` 在 `src/core/photoEdit.ts:9`；`MAX_DIM = 16384` 是 exporter.ts 模块私有常量
- `useAppState` 暴露 `startTask/setTaskLabel/setTaskProgress/endTask`（src/composables/useAppState.ts）
- `RangeSlider` props：`modelValue/min/max/step/label/disabled`；`Icon` props：`name`（内置 photo/background/border/info/brand/model 等）
- git 提交需带身份：`git -c user.name=yuhaowang774 -c user.email=yuhaowang774@users.noreply.github.com commit ...`
- 验证命令：`npm run build`（vue-tsc -b && vite build）、`npm run test`（vitest run）；项目根 `d:\A\FrameLab`

---

### Task 1: 提取导出尺寸纯函数 computeExportMetrics / estimateExportSize（TDD）

**Files:**
- Modify: `d:\A\FrameLab\src\core\exporter.ts`（exportFrame 内 276-330 行尺寸计算段）
- Create: `d:\A\FrameLab\src\core\exportMetrics.test.ts`

- [ ] **Step 1: 写失败测试**

创建 `src/core/exportMetrics.test.ts`：

```ts
// computeExportMetrics 与 exportFrame 公式同源性测试：
// 断言关键场景的画布尺寸（公式基准：DESIGN_CONTAINER=1200）
import { describe, it, expect } from 'vitest'
import { estimateExportSize } from './exporter'
import { defaultFrameConfig } from './types'

describe('estimateExportSize', () => {
  it('自由模式（无 frameRatio）：画布宽 = (1200 + 2*pad) * unitScale，unitScale = 源宽/照片设计宽', () => {
    // 3000×2000 源图，默认 scale=100，photoCrop 全幅 → photoDesignW=1200
    // unitScale = 3000/1200 = 2.5；canvasW = (1200 + 2*0 + 2*pad)*2.5
    const cfg = { ...defaultFrameConfig, frameRatio: null, padding: 40, borderRatio: 0, bgExpand: 0 }
    const r = estimateExportSize(3000, 2000, cfg, 1)
    expect(r.w).toBe(Math.round((1200 + 80) * 2.5))
    // 高度 = photoDesignH + pad(上) + pad+borderRatio(下)；photoDesignH = 1200/(3000/2000)=800
    expect(r.h).toBe(Math.round((800 + 40 + 40) * 2.5))
  })

  it('frameRatio 模式：照片 contain 适配固定比例内容区', () => {
    // frameRatio = 1.5 → contentH = 1200/1.5 = 800，contentAspect = 1.5
    // 源 3:2（aspect=1.5）→ photoBaseW = 1200；scale=50 → photoDesignW=600
    // unitScale = (3000*1)/(600) = 5
    const cfg = { ...defaultFrameConfig, frameRatio: 1.5, scale: 50, padding: 0, borderRatio: 0, bgExpand: 0 }
    const r = estimateExportSize(3000, 2000, cfg, 1)
    expect(r.w).toBe(1200 * 5)
    expect(r.h).toBe(Math.round((800 + 0 + 0) * 5))
  })

  it('超采样与 bgExpand/bgBottomRatio 同步放大', () => {
    const cfg = { ...defaultFrameConfig, frameRatio: null, padding: 20, bgExpand: 30, bgBottomRatio: 10 }
    const r1 = estimateExportSize(1200, 800, cfg, 1)
    const r2 = estimateExportSize(1200, 800, cfg, 2)
    expect(r2.w).toBe(r1.w * 2)
    expect(r2.h).toBe(r1.h * 2)
  })

  it('scale=0 等非法输入按 1 处理不抛错', () => {
    const cfg = { ...defaultFrameConfig }
    expect(() => estimateExportSize(100, 100, cfg, 0)).not.toThrow()
  })
})
```

注意：`defaultFrameConfig` 的实际字段名以 `src/core/types.ts` 为准（`frameRatio` 可为 `null`、`photoCrop`、`photoRotation`、`scale`、`padding`、`borderRatio`、`bgExpand`、`bgBottomRatio`、`canvasH`）。若字段名不同，以 types.ts 为准修正测试。

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/core/exportMetrics.test.ts`
Expected: FAIL（`estimateExportSize` 未导出）

- [ ] **Step 3: 实现 computeExportMetrics + estimateExportSize**

在 `src/core/exporter.ts` 顶部 import 区补充：

```ts
import { DESIGN_CONTAINER } from './constants'
import { rotatedSize } from './photoEdit'
```

（若已有等价 import 则复用；`rotatedSize`/`Rotation` 原本可能已从 photoEdit import。）

在 `exportFrame` 函数之前插入：

```ts
// ===== 导出画布度量（纯计算，无 DOM）：导出与任务卡预估共用同一公式 =====
export interface ExportMetrics {
  canvasW: number
  canvasH: number
  unitScale: number
  photoW: number
  photoH: number
  displayW: number
  displayH: number
  photoDesignW: number
  photoDesignH: number
  designContentH: number
  availW: number
  bgExpand: number
  bgBottomExpand: number
  effectivePad: number
  effectivePadBottom: number
}

/** 依据源图尺寸与配置计算导出画布全部度量（exportFrame 内部与预估同源） */
export function computeExportMetrics(
  srcW: number,
  srcH: number,
  config: FrameConfig,
  supersample: number,
): ExportMetrics {
  const ss = supersample > 0 ? supersample : 1
  const effectivePad = config.padding
  const effectivePadBottom = config.padding + config.borderRatio
  const availW = DESIGN_CONTAINER
  const bgExpand = config.bgExpand || 0
  const bgBottomExpand = bgExpand + (config.bgBottomRatio || 0)

  // 旋转+裁剪后的"显示像素"尺寸（最终照片真实像素）
  const rSize = rotatedSize(srcW, srcH, config.photoRotation)
  const displayW = Math.max(1, rSize.w * config.photoCrop.w)
  const displayH = Math.max(1, rSize.h * config.photoCrop.h)
  const displayAspect = displayW / displayH

  // 画面（边框）比例：内容区宽高比。null = 自由（跟随照片）
  const frameRatio = config.frameRatio
  let designContentH = 0
  let photoBaseW = DESIGN_CONTAINER
  if (frameRatio) {
    designContentH = DESIGN_CONTAINER / frameRatio
    const contentAspect = DESIGN_CONTAINER / designContentH
    photoBaseW = displayAspect >= contentAspect ? DESIGN_CONTAINER : designContentH * displayAspect
  }

  const photoDesignW = Math.max(1, photoBaseW * (config.scale / 100))
  const photoDesignH = photoDesignW / displayAspect
  if (!frameRatio) designContentH = photoDesignH

  // unitScale：把设计坐标（1200 宽）映射到像素；照片以原生裁剪像素 1:1 进入
  const unitScale = (displayW / photoDesignW) * ss
  const canvasW = Math.round((DESIGN_CONTAINER + 2 * bgExpand + 2 * effectivePad) * unitScale)
  const designCanvasH =
    (config.canvasH || designContentH + effectivePad + effectivePadBottom) + bgExpand + bgBottomExpand
  const canvasH = Math.round(designCanvasH * unitScale)
  const photoW = Math.round(displayW * ss)
  const photoH = Math.round(displayH * ss)
  return {
    canvasW, canvasH, unitScale, photoW, photoH,
    displayW, displayH, photoDesignW, photoDesignH, designContentH,
    availW, bgExpand, bgBottomExpand, effectivePad, effectivePadBottom,
  }
}

/** 任务卡预估：只关心输出像素尺寸 */
export function estimateExportSize(
  srcW: number,
  srcH: number,
  config: FrameConfig,
  supersample: number,
): { w: number; h: number } {
  const m = computeExportMetrics(srcW, srcH, config, supersample)
  return { w: m.canvasW, h: m.canvasH }
}
```

- [ ] **Step 4: 改造 exportFrame 使用 metrics（删除重复公式）**

在 `exportFrame` 内，将原「源图尺寸检查」至「canvasH / photoW / photoH 计算」的整段（原 276-330 行：`const { w: sw, h: sh } = sourceSize(source)` 起到 `const photoH = Math.round(displayH * supersample)` 止，**保留**其中 `photoContentX/photoContentY` 两段计算，改用 metrics 字段）替换为：

```ts
  const { w: sw, h: sh } = sourceSize(source)
  if (!sw || !sh) throw new Error('源图尺寸无效，无法导出')

  // 以原生分辨率排版（度量计算已提取为 computeExportMetrics，与任务卡预估同源）
  const M = computeExportMetrics(sw, sh, config, supersample)
  const { canvasW, canvasH, unitScale, photoW, photoH } = M
  const { displayW, displayH, photoDesignW, photoDesignH, designContentH, availW,
          bgExpand, bgBottomExpand, effectivePad, effectivePadBottom } = M

  // 照片在内容区左上角坐标（null 时水平居中；自由模式垂直贴顶、比例模式垂直居中）
  const photoContentX = config.photoX != null ? config.photoX : (availW - photoDesignW) / 2
  const photoContentY = config.photoY != null
    ? config.photoY
    : config.frameRatio
      ? (designContentH - photoDesignH) / 2
      : 0
```

同时删除原段中重复的局部声明（`effectivePad/effectivePadBottom/effectiveScale/availW/bgExpand/bgBottomExpand/rSize/displayW/displayH/displayAspect/frameRatio/designContentH/photoBaseW/photoDesignW/photoDesignH/unitScale/canvasW/designCanvasH/canvasH/photoW/photoH`），保留 332 行起的 `MAX_DIM` 检查与后续绘制逻辑不变（`effectiveScale` 仅在原 `photoDesignW` 计算中用到，可随段删除）。若后续绘制代码还引用了被删的其他局部名，以 `M.` 字段补齐。

- [ ] **Step 5: 运行测试与类型检查**

Run: `npx vitest run src/core/exportMetrics.test.ts` → Expected: PASS
Run: `npx vue-tsc -b` → Expected: 0 error

- [ ] **Step 6: Commit**

```bash
git add src/core/exporter.ts src/core/exportMetrics.test.ts
git -c user.name=yuhaowang774 -c user.email=yuhaowang774@users.noreply.github.com commit -m "refactor: 提取导出画布度量纯函数 computeExportMetrics，导出与预估同源"
```

---

### Task 2: 文本映射规则提取为 core/textRules.ts（TDD）

**Files:**
- Create: `d:\A\FrameLab\src\core\textRules.ts`
- Create: `d:\A\FrameLab\src\core\textRules.test.ts`
- Modify: `d:\A\FrameLab\src\components\layout\ExportPanel.vue`（删除内联 parseRules/applyRules，改 import）

- [ ] **Step 1: 写失败测试** `src/core/textRules.test.ts`

```ts
// 批量文本映射规则解析与应用
import { describe, it, expect } from 'vitest'
import { parseRules, makeRuleApplier } from './textRules'

describe('parseRules', () => {
  it('解析「查找 => 替换」行', () => {
    expect(parseRules('a => b\nc => d')).toEqual([['a', 'b'], ['c', 'd']])
  })
  it('空行与缺替换值行跳过', () => {
    expect(parseRules('\na => b\n仅查找\n  ')).toEqual([['a', 'b']])
  })
  it('替换值中可含 =>（仅首个作为分隔）', () => {
    expect(parseRules('x => y => z')).toEqual([['x', 'y => z']])
  })
  it('trim 查找与替换两端空白', () => {
    expect(parseRules('  a  =>   b ')).toEqual([['a', 'b']])
  })
})

describe('makeRuleApplier', () => {
  it('启用时链式替换全部出现', () => {
    const apply = makeRuleApplier('R1 => R2\nR2 => R3', true)
    expect(apply('R1 R1 R2')).toBe('R2 R2 R3')
  })
  it('未启用时原样返回', () => {
    expect(makeRuleApplier('a => b', false)('a')).toBe('a')
  })
  it('空字符串原样返回', () => {
    expect(makeRuleApplier('a => b', true)('')).toBe('')
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `npx vitest run src/core/textRules.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 实现** `src/core/textRules.ts`

```ts
// 批量导出文本映射：每行「查找 => 替换」；仅作用于批量回填路径
export function parseRules(src: string): [string, string][] {
  return src
    .split('\n')
    .map((line) => line.split('=>'))
    .filter((p): p is [string, ...string[]] => p.length >= 2 && !!p[0].trim())
    .map((p) => [p[0].trim(), p.slice(1).join('=>').trim()])
}

/** 生成按规则表链式替换的函数（未启用映射时原样返回） */
export function makeRuleApplier(rulesText: string, enabled: boolean): (s: string) => string {
  return (s: string): string => {
    if (!enabled || !s) return s
    let out = s
    for (const [from, to] of parseRules(rulesText)) out = out.split(from).join(to)
    return out
  }
}
```

- [ ] **Step 4: ExportPanel 改用共享模块**

`ExportPanel.vue` script 中：删除内联 `parseRules` 与 `applyRules` 两个函数，顶部加：

```ts
import { makeRuleApplier } from '../../core/textRules'
```

`configFor` 内原 `applyRules(...)` 调用改为：

```ts
  const apply = makeRuleApplier(rulesText.value, rulesEnabled.value)
  const text = apply(
    exif && state.eqFocal
      ? buildExifText(exif.raw, { eqFocal: state.eqFocal, cropFactor: state.cropFactor })
      : (exif?.text ?? ''),
  )
  const dateText = exif?.raw.dateTimeOriginal ? formatDate(exif.raw.dateTimeOriginal, state.dateFormat) : ''
  return {
    ...state,
    exifText: text,
    dateText,
    cameraModel: apply(exif?.model ?? ''),
    lensText: apply(exif?.lens ?? ''),
    exifRaw: exif?.raw ?? null,
    brand: exif?.brandId ?? state.brand,
  }
```

- [ ] **Step 5: 运行测试与类型检查**

Run: `npx vitest run src/core/textRules.test.ts` → PASS
Run: `npx vue-tsc -b` → 0 error

- [ ] **Step 6: Commit**

```bash
git add src/core/textRules.ts src/core/textRules.test.ts src/components/layout/ExportPanel.vue
git -c user.name=yuhaowang774 -c user.email=yuhaowang774@users.noreply.github.com commit -m "refactor: 文本映射规则提取为 core/textRules 并补单测"
```

---

### Task 3: Tauri reveal_path command + fs.ts 包装（saveBlobAs 返回保存路径）

**Files:**
- Modify: `d:\A\FrameLab\src-tauri\src\lib.rs`（新 command + 注册）
- Modify: `d:\A\FrameLab\src\platform\fs.ts`（saveBlobAs 返回 `string | null`；新增 `revealInExplorer`）

- [ ] **Step 1: lib.rs 新增 command（放在 `open_graphics_settings` 之后）**

```rust
/// 在资源管理器中定位文件（explorer /select）。仅 Windows；失败返回错误串。
#[tauri::command]
fn reveal_path(path: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        let p = std::path::PathBuf::from(path.replace('/', "\\"));
        if !p.exists() {
            return Err(format!("路径不存在: {}", p.display()));
        }
        // canonicalize 会带 \\?\ 前缀，explorer 不识别，需剥掉
        let full = match std::fs::canonicalize(&p) {
            Ok(c) => {
                let s = c.to_string_lossy().into_owned();
                s.strip_prefix("\\\\?\\").map(|x| x.to_string()).unwrap_or(s)
            }
            Err(_) => p.to_string_lossy().into_owned(),
        };
        std::process::Command::new("explorer")
            .raw_arg(format!("\"/select,{}\"", full))
            .spawn()
            .map_err(|e| e.to_string())?;
        return Ok(());
    }
    #[cfg(not(target_os = "windows"))]
    {
        let _ = path;
        Err("reveal_path 仅支持 Windows".to_string())
    }
}
```

并在 `invoke_handler(tauri::generate_handler![...])` 列表中加入 `reveal_path,`。

- [ ] **Step 2: Rust 编译检查**

Run: `cargo check`（cwd = `d:\A\FrameLab\src-tauri`）
Expected: Finished / 无 error

- [ ] **Step 3: fs.ts 修改**

`saveBlobAs` 签名与实现改为（返回保存路径，网页端返回 null）：

```ts
/**
 * 保存合成结果：
 * - 桌面端：弹出系统保存对话框，经 Rust 写入所选路径；取消返回 null。
 * - 网页端：触发浏览器下载，返回 null。
 * 返回值：桌面端成功保存的绝对路径（供「打开所在文件夹」定位）；其余 null。
 */
export async function saveBlobAs(blob: Blob, filename: string): Promise<string | null> {
  if (!isTauri) {
    downloadBlob(blob, filename)
    return null
  }
  const path = await tauriInvoke<string | null>('save_file_dialog', { defaultName: filename })
  if (!path) return null
  const b64 = await blobToBase64(blob)
  await tauriInvoke('write_file_base64', { path, base64Data: b64 })
  return path
}

/** 桌面端：在资源管理器中定位文件（仅 Windows；网页端不应调用） */
export async function revealInExplorer(path: string): Promise<void> {
  await tauriInvoke('reveal_path', { path })
}
```

- [ ] **Step 4: 类型检查**

Run: `npx vue-tsc -b` → 0 error（`saveBlobAs` 当前唯一调用方是 ExportPanel，Task 4 将适配返回值）

- [ ] **Step 5: Commit**

```bash
git add src-tauri/src/lib.rs src/platform/fs.ts
git -c user.name=yuhaowang774 -c user.email=yuhaowang774@users.noreply.github.com commit -m "feat: 新增 reveal_path 定位导出文件；saveBlobAs 返回保存路径"
```

---

### Task 4: ExportPanel script 逻辑扩展（预估 / 页内进度与取消 / 预览增强）

**Files:**
- Modify: `d:\A\FrameLab\src\components\layout\ExportPanel.vue`（仅 script 区）

- [ ] **Step 1: 新增 import 与工具**

script 顶部 import 区补充：

```ts
import Icon from '../common/Icon.vue'
import RangeSlider from '../common/RangeSlider.vue'
import { estimateExportSize } from '../../core/exporter'
```

- [ ] **Step 2: 源图尺寸懒加载缓存 + 预估 computed**

在 `selectedCount` 定义之前插入：

```ts
// ===== 输出预估：当前照片尺寸懒加载缓存 + 任务卡实时估算 =====
const sizeCache = new Map<string, { w: number; h: number }>()
const activeItem = computed(() => library.items.find((i) => i.id === library.activeId.value) ?? null)
const activeSize = ref<{ w: number; h: number } | null>(null)

watch(activeItem, async (item) => {
  activeSize.value = null
  if (!item) return
  const hit = sizeCache.get(item.id)
  if (hit) {
    activeSize.value = hit
    return
  }
  try {
    const im = await loadImage(item.url)
    const s = { w: im.naturalWidth, h: im.naturalHeight }
    sizeCache.set(item.id, s)
    // 异步竞态保护：仅当仍是当前照片时更新
    if (library.activeId.value === item.id) activeSize.value = s
  } catch {
    /* 尺寸读取失败：预估显示 —，不阻塞导出 */
  }
}, { immediate: true })

/** JPG 体积粗估（B/px 经验系数随画质线性），PNG 不估 */
const estimate = computed(() => {
  if (!activeSize.value) return null
  const { w, h } = estimateExportSize(activeSize.value.w, activeSize.value.h, state, supersample.value)
  let sizeText = ''
  if (format.value === 'jpg') {
    const bytes = w * h * (0.08 + jpgQuality.value * 0.24)
    sizeText = bytes >= 1024 * 1024 ? `≈ ${(bytes / 1024 / 1024).toFixed(1)} MB` : `≈ ${Math.round(bytes / 1024)} KB`
  }
  return { w, h, sizeText }
})
```

注意：`loadImage` 函数已存在于本组件（复用）。

- [ ] **Step 3: 批量进度状态与取消（改造 exportBatch）**

在 `exportBatch` 之前插入状态：

```ts
// ===== 页内批量进度（导出任务卡展示；顶部全局任务条保留不动） =====
const batch = ref({
  running: false,
  done: 0,
  total: 0,
  label: '',
  finished: false,
  cancelled: false,
  success: 0,
  failed: [] as { name: string; reason: string }[],
})
function cancelBatch() {
  if (batch.value.running) batch.value.cancelled = true
}
function resetBatch() {
  batch.value = { running: false, done: 0, total: 0, label: '', finished: false, cancelled: false, success: 0, failed: [] }
}
```

`exportBatch` 整体替换为：

```ts
async function exportBatch() {
  const list = selectedCount.value > 0 ? library.items.filter((i) => i.selected) : library.items
  if (!list.length || batch.value.running) return
  // 桌面端：先选导出目录；取消则中止。网页端：逐张触发浏览器下载。
  let folder: string | null = null
  if (isTauri) {
    const { pickExportFolder } = await import('../../platform/fs')
    folder = await pickExportFolder()
    if (!folder) return
  }
  resetBatch()
  batch.value = { running: true, done: 0, total: list.length, label: '', finished: false, cancelled: false, success: 0, failed: [] }
  app.startTask('批量导出')
  let last: { blob: Blob; name: string } | null = null
  try {
    for (let i = 0; i < list.length; i++) {
      if (batch.value.cancelled) break
      const item = list[i]
      batch.value.label = `${item.name}`
      const blob = await renderOne(item, backfillExif.value)
      const name = makeExportFilename(format.value, item.name.replace(/\.[^.]+$/, ''))
      if (folder) {
        const { writeBlobTo } = await import('../../platform/fs')
        await writeBlobTo(folder, name, blob)
      } else {
        downloadBlob(blob, name)
      }
      last = { blob, name }
      batch.value.done = i + 1
      batch.value.success++
      app.setTaskProgress((i + 1) / list.length)
      await new Promise((r) => setTimeout(r, 30))
    }
    batch.value.finished = true
  } catch (e) {
    batch.value.failed.push({ name: batch.value.label, reason: (e as Error).message })
    batch.value.finished = true
  } finally {
    batch.value.running = false
    // 批量导出也弹预览（最后一张成功图）
    if (last && !batch.value.cancelled) showPreview(last.blob, last.name)
    setTimeout(() => app.endTask(), 400)
  }
}
```

- [ ] **Step 4: 预览增强状态（改造 preview 与单张导出/保存）**

替换原 `preview` 相关定义为：

```ts
// ===== 导出预览（分辨率/体积实测 + 1:1 查看 + 保存定位） =====
const preview = ref<{
  url: string
  name: string
  blob: Blob
  w: number
  h: number
  sizeText: string
} | null>(null)
const zoom1x = ref(false)
const saved = ref(false)
const savedPath = ref<string | null>(null)

function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / 1024 / 1024).toFixed(1)} MB`
  if (n >= 1024) return `${Math.round(n / 1024)} KB`
  return `${n} B`
}

/** 展示导出结果：blob 实测分辨率（预览图即成品，实测最准） */
async function showPreview(blob: Blob, name: string) {
  if (preview.value) URL.revokeObjectURL(preview.value.url)
  const url = URL.createObjectURL(blob)
  let w = 0
  let h = 0
  try {
    const im = await loadImage(url)
    w = im.naturalWidth
    h = im.naturalHeight
  } catch {
    /* 实测失败显示 — */
  }
  preview.value = { url, name, blob, w, h, sizeText: formatBytes(blob.size) }
  zoom1x.value = false
  saved.value = false
  savedPath.value = null
}

function closePreview() {
  if (preview.value) URL.revokeObjectURL(preview.value.url)
  preview.value = null
}
```

`exportSingle` 内原预览两行替换：

```ts
    const name = makeExportFilename(format.value, active.name.replace(/\.[^.]+$/, ''))
    await showPreview(blob, name)
```

`savePreview` / 新增 `openSavedFolder` 替换与追加：

```ts
async function savePreview() {
  if (!preview.value) return
  const { blob, name } = preview.value
  try {
    if (isTauri) {
      const { saveBlobAs } = await import('../../platform/fs')
      savedPath.value = await saveBlobAs(blob, name)
    } else {
      downloadBlob(blob, name)
      savedPath.value = null
    }
    saved.value = true
  } catch (e) {
    window.alert('保存失败：' + (e as Error).message)
  }
}

async function openSavedFolder() {
  if (!savedPath.value) return
  try {
    const { revealInExplorer } = await import('../../platform/fs')
    await revealInExplorer(savedPath.value)
  } catch (e) {
    window.alert('打开文件夹失败：' + (e as Error).message)
  }
}
```

- [ ] **Step 5: 类型检查**

Run: `npx vue-tsc -b`
Expected: 模板尚未使用新状态时 0 error（若报未使用变量，属预期——Task 5 模板接上后消除；可暂以 `void estimate` 规避 noUnusedLocals，Task 5 删除）

- [ ] **Step 6: Commit（逻辑就绪，UI 待接）**

```bash
git add src/components/layout/ExportPanel.vue
git -c user.name=yuhaowang774 -c user.email=yuhaowang774@users.noreply.github.com commit -m "feat: 导出页预估/页内进度取消/预览增强 script 逻辑"
```

---

### Task 5: ExportPanel 模板与样式重构（分组头 / 网格缩略图 / 吸底任务卡 / 预览增强）

**Files:**
- Modify: `d:\A\FrameLab\src\components\layout\ExportPanel.vue`（template + style 区整体替换）

- [ ] **Step 1: template 区整体替换**

```html
<template>
  <div class="export-view">
    <header class="page-head">
      <h2 class="title">导出</h2>
      <p class="sub">配置成品输出参数，支持单张 / 批量导出。所有处理在本地完成。</p>
    </header>

    <div class="cards">
      <!-- 输出设置 -->
      <section class="card">
        <div class="group-head">
          <Icon name="photo" />
          <h3>输出设置</h3>
          <span class="head-hint">格式 · 画质 · 尺寸</span>
        </div>
        <div class="row">
          <label>格式</label>
          <div class="seg">
            <button :class="{ on: format === 'png' }" @click="format = 'png'">PNG 无损</button>
            <button :class="{ on: format === 'jpg' }" @click="format = 'jpg'">JPG 高画质</button>
          </div>
        </div>
        <div v-if="format === 'jpg'" class="row">
          <label>画质</label>
          <RangeSlider v-model="jpgQuality" :min="0.5" :max="1" :step="0.01" />
        </div>
        <div class="row">
          <label>超采样</label>
          <div class="seg">
            <button :class="{ on: supersample === 1 }" @click="supersample = 1">1x</button>
            <button :class="{ on: supersample === 2 }" @click="supersample = 2">2x</button>
            <button :class="{ on: supersample === 3 }" @click="supersample = 3">3x</button>
          </div>
        </div>
        <div class="divider" />
        <div class="row">
          <label>批量回填</label>
          <label class="check" title="开启后批量导出的每张照片使用各自导入时解析的 EXIF、相机型号与品牌 Logo">
            <input type="checkbox" v-model="backfillExif" />
            <span>每张照片使用自身 EXIF / 型号 / 品牌</span>
          </label>
        </div>
        <div class="row">
          <label>文本映射</label>
          <label class="check" title="批量导出时按规则替换各照片的 EXIF 文本 / 相机型号 / 镜头型号（仅影响批量回填）">
            <input type="checkbox" v-model="rulesEnabled" />
            <span>启用批量文本映射</span>
          </label>
        </div>
        <div v-if="rulesEnabled" class="row">
          <textarea
            v-model="rulesText"
            class="rules-area"
            rows="3"
            spellcheck="false"
            placeholder="每行一条：查找 => 替换&#10;如 腾龙28-200 E A071 => 腾龙 28-200"
          ></textarea>
        </div>
      </section>

      <!-- 批量同步（次级） -->
      <section class="card secondary">
        <div class="group-head">
          <Icon name="border" />
          <h3>批量同步</h3>
          <span class="head-hint">保存当前配置为模板</span>
        </div>
        <p class="hint">把当前相框/背景配置保存为模板，在左侧模板库一键应用到各照片。</p>
        <div class="row">
          <input v-model="syncName" class="inp" placeholder="模板名称" />
          <button class="btn" @click="syncToSelected">保存为模板</button>
        </div>
      </section>
    </div>

    <!-- 照片选择（网格） -->
    <section class="card select">
      <div class="group-head">
        <Icon name="photo" />
        <h3>选择要导出的照片</h3>
        <span class="count">已选 {{ selectedCount }} / {{ library.items.length }} 张</span>
      </div>
      <div class="row tools">
        <button class="btn" :disabled="!library.items.length" @click="library.selectAll()">全选</button>
        <button class="btn" :disabled="!selectedCount" @click="library.selectNone()">取消全选</button>
        <span class="hint-inline">点击选择 · Ctrl/⌘+点击切换 · Shift+点击范围多选</span>
      </div>
      <div v-if="library.items.length === 0" class="hint">图库暂无照片，请先在图库模块导入。</div>
      <div v-else class="thumb-grid">
        <div
          v-for="item in library.items"
          :key="item.id"
          class="thumb"
          :class="{ selected: item.selected, active: item.id === library.activeId.value }"
          :title="`${item.name}${item.selected ? '（已选中）' : ''}`"
          @click="onThumbClick(item, $event)"
        >
          <img :src="item.thumbUrl || item.url" :alt="item.name" loading="lazy" />
          <span class="thumb-name">{{ item.name }}</span>
          <span v-if="item.selected" class="thumb-check">✓</span>
        </div>
      </div>
    </section>

    <!-- 吸底任务卡 -->
    <section class="card taskbar">
      <div class="estimate" v-if="estimate">
        <span class="est-title">输出</span>
        <span class="est-val">≈ {{ estimate.w }} × {{ estimate.h }} px</span>
        <span v-if="estimate.sizeText" class="est-val">{{ estimate.sizeText }}</span>
      </div>
      <div class="estimate" v-else>
        <span class="est-title">输出</span>
        <span class="est-val">—</span>
      </div>

      <div class="progress-zone">
        <template v-if="batch.running">
          <div class="prog-line">
            <div class="prog-track"><div class="prog-fill" :style="{ width: (batch.total ? batch.done / batch.total * 100 : 0) + '%' }" /></div>
            <span class="prog-text">{{ batch.done }}/{{ batch.total }} · {{ batch.label }}</span>
            <button class="btn danger" @click="cancelBatch">取消</button>
          </div>
        </template>
        <template v-else-if="batch.finished">
          <div class="summary">
            <span class="sum-ok">✓ 成功 {{ batch.success }}</span>
            <span v-if="batch.failed.length" class="sum-bad">· 失败 {{ batch.failed.length }}</span>
            <span v-if="batch.cancelled" class="sum-dim">（已取消）</span>
            <button class="btn dim" @click="resetBatch">清除</button>
          </div>
          <div v-if="batch.failed.length" class="fail-list">
            <div v-for="f in batch.failed.slice(0, 5)" :key="f.name" class="fail-item" :title="f.reason">{{ f.name }} — {{ f.reason }}</div>
            <div v-if="batch.failed.length > 5" class="fail-item dim">等 {{ batch.failed.length }} 张失败</div>
          </div>
        </template>
      </div>

      <div class="btns">
        <button class="btn primary big" :disabled="!library.activeId.value || batch.running" @click="exportSingle">导出当前照片</button>
        <button class="btn" :disabled="!targetCount || batch.running" @click="exportBatch">
          批量导出（{{ selectedCount ? selectedCount + ' 张选中' : '全部 ' + targetCount + ' 张' }}）
        </button>
      </div>
    </section>
  </div>

  <!-- 导出预览弹窗 -->
  <div v-if="preview" class="preview-mask" @click.self="closePreview">
    <div class="preview-box">
      <div class="preview-head">
        <span class="preview-title">导出成功</span>
        <button class="preview-close" title="关闭" @click="closePreview">×</button>
      </div>
      <div class="preview-img-wrap" :class="{ zoom: zoom1x }" @click="zoom1x = !zoom1x">
        <img :src="preview.url" :alt="preview.name" class="preview-img" :class="{ one: zoom1x }" />
      </div>
      <div class="preview-foot">
        <span class="preview-name" :title="preview.name">{{ preview.name }}</span>
        <span class="preview-meta">{{ preview.w && preview.h ? preview.w + ' × ' + preview.h + ' px' : '—' }}</span>
        <span class="preview-meta">{{ preview.sizeText }}</span>
        <span v-if="saved" class="preview-saved">已保存 ✓</span>
        <button v-if="saved && savedPath" class="btn" @click="openSavedFolder">打开所在文件夹</button>
        <button class="btn primary" @click="savePreview">保存图片</button>
      </div>
    </div>
  </div>
</template>
```

- [ ] **Step 2: style 区整体替换**

保留原有 token 体系，替换为：

```css
.export-view {
  height: 100%;
  overflow: auto;
  padding: 16px 20px 12px;
  background: var(--shell);
  max-width: 960px;
  margin: 0 auto;
}
.page-head { margin-bottom: 12px; }
.title {
  font-size: 13px; font-weight: 400; line-height: 18px;
  margin: 0 0 4px; color: var(--text);
}
.sub { color: var(--text-dim); font-size: 12px; font-weight: 400; line-height: 16px; margin: 0; }
.cards { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
.card {
  background: var(--panel);
  border: 1px solid var(--border);
  border-radius: 0;
  padding: 12px 14px;
}
.card.secondary { opacity: 0.92; }
.group-head {
  display: flex; align-items: center; gap: 6px;
  margin-bottom: 10px; color: var(--text-dim);
}
.group-head h3 {
  margin: 0; font-size: 12px; font-weight: 400; line-height: 16px;
  color: var(--text); text-transform: uppercase; letter-spacing: 0;
}
.head-hint { margin-left: auto; font-size: 11px; color: var(--text-dim); }
.divider { height: 1px; background: var(--border); margin: 10px 0; }
.row { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; line-height: 16px; }
.row > label:first-child { width: 56px; flex: none; font-size: 12px; font-weight: 400; color: var(--text-dim); }
.row.tools { margin-bottom: 8px; }
.seg { display: flex; border: 1px solid var(--border); overflow: hidden; height: 24px; }
.seg button {
  background: var(--panel-2); color: var(--text-dim);
  border: none; border-right: 1px solid var(--border);
  padding: 0 14px; font-size: 12px; cursor: pointer; height: 100%;
}
.seg button:last-child { border-right: none; }
.seg button:hover { background: var(--hover); color: var(--text); }
.seg button.on { background: var(--text); color: var(--shell); }
.check { display: flex; align-items: center; gap: 6px; cursor: pointer; user-select: none; font-size: 12px; color: var(--text-dim); }
.check input { margin: 0; }
.rules-area {
  flex: 1; min-width: 0; min-height: 54px; padding: 4px 8px;
  background: var(--panel-2); border: 1px solid var(--border);
  color: var(--text); font-size: 12px; line-height: 16px;
  font-family: inherit; resize: vertical;
}
.inp {
  flex: 1; height: 24px; background: var(--panel-2);
  border: 1px solid var(--border); color: var(--text);
  padding: 0 8px; font-size: 12px;
}
.hint { font-size: 12px; color: var(--text-dim); margin: 0 0 8px; line-height: 16px; }
.count { margin-left: auto; font-size: 12px; color: var(--text-dim); }
.hint-inline { font-size: 11px; color: var(--text-dim); margin-left: auto; }
.tools { gap: 8px; }

/* 网格缩略图 */
.thumb-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(112px, 1fr));
  gap: 8px;
  max-height: 260px;
  overflow-y: auto;
  padding: 2px;
}
.thumb {
  position: relative;
  background: var(--panel-2);
  border: 1px solid var(--border);
  overflow: hidden;
  cursor: pointer;
}
.thumb:hover { background: var(--hover); }
.thumb.selected { border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); }
.thumb.active { border-color: var(--text); }
.thumb.selected.active { border-color: var(--text); box-shadow: inset 0 0 0 1px var(--accent); }
.thumb img { display: block; width: 100%; height: 76px; object-fit: cover; background: var(--canvas-empty); }
.thumb-name {
  display: block; padding: 2px 4px; font-size: 11px;
  color: var(--text-dim); line-height: 14px;
  white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
}
.thumb-check {
  position: absolute; top: 2px; right: 2px;
  width: 16px; height: 16px; background: var(--accent);
  color: #fff; font-size: 11px; line-height: 16px; text-align: center;
}

/* 吸底任务卡 */
.taskbar {
  position: sticky;
  bottom: 0;
  z-index: 10;
  display: flex;
  align-items: center;
  gap: 16px;
  border-top: 1px solid var(--border);
  background: var(--panel);
  box-shadow: 0 -4px 12px rgba(0, 0, 0, 0.18);
}
.estimate { display: flex; align-items: baseline; gap: 8px; flex: none; }
.est-title { font-size: 11px; color: var(--text-dim); }
.est-val { font-size: 12px; color: var(--text); font-variant-numeric: tabular-nums; }
.progress-zone { flex: 1; min-width: 0; }
.prog-line { display: flex; align-items: center; gap: 8px; }
.prog-track { flex: 1; height: 4px; background: var(--panel-2); border: 1px solid var(--border); }
.prog-fill { height: 100%; background: var(--accent); transition: width 0.2s; }
.prog-text { font-size: 11px; color: var(--text-dim); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 40%; }
.summary { display: flex; align-items: center; gap: 8px; font-size: 12px; }
.sum-ok { color: var(--text); }
.sum-bad { color: var(--text-dim); }
.sum-dim { color: var(--text-dim); }
.fail-list { margin-top: 4px; }
.fail-item { font-size: 11px; color: var(--text-dim); line-height: 16px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.fail-item.dim { opacity: 0.7; }
.btns { display: flex; gap: 8px; flex: none; }

/* 按钮 */
.btn {
  background: var(--btn-bg); border: 1px solid var(--border);
  color: var(--text); padding: 0 16px; height: 26px;
  font-size: 12px; cursor: pointer;
}
.btn:hover { background: var(--hover); }
.btn:active { background: var(--pressed); }
.btn:disabled { opacity: 0.4; cursor: not-allowed; }
.btn.primary { background: var(--accent); border-color: var(--accent); color: var(--text); }
.btn.primary:hover { background: var(--hover); }
.btn.big { height: 30px; padding: 0 20px; }
.btn.danger { color: var(--text); border-color: var(--accent); }
.btn.dim { opacity: 0.7; height: 20px; padding: 0 8px; font-size: 11px; }

/* 预览弹窗（沿用现状骨架 + 增强） */
.preview-mask { position: fixed; inset: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; }
.preview-box { max-width: 78vw; max-height: 88vh; display: flex; flex-direction: column; background: var(--panel); border: 1px solid var(--border); }
.preview-head { display: flex; align-items: center; justify-content: space-between; height: 28px; padding: 0 8px 0 12px; border-bottom: 1px solid var(--border); }
.preview-title { font-size: 13px; color: var(--text); }
.preview-close { width: 22px; height: 22px; border: none; background: transparent; color: var(--text-dim); font-size: 16px; cursor: pointer; }
.preview-close:hover { background: var(--hover); color: var(--text); }
.preview-img-wrap { flex: 1; min-height: 0; overflow: auto; background: var(--canvas-loaded); padding: 12px; cursor: zoom-in; }
.preview-img-wrap.zoom { cursor: zoom-out; }
.preview-img { display: block; max-width: 100%; max-height: 60vh; object-fit: contain; margin: 0 auto; }
.preview-img.one { max-width: none; max-height: none; cursor: zoom-out; }
.preview-foot { display: flex; align-items: center; gap: 12px; min-height: 36px; padding: 4px 12px; border-top: 1px solid var(--border); }
.preview-name { flex: 0 1 auto; min-width: 0; font-size: 12px; color: var(--text); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 40%; }
.preview-meta { font-size: 11px; color: var(--text-dim); font-variant-numeric: tabular-nums; }
.preview-saved { font-size: 11px; color: var(--text); }
@media (max-width: 860px) {
  .cards { grid-template-columns: 1fr; }
  .taskbar { flex-wrap: wrap; }
}
```

- [ ] **Step 3: 类型检查与全量测试**

Run: `npx vue-tsc -b` → 0 error（删除 Task 4 可能的 `void estimate` 规避）
Run: `npm run test` → 全部 PASS
Run: `npm run build` → 构建成功

- [ ] **Step 4: dev 冒烟**

dev server 已在 http://localhost:5180 运行（热更新），浏览器/桌面端检查：分组头渲染、画质滑块为 RangeSlider、网格缩略图多选、任务卡吸底、预估随超采样联动。

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/ExportPanel.vue
git -c user.name=yuhaowang774 -c user.email=yuhaowang774@users.noreply.github.com commit -m "feat: 导出界面精装（分组头/网格缩略图/吸底任务卡/预览增强）"
```

---

### Task 6: 手动验收（双端）+ 双端同步 + 收尾

- [ ] **Step 1: 桌面端验收清单**（dev 模式下按 spec 7.2 执行）

- 单张导出 → 预览显示分辨率/体积 → 保存 → 「打开所在文件夹」定位文件
- 批量 3 张 → 进度逐张刷新 → 中途取消 → 汇总「已取消」正确
- 预览点击图片 1:1 切换与拖动
- 修改画质/超采样 → 任务卡预估联动

- [ ] **Step 2: 构建验证**

Run: `npm run build` → 成功；`npm run test` → 全 PASS

- [ ] **Step 3: 双端同步（src 覆盖到 d:\A\frame）**

```powershell
Copy-Item src\components\layout\ExportPanel.vue d:\A\frame\src\components\layout\ -Force
Copy-Item src\core\exporter.ts,src\core\textRules.ts,src\core\textRules.test.ts,src\core\exportMetrics.test.ts d:\A\frame\src\core\ -Force
Copy-Item src\platform\fs.ts d:\A\frame\src\platform\ -Force
```

- [ ] **Step 4: frame 构建与测试**

Run（cwd = `d:\A\frame`）: `npm run build` → 成功；`npm run test` → 全 PASS

- [ ] **Step 5: 两侧分别提交**

```bash
# FrameLab（若有未提交改动）
git add -A src docs; git -c user.name=yuhaowang774 -c user.email=yuhaowang774@users.noreply.github.com commit -m "feat: 导出界面精装收尾"
# frame
git add src; git -c user.name=yuhaowang774 -c user.email=yuhaowang774@users.noreply.github.com commit -m "feat: 同步导出界面精装改造"
```

---

## Self-Review 记录

1. **Spec 覆盖**：§2 视觉→Task 5；§3 预估→Task 1+4；§4 进度/取消→Task 4+5；§5 预览增强→Task 3+4+5；§6 边界→Task 4（竞态保护/失败汇总）+Task 1（非法输入）；§7 测试→Task 1/2 单测 + Task 6 手动清单；§8 双端同步→Task 6。无缺口。
2. **占位符扫描**：无 TBD/「适当处理」类占位；Task 1 Step 4 对删除段的替换给出了完整新代码。
3. **类型一致性**：`estimateExportSize` 返回 `{w,h}` 与 Task 4 `estimate` computed 一致；`saveBlobAs` 返回 `string|null` 与 Task 4 `savedPath` 一致；`makeRuleApplier` 签名与 Task 2 测试一致。
