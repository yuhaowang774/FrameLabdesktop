import { describe, it, expect, beforeEach } from 'vitest'
import { shouldNotifyVersion, getSkipVersion, setSkipVersion } from './useUpdater'

describe('shouldNotifyVersion 版本提醒判断', () => {
  it('从未跳过：有效版本都提醒', () => {
    expect(shouldNotifyVersion('0.2.8', '')).toBe(true)
    expect(shouldNotifyVersion('0.2.8', '0.2.7')).toBe(true)
  })

  it('已跳过同版本：不提醒', () => {
    expect(shouldNotifyVersion('0.2.8', '0.2.8')).toBe(false)
  })

  it('高于已跳过版本：提醒', () => {
    expect(shouldNotifyVersion('0.2.9', '0.2.8')).toBe(true)
    expect(shouldNotifyVersion('0.3.0', '0.2.9')).toBe(true)
    // 多段版本号（0.2.10 > 0.2.9，非字典序）
    expect(shouldNotifyVersion('0.2.10', '0.2.9')).toBe(true)
  })

  it('低于已跳过版本（版本回退）：不提醒', () => {
    expect(shouldNotifyVersion('0.2.7', '0.2.8')).toBe(false)
  })

  it('空版本号：不提醒', () => {
    expect(shouldNotifyVersion('', '0.2.7')).toBe(false)
    expect(shouldNotifyVersion('', '')).toBe(false)
  })
})

describe('跳过版本持久化', () => {
  beforeEach(() => localStorage.clear())

  it('写入后读回；清除后为空', () => {
    expect(getSkipVersion()).toBe('')
    setSkipVersion('0.2.8')
    expect(getSkipVersion()).toBe('0.2.8')
    setSkipVersion(null)
    expect(getSkipVersion()).toBe('')
  })

  it('跳过后再检查更高版本：仍提醒', () => {
    setSkipVersion('0.2.8')
    expect(shouldNotifyVersion('0.2.8', getSkipVersion())).toBe(false)
    expect(shouldNotifyVersion('0.2.9', getSkipVersion())).toBe(true)
  })
})
