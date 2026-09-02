// 更新记录测试：版本比较 / 数据完整性 / 升级检测（含首次安装、降级、相同版本）
import { describe, it, expect, beforeEach } from 'vitest'
import { UPDATE_LOG, compareVersions, findUpdateEntry, IMPORTANCE_LABELS } from './updateLog'
import { detectUpdate, getLastVersion } from '../composables/useUpdateLog'

describe('compareVersions 版本比较', () => {
  it('基本大小关系', () => {
    expect(compareVersions('0.1.11', '0.1.10')).toBe(1)
    expect(compareVersions('0.1.10', '0.1.11')).toBe(-1)
    expect(compareVersions('0.1.10', '0.1.10')).toBe(0)
  })

  it('段数不齐按 0 补齐', () => {
    expect(compareVersions('0.2', '0.1.9')).toBe(1)
    expect(compareVersions('1.0', '0.9.9')).toBe(1)
    expect(compareVersions('0.1', '0.1.0')).toBe(0)
  })

  it('数字比较而非字符串比较（10 > 9）', () => {
    expect(compareVersions('0.1.10', '0.1.9')).toBe(1)
  })
})

describe('UPDATE_LOG 数据完整性', () => {
  it('版本号严格递增（新版本在前）', () => {
    for (let i = 0; i < UPDATE_LOG.length - 1; i++) {
      expect(compareVersions(UPDATE_LOG[i].version, UPDATE_LOG[i + 1].version)).toBe(1)
    }
  })

  it('每条记录字段齐全（版本 / 日期 / 重要程度 / 至少一个内容分组）', () => {
    for (const e of UPDATE_LOG) {
      expect(e.version).toMatch(/^\d+\.\d+\.\d+$/)
      expect(e.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
      expect(IMPORTANCE_LABELS[e.importance]).toBeTruthy()
      const total =
        (e.groups.added?.length ?? 0) +
        (e.groups.improved?.length ?? 0) +
        (e.groups.fixed?.length ?? 0) +
        (e.groups.known?.length ?? 0)
      expect(total).toBeGreaterThan(0)
    }
  })
})

describe('findUpdateEntry', () => {
  it('按版本命中 / 未入日志返回 null', () => {
    expect(findUpdateEntry('0.1.11')?.importance).toBe('normal')
    expect(findUpdateEntry('9.9.9')).toBeNull()
  })
})

describe('detectUpdate 升级检测', () => {
  beforeEach(() => localStorage.clear())

  it('首次安装：只记录版本不弹窗', () => {
    expect(getLastVersion()).toBe('')
    expect(detectUpdate('0.1.11')).toBeNull()
    expect(getLastVersion()).toBe('0.1.11')
    // 第二次同版本启动不弹
    expect(detectUpdate('0.1.11')).toBeNull()
  })

  it('版本升级：返回本次条目并写回新版本', () => {
    localStorage.setItem('framelab-last-version', '0.1.10')
    const hit = detectUpdate('0.1.11')
    expect(hit?.entry.version).toBe('0.1.11')
    expect(hit?.from).toBe('0.1.10')
    expect(getLastVersion()).toBe('0.1.11')
  })

  it('降级：不弹窗但写回当前（较低）版本', () => {
    localStorage.setItem('framelab-last-version', '0.2.0')
    expect(detectUpdate('0.1.11')).toBeNull()
    expect(getLastVersion()).toBe('0.1.11')
  })

  it('升级到未入日志的版本：不弹窗', () => {
    localStorage.setItem('framelab-last-version', '0.1.10')
    expect(detectUpdate('0.1.99')).toBeNull()
    expect(getLastVersion()).toBe('0.1.99')
  })
})
