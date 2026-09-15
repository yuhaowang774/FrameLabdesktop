// 模板库样张照片：每个内置模板配一张贴合其版式气质的照片
// （`src/assets/template-samples/<模板id>.jpg`，文件名即模板 id，替换照片只需覆盖同名文件）。
//
// 用途：模板库卡片在「用户未打开照片」时（官网网页版 / 桌面端空图库）展示各模板自己的样张，
// 而不是所有卡片共用同一张示例图；有照片时仍优先用用户自己的照片（个人化预览）。
// 匹配表（模板 ↔ 源照片）与再生成入口见 `scripts/gen-template-samples.ps1`。
const SAMPLE_MODS = import.meta.glob<string>('../assets/template-samples/*.jpg', {
  eager: true,
  import: 'default',
})

const BY_ID = new Map<string, string>()
for (const [path, url] of Object.entries(SAMPLE_MODS)) {
  const m = /\/([^/]+)\.jpg$/.exec(path)
  if (m) BY_ID.set(m[1], url)
}

/** 该模板是否有配套样张（测试/调试用） */
export function hasSample(templateId: string): boolean {
  return BY_ID.has(templateId)
}

/** 取模板的样张照片 URL；没有配套样张时返回 undefined（调用方回退默认示例图 / SVG 示意） */
export function sampleForTemplate(templateId: string): string | undefined {
  return BY_ID.get(templateId)
}

/** 样张总数（测试用） */
export function sampleCount(): number {
  return BY_ID.size
}
