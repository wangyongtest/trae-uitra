/**
 * 缓存监控核心逻辑单元测试（前端版）
 * 测试命中率计算、状态判定等纯逻辑
 */
import { describe, it, expect } from 'vitest'

/**
 * 缓存命中率计算（前端纯函数版本，与Go kernel逻辑一致）
 */
function calculateHitRate(totalPrompt: number, totalHit: number): number {
  if (totalPrompt === 0) return 1.0
  return totalHit / totalPrompt
}

/**
 * 根据命中率返回状态灯颜色
 */
function getHitRateStatus(hitRate: number): 'green' | 'yellow' | 'red' {
  if (hitRate >= 0.95) return 'green'
  if (hitRate >= 0.80) return 'yellow'
  return 'red'
}

/**
 * 费用计算（纯函数版本，与Go kernel逻辑一致）
 */
interface ModelPricing {
  inputPricePerMillion: number
  outputPricePerMillion: number
  cacheHitPriceRatio: number
}

interface Usage {
  promptTokens: number
  completionTokens: number
}

function calculateCost(
  pricing: ModelPricing,
  usage: Usage,
  hitRate: number
): number {
  const cacheHitTokens = usage.promptTokens * hitRate
  const normalInputTokens = usage.promptTokens - cacheHitTokens
  const inputCost =
    (normalInputTokens / 1_000_000) * pricing.inputPricePerMillion +
    (cacheHitTokens / 1_000_000) * pricing.inputPricePerMillion * pricing.cacheHitPriceRatio
  const outputCost = (usage.completionTokens / 1_000_000) * pricing.outputPricePerMillion
  return inputCost + outputCost
}

/**
 * 确定性JSON序列化（按key字母序排列）
 */
function deterministicStringify(obj: unknown): string {
  if (obj === null || typeof obj !== 'object') {
    return JSON.stringify(obj)
  }
  if (Array.isArray(obj)) {
    return '[' + obj.map(deterministicStringify).join(',') + ']'
  }
  const keys = Object.keys(obj as Record<string, unknown>).sort()
  const pairs = keys.map(k => {
    const v = (obj as Record<string, unknown>)[k]
    return JSON.stringify(k) + ':' + deterministicStringify(v)
  })
  return '{' + pairs.join(',') + '}'
}

describe('Cache Monitor Logic', () => {
  describe('calculateHitRate', () => {
    it('零prompt tokens应返回1.0', () => {
      expect(calculateHitRate(0, 0)).toBe(1.0)
    })

    it('全部命中应返回1.0', () => {
      expect(calculateHitRate(1000, 1000)).toBe(1.0)
    })

    it('95%命中率应返回0.95', () => {
      expect(calculateHitRate(10000, 9500)).toBe(0.95)
    })

    it('零命中应返回0.0', () => {
      expect(calculateHitRate(1000, 0)).toBe(0.0)
    })

    it('75%命中率应返回0.75', () => {
      expect(calculateHitRate(4000, 3000)).toBe(0.75)
    })
  })

  describe('getHitRateStatus', () => {
    it('>=95%应为green', () => {
      expect(getHitRateStatus(0.95)).toBe('green')
      expect(getHitRateStatus(0.98)).toBe('green')
      expect(getHitRateStatus(1.0)).toBe('green')
    })

    it('80%-95%应为yellow', () => {
      expect(getHitRateStatus(0.80)).toBe('yellow')
      expect(getHitRateStatus(0.87)).toBe('yellow')
      expect(getHitRateStatus(0.94)).toBe('yellow')
    })

    it('<80%应为red', () => {
      expect(getHitRateStatus(0.79)).toBe('red')
      expect(getHitRateStatus(0.5)).toBe('red')
      expect(getHitRateStatus(0.0)).toBe('red')
    })
  })
})

describe('Cost Calculator', () => {
  const deepseekFlash: ModelPricing = {
    inputPricePerMillion: 0.1,
    outputPricePerMillion: 0.3,
    cacheHitPriceRatio: 0.1
  }

  const deepseekPro: ModelPricing = {
    inputPricePerMillion: 2.0,
    outputPricePerMillion: 8.0,
    cacheHitPriceRatio: 0.1
  }

  it('DeepSeek Flash 95%命中率 10k/2k tokens费用应正确', () => {
    const cost = calculateCost(deepseekFlash, { promptTokens: 10000, completionTokens: 2000 }, 0.95)
    // 命中9500 tokens @ 0.1*0.1 = 0.01/M, 正常500 tokens @ 0.1/M, 输出2000 @ 0.3/M
    const expected = (500/1e6)*0.1 + (9500/1e6)*0.01 + (2000/1e6)*0.3
    expect(cost).toBeCloseTo(expected, 6)
  })

  it('DeepSeek Pro费用应比Flash高', () => {
    const flashCost = calculateCost(deepseekFlash, { promptTokens: 5000, completionTokens: 1000 }, 0.9)
    const proCost = calculateCost(deepseekPro, { promptTokens: 5000, completionTokens: 1000 }, 0.9)
    expect(proCost).toBeGreaterThan(flashCost)
  })

  it('100%命中率时缓存折扣生效', () => {
    const fullHit = calculateCost(deepseekFlash, { promptTokens: 100000, completionTokens: 0 }, 1.0)
    const noHit = calculateCost(deepseekFlash, { promptTokens: 100000, completionTokens: 0 }, 0.0)
    expect(fullHit).toBeLessThan(noHit)
    expect(fullHit).toBeCloseTo(noHit * 0.1, 6)
  })
})

describe('Deterministic Serialization', () => {
  it('相同输入两次序列化应产生完全相同的字符串', () => {
    const obj = { b: 2, a: 1, c: 3 }
    const s1 = deterministicStringify(obj)
    const s2 = deterministicStringify(obj)
    expect(s1).toBe(s2)
  })

  it('map key应按字母序排列', () => {
    const obj = { z: 1, a: 2, m: 3 }
    const s = deterministicStringify(obj)
    expect(s.indexOf('"a"')).toBeLessThan(s.indexOf('"m"'))
    expect(s.indexOf('"m"')).toBeLessThan(s.indexOf('"z"'))
  })

  it('嵌套对象也应保持确定性', () => {
    const obj1 = { b: { y: 1, x: 2 }, a: [3, 1, 2] }
    const obj2 = { a: [3, 1, 2], b: { x: 2, y: 1 } }
    expect(deterministicStringify(obj1)).toBe(deterministicStringify(obj2))
  })
})
