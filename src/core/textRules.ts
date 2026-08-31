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
