// 第四步回归（方案 §6 / §7.3）：人群偏好、风格标签、反馈闭环与分项评分
// 判据写成性质（相等 / 相对大小 / 上限 / 结构），不锁具体某件衣服；
// 数值锚点（14.4 / 3.2 / 9 / 7 / 4 / ±0.3）故意写死字面量，配置漂移必须先红。
import { describe, expect, it } from 'vitest'
import { CATALOG } from '../catalog'
import { computeAssembly, scoreAssembly } from './scoring'
import { applyFeedback, resolvePrefs, revokeLastFeedback } from './prefs'
import { planAt, settings, DATE } from './test-scenarios'
import type { ClothingItem, DemandVector } from '@/core/types'

/** 中性需求：除保暖外全零，保证差分只来自偏好分项 */
const DEMAND_NEUTRAL: DemandVector = {
  WARMTH: 50, WIND: 0, RAIN: 0, BREATHABILITY: 0, SOLAR: 0, REMOVABLE: 0,
}
const NEED_MILD = { requiredClo: 0.5, designHourTempC: 14 }

/** 同构件：数值全同，只改标签（差分只可能来自偏好/风格桶） */
const mk = (id: string, over: Partial<ClothingItem> = {}): ClothingItem => ({
  id,
  name: id,
  category: 'TOP',
  role: 'BASE',
  insulationClo: 0.3,
  wind: 0,
  water: 0,
  breathability: 0.6,
  solar: 0,
  weightGrams: 300,
  removable: false,
  comfortRangeC: [-20, 30],
  ...over,
})

const chosenIds = (r: ReturnType<typeof planAt>) =>
  r.dayOutfit.layers.flatMap((l) => l.items.map((i) => i.id)).sort()

describe('S4-1 默认中性：标签不产生排序信号', () => {
  const taggedA = mk('tagged-a', {
    styles: ['BUSINESS'], formality: 0.9, presentation: ['FEMININE'], silhouettes: ['LOOSE'], colors: ['WARM'],
  })
  const taggedB = mk('tagged-b', {
    styles: ['SPORT'], formality: 0.1, presentation: ['MASCULINE'], silhouettes: ['FITTED'], colors: ['COOL'],
  })

  it('默认偏好下，标签迥异的两件同构组合得分严格相等（缺省 = 无排序信号）', () => {
    const sa = scoreAssembly(computeAssembly([taggedA], ['BASE']), DEMAND_NEUTRAL, NEED_MILD)
    const sb = scoreAssembly(computeAssembly([taggedB], ['BASE']), DEMAND_NEUTRAL, NEED_MILD)
    expect(sa).toBe(sb)
  })

  it('默认 plan：分项键齐全、和≈dayScore、风格与偏好为中性常数', () => {
    const r = planAt({ mean: 12, amp: 4 })
    expect(r.scoreBreakdown.map((b) => b.key)).toEqual([
      'warmth', 'protection', 'activity', 'style', 'coordination', 'removable', 'preference', 'diversity',
    ])
    const byKey = new Map(r.scoreBreakdown.map((b) => [b.key, b.score]))
    expect(byKey.get('style')).toBe(14.4)
    expect(byKey.get('preference')).toBe(3.2)
    const sum = r.scoreBreakdown.reduce((s, b) => s + b.score, 0)
    expect(Math.abs(sum - r.dayScore)).toBeLessThanOrEqual(0.2)
    expect(r.dayScore).toBeGreaterThan(0)
  })
})

describe('S4-2 风格偏好改变候选（只软排序，不改天气事实与安全）', () => {
  const scene = { mean: 14, amp: 4 }

  it('同一场景：BUSINESS 与 SPORT 选中件至少有一件不同', () => {
    const business = planAt(scene, { styles: ['BUSINESS'] })
    const sport = planAt(scene, { styles: ['SPORT'] })
    expect(chosenIds(business)).not.toEqual(chosenIds(sport))
  })

  it('需求向量 / 安全 / 带伞结论不随风格变化', () => {
    const business = planAt(scene, { styles: ['BUSINESS'] })
    const sport = planAt(scene, { styles: ['SPORT'] })
    expect(sport.demand.vector).toEqual(business.demand.vector)
    expect(JSON.stringify(sport.safety)).toBe(JSON.stringify(business.safety))
    expect(JSON.stringify(sport.umbrella)).toBe(JSON.stringify(business.umbrella))
  })
})

describe('S4-3 呈现偏好不硬限制、不改安全', () => {
  const fem = mk('fem', { presentation: ['FEMININE'] })
  const mas = mk('mas', { presentation: ['MASCULINE'] })
  const scoreWith = (pref: 'FEMININE' | 'MASCULINE') => {
    const prefs = resolvePrefs(settings({ presentation: pref }))
    return {
      fem: scoreAssembly(computeAssembly([fem], ['BASE']), DEMAND_NEUTRAL, NEED_MILD, prefs),
      mas: scoreAssembly(computeAssembly([mas], ['BASE']), DEMAND_NEUTRAL, NEED_MILD, prefs),
    }
  }

  it('选 FEMININE 时 FEMININE 标签件得分更高；选 MASCULINE 时反超', () => {
    expect(scoreWith('FEMININE').fem).toBeGreaterThan(scoreWith('FEMININE').mas)
    expect(scoreWith('MASCULINE').mas).toBeGreaterThan(scoreWith('MASCULINE').fem)
  })

  it('集成：呈现偏好不改变 safety，结构合法（各层非空）', () => {
    const base = planAt({ mean: 12, amp: 4 })
    const r = planAt({ mean: 12, amp: 4 }, { presentation: 'FEMININE' })
    expect(JSON.stringify(r.safety)).toBe(JSON.stringify(base.safety))
    expect(r.dayOutfit.layers.length).toBeGreaterThanOrEqual(2)
    for (const l of r.dayOutfit.layers) expect(l.items.length).toBeGreaterThan(0)
  })
})

describe('S4-4 场合 / 廓形 / 色彩软排序', () => {
  const highFormal = mk('formal', { formality: 0.8 })
  const lowFormal = mk('casual', { formality: 0.2 })
  const loose = mk('loose', { silhouettes: ['LOOSE'] })
  const fitted = mk('fitted', { silhouettes: ['FITTED'] })
  const cool = mk('cool', { colors: ['COOL'] })
  const warm = mk('warm', { colors: ['WARM'] })

  const scoreUnder = (it: ClothingItem, over: Parameters<typeof settings>[0]) =>
    scoreAssembly(computeAssembly([it], ['BASE']), DEMAND_NEUTRAL, NEED_MILD, resolvePrefs(settings(over)))

  it('OFFICE：高正式度件得分更高；DAILY（默认）下两件相等', () => {
    expect(scoreUnder(highFormal, { occasion: 'OFFICE' })).toBeGreaterThan(
      scoreUnder(lowFormal, { occasion: 'OFFICE' }),
    )
    expect(scoreUnder(highFormal, {})).toBe(scoreUnder(lowFormal, {}))
  })

  it('廓形：LOOSE 偏好选宽松件、FITTED 偏好选合身件；默认 REGULAR 相等', () => {
    expect(scoreUnder(loose, { silhouette: 'LOOSE' })).toBeGreaterThan(
      scoreUnder(fitted, { silhouette: 'LOOSE' }),
    )
    expect(scoreUnder(fitted, { silhouette: 'FITTED' })).toBeGreaterThan(
      scoreUnder(loose, { silhouette: 'FITTED' }),
    )
    expect(scoreUnder(loose, {})).toBe(scoreUnder(fitted, {}))
  })

  it('色彩：COOL 偏好选冷色件、WARM 偏好选暖色件；默认 ANY 相等', () => {
    expect(scoreUnder(cool, { colorPreference: 'COOL' })).toBeGreaterThan(
      scoreUnder(warm, { colorPreference: 'COOL' }),
    )
    expect(scoreUnder(warm, { colorPreference: 'WARM' })).toBeGreaterThan(
      scoreUnder(cool, { colorPreference: 'WARM' }),
    )
    expect(scoreUnder(cool, {})).toBe(scoreUnder(warm, {}))
  })
})

describe('S4-5 易出汗体质在较低热压下带备用贴身衣（不改需求）', () => {
  it('跑步 12℃（透气需求 45）：默认无备用衣；EASY 有且标 sweat-easy', () => {
    const avg = planAt({ mean: 12, amp: 3 }, { activity: 'RUNNING' })
    const easy = planAt({ mean: 12, amp: 3 }, { activity: 'RUNNING', sweat: 'EASY' })
    expect(avg.demand.vector.BREATHABILITY).toBe(45)
    expect(avg.accessories.some((a) => a.kind === 'SPARE_TEE')).toBe(false)
    const spare = easy.accessories.find((a) => a.kind === 'SPARE_TEE')
    expect(spare?.reasonCode).toBe('sweat-easy')
    expect(easy.demand.vector).toEqual(avg.demand.vector)
  })
})

describe('S4-6 暴露习惯只调防雨权重（窗口事实不放大，也不归零）', () => {
  const scene = { mean: 14, amp: 4, rainChance: 35, rainMmPerHour: 0.3 }
  const dims = (v: DemandVector) => ({
    WARMTH: v.WARMTH, WIND: v.WIND, BREATHABILITY: v.BREATHABILITY, SOLAR: v.SOLAR, REMOVABLE: v.REMOVABLE,
  })

  it('窗口 35% 未达 floor 线（<40%）：长时户外 9 > 短时 7 > 室内 4，其余维不变', () => {
    const indoor = planAt(scene, { exposureHabit: 'MAINLY_INDOOR' })
    const short = planAt(scene, { exposureHabit: 'SHORT_OUTDOOR' })
    const long = planAt(scene, { exposureHabit: 'LONG_OUTDOOR' })
    expect(long.demand.vector.RAIN).toBe(9)
    expect(short.demand.vector.RAIN).toBe(7)
    expect(indoor.demand.vector.RAIN).toBe(4)
    expect(dims(long.demand.vector)).toEqual(dims(short.demand.vector))
    expect(dims(short.demand.vector)).toEqual(dims(indoor.demand.vector))
  })
})

describe('S4-7 反馈闭环：小步、有上限、可撤销、不动安全', () => {
  it('COLD 逐步 +0.1、0.3 封顶；COLD/HOT 对冲；JUST_RIGHT 不改', () => {
    let s = settings()
    s = applyFeedback(s, 'COLD', DATE)
    expect(resolvePrefs(s).warmthBiasClo).toBeCloseTo(0.1, 5)
    s = applyFeedback(s, 'COLD', DATE)
    expect(resolvePrefs(s).warmthBiasClo).toBeCloseTo(0.2, 5)
    s = applyFeedback(s, 'COLD', DATE)
    expect(resolvePrefs(s).warmthBiasClo).toBeCloseTo(0.3, 5)
    s = applyFeedback(s, 'COLD', DATE)
    expect(resolvePrefs(s).warmthBiasClo).toBeCloseTo(0.3, 5)
    // 4C−1H 净差 (4−1)×0.1 = 0.3 仍在帽内；再一条 HOT 才退回 0.2
    s = applyFeedback(s, 'HOT', DATE)
    expect(resolvePrefs(s).warmthBiasClo).toBeCloseTo(0.3, 5)
    s = applyFeedback(s, 'HOT', DATE)
    expect(resolvePrefs(s).warmthBiasClo).toBeCloseTo(0.2, 5)
    s = applyFeedback(s, 'JUST_RIGHT', DATE)
    expect(resolvePrefs(s).warmthBiasClo).toBeCloseTo(0.2, 5)
  })

  it('撤销最后一条回到上一状态；空历史撤销原样返回', () => {
    const s0 = settings()
    const s1 = applyFeedback(s0, 'COLD', DATE)
    expect(resolvePrefs(revokeLastFeedback(s1)).warmthBiasClo).toBe(0)
    expect(revokeLastFeedback(s0)).toBe(s0)
  })

  it('集成：3×COLD → 保暖目标 +0.3，safety 与需求向量不变', () => {
    const hist = [0, 1, 2].map(() => ({ kind: 'COLD' as const, at: DATE }))
    const base = planAt({ mean: 12, amp: 4 })
    const cold = planAt({ mean: 12, amp: 4 }, { feedbackHistory: hist })
    expect(cold.coverage.requiredClo - base.coverage.requiredClo).toBeCloseTo(0.3, 2)
    expect(JSON.stringify(cold.safety)).toBe(JSON.stringify(base.safety))
    expect(cold.demand.vector).toEqual(base.demand.vector)
  })
})

describe('S4-8 目录标签齐备、枚举合法；缺标签按中性回退', () => {
  const STYLE_TAGS = ['DAILY', 'COMMUTE', 'BUSINESS', 'SPORT', 'OUTDOOR', 'STREET', 'JAPANESE_LOOSE', 'KOREAN_CLEAN']
  const PRESENTATIONS = ['MASCULINE', 'FEMININE', 'UNISEX']
  const SILHOUETTES = ['FITTED', 'REGULAR', 'LOOSE']
  const COLORS = ['NEUTRAL', 'COOL', 'WARM', 'BRIGHT']

  it('全部件都带五类标签，取值都在枚举内', () => {
    for (const it of CATALOG) {
      expect(it.styles?.length, it.id).toBeGreaterThan(0)
      for (const s of it.styles!) expect(STYLE_TAGS, it.id).toContain(s)
      expect(typeof it.formality, it.id).toBe('number')
      expect(it.formality!, it.id).toBeGreaterThanOrEqual(0)
      expect(it.formality!, it.id).toBeLessThanOrEqual(1)
      expect(it.presentation?.length, it.id).toBeGreaterThan(0)
      for (const p of it.presentation!) expect(PRESENTATIONS, it.id).toContain(p)
      expect(it.silhouettes?.length, it.id).toBeGreaterThan(0)
      for (const s of it.silhouettes!) expect(SILHOUETTES, it.id).toContain(s)
      expect(it.colors?.length, it.id).toBeGreaterThan(0)
      for (const c of it.colors!) expect(COLORS, it.id).toContain(c)
    }
  })

  it('缺标签的件按中性回退：与"有标签但不匹配"同分，且低于命中件', () => {
    const prefs = resolvePrefs(settings({ presentation: 'FEMININE' }))
    const score = (it: ClothingItem) => scoreAssembly(computeAssembly([it], ['BASE']), DEMAND_NEUTRAL, NEED_MILD, prefs)
    const bare = score(mk('bare'))
    const miss = score(mk('miss', { presentation: ['MASCULINE'] }))
    const hit = score(mk('hit', { presentation: ['FEMININE'] }))
    expect(bare).toBe(miss)
    expect(bare).toBeLessThan(hit)
  })
})
