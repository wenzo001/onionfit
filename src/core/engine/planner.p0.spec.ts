// P0 回归测试（算法优化方案 §2 P0 + §10.1）
// 只锁不变量与方向，不锁"某温度必出某件衣服"，避免目录更新把测试写脆。
import { describe, expect, it } from 'vitest'
import { buildWeatherContext } from './weather'
import { plan, buildCoverage } from './planner'
import { planLayerSlots, type LayerSlot } from './layering'
import { matchCandidates } from './matching'
import { scoreAssembly, computeAssembly, assembleOutfit } from './scoring'
import { ACTIVITY, LAYERING } from '../config'
import { SELECTABLE_ACTIVITIES } from './activity'
import { assessUmbrella } from './umbrella'
import type { ActivityKind, ClothingItem, DemandVector, WeatherReport } from '@/core/types'
import { DATE, makeReport, settings, planAt, type Opts } from './test-scenarios'

/** 组合里最暖的一件（用于判断厚外套是否可达） */
const warmest = (items: ClothingItem[]) => Math.max(0, ...items.map((i) => i.insulationClo))

describe('P0-1 保暖需求不在选衣前封顶', () => {
  it('更冷的天，所需保暖严格更大（-20 / -10 / 0 / 10℃ 四点互不相同）', () => {
    const needs = [-20, -10, 0, 10].map((mean) => planAt({ mean, amp: 2 }).thermal.requiredMaxClo)
    for (let i = 1; i < needs.length; i++) {
      expect(needs[i]).toBeLessThan(needs[i - 1])
    }
    // 封顶会让最冷的两点相等
    expect(needs[0]).not.toBeCloseTo(needs[1], 2)
  })

  it('-22℃ 与 0℃ 不得给出同一套结论（至少保暖量或结构可区分）', () => {
    const a = planAt({ mean: -22, amp: 2 })
    const b = planAt({ mean: 0, amp: 2 })
    expect(a.dayOutfit.effectiveClo).not.toBe(b.dayOutfit.effectiveClo)
    expect(JSON.stringify(a.dayOutfit.layers)).not.toBe(JSON.stringify(b.dayOutfit.layers))
  })
})

describe('P0-2 极寒的保暖外套必须可达', () => {
  it('-22℃ 静风干燥：组合里出现 clo ≥ 1.0 的厚外套（当前只有防护层里有）', () => {
    const r = planAt({ mean: -22, amp: 2, windMs: 0 })
    const chosen = r.dayOutfit.layers.flatMap((l) => l.items)
    expect(warmest(chosen)).toBeGreaterThanOrEqual(1.0)
  })

  it('-22℃ 静风干燥：必须有外层穿着，不能只靠叠中间层', () => {
    const r = planAt({ mean: -22, amp: 2, windMs: 0 })
    expect(r.dayOutfit.layers.some((l) => l.role === 'PROTECTION')).toBe(true)
  })

  it('厚外套进保暖池这条规则本身生效（开关只在 acceptsWarmOuterwear 上）', () => {
    const demand: DemandVector = {
      WARMTH: 100, WIND: 0, RAIN: 0, BREATHABILITY: 0, SOLAR: 0, REMOVABLE: 0,
    }
    const need = { requiredClo: 3.4, designHourTempC: -20 }
    const slot = planLayerSlots(demand, need).find((s) => s.role === 'INSULATION')!
    expect(slot.acceptsWarmOuterwear).toBe(true)
    const withFlag = matchCandidates(demand, [slot], need)[0]
    const withoutFlag = matchCandidates(demand, [{ ...slot, acceptsWarmOuterwear: false }], need)[0]
    expect(withFlag.some((i) => i.role === 'PROTECTION' && i.insulationClo >= 1)).toBe(true)
    expect(withoutFlag.some((i) => i.role === 'PROTECTION')).toBe(false)
  })
})

describe('P0-3 衣物不够时不伪装成合格推荐', () => {
  it('极寒 -22℃（日较差大）：库容量确实兜不住 → insufficient + CATALOG_INSUFFICIENT', () => {
    const r = planAt({ mean: -22, amp: 5 })
    expect(r.coverage.status).toBe('insufficient')
    expect(r.coverage.catalogDeficitClo).toBeGreaterThan(0)
    expect(r.coverage.unmetNeeds).toContain('CATALOG_INSUFFICIENT')
  })

  it('-30℃ 短日较差：至少不能是 adequate，缺口数字要摆出来', () => {
    const r = planAt({ mean: -30, amp: 2, windMs: 0 })
    expect(r.coverage.status).not.toBe('adequate')
    expect(r.coverage.deficitClo).toBeGreaterThan(0)
    expect(r.coverage.unmetNeeds.length).toBeGreaterThan(0)
  })

  it('温和 12℃：coverageStatus 不是 insufficient（不能把正常天也报成不够）', () => {
    const r = planAt({ mean: 12, amp: 4 })
    expect(r.coverage.status).not.toBe('insufficient')
  })

  it('拿不到逐时数据时置信度下降，覆盖判定转为 unknown（无放宽时）', () => {
    const r = planAt({ mean: -6, amp: 5, hourly: false })
    expect(r.coverage.status).toBe('unknown')
    expect(r.coverage.confidence).toBeLessThan(1)
  })
})

describe('P0-3b 组装失败不静默兜底（全部候选不合格也要登记）', () => {
  const mkItem = (id: string, water: number): ClothingItem => ({
    id,
    name: id,
    category: 'OUTER',
    role: 'PROTECTION',
    insulationClo: 0.5,
    wind: 0.9,
    water,
    breathability: 0.5,
    solar: 0,
    weightGrams: 400,
    removable: true,
    comfortRangeC: [-20, 20],
    shellGrade: 1,
  })
  const rainSlot: LayerSlot = {
    role: 'PROTECTION',
    category: 'OUTER',
    minClo: 0,
    needWater: true,
    needWind: false,
    needSolar: false,
    acceptsWarmOuterwear: false,
    reasonCodes: ['NEED_RAIN_SHELL'],
  }
  const demand: DemandVector = { WARMTH: 0, WIND: 0, RAIN: 80, BREATHABILITY: 0, SOLAR: 0, REMOVABLE: 0 }

  it('没有一件满足槽位硬条件：登记 RELAXED，不冒充合格', () => {
    const res = assembleOutfit([rainSlot], [[mkItem('不防水外套', 0.3)]], demand, { requiredClo: 0, designHourTempC: 10 })
    expect(res.relaxedCodes).toEqual(['RELAXED_PROTECTION'])
    // 尽力而为的组合仍给界面展示，但必须带着未满足标记
    expect(res.chosen.length).toBe(1)
  })

  it('候选池为空：登记 NO_CANDIDATE，不产生凭空衣物', () => {
    const res = assembleOutfit([rainSlot], [[]], demand, { requiredClo: 0, designHourTempC: 10 })
    expect(res.relaxedCodes).toEqual(['NO_CANDIDATE_PROTECTION_OUTER'])
    expect(res.chosen.length).toBe(0)
  })
})

describe('P0-3c 覆盖判定四态，各由独立事实触发', () => {
  it('库容量差 ≥ 一件轻中层 → insufficient + CATALOG_INSUFFICIENT', () => {
    const c = buildCoverage(4.28, 3.05, 3.83, true, [])
    expect(c.status).toBe('insufficient')
    expect(c.catalogDeficitClo).toBeCloseTo(0.45, 2)
    expect(c.unmetNeeds).toContain('CATALOG_INSUFFICIENT')
  })

  it('槽位被放宽 → insufficient + HARD_SLOTS_RELAXED（库容量够也不行）', () => {
    const c = buildCoverage(2, 2, 2.5, true, ['RELAXED_PROTECTION'])
    expect(c.status).toBe('insufficient')
    expect(c.unmetNeeds).toContain('HARD_SLOTS_RELAXED')
  })

  it('库容量够但这套偏薄 → marginal + OUTFIT_UNDERDRESSED', () => {
    const c = buildCoverage(1.7, 0.99, 2.07, true, [])
    expect(c.status).toBe('marginal')
    expect(c.unmetNeeds).toContain('OUTFIT_UNDERDRESSED')
  })

  it('余量充足 → adequate，无未满足项', () => {
    const c = buildCoverage(2.69, 3.12, 3.83, true, [])
    expect(c.status).toBe('adequate')
    expect(c.unmetNeeds).toEqual([])
  })

  it('缺逐时 → unknown + NO_HOURLY_FORECAST', () => {
    const c = buildCoverage(2, 2, 2.5, false, [])
    expect(c.status).toBe('unknown')
    expect(c.unmetNeeds).toContain('NO_HOURLY_FORECAST')
  })
})

describe('P0-4 保暖评分目标随场景，且欠保暖罚得更重', () => {
  const demand: DemandVector = {
    WARMTH: 60, WIND: 0, RAIN: 0, BREATHABILITY: 0, SOLAR: 0, REMOVABLE: 0,
  }
  const mk = (clo: number) => {
    const item: ClothingItem = {
      id: 't', name: '测试外套', category: 'OUTER', role: 'PROTECTION',
      insulationClo: clo, wind: 0.9, water: 0, breathability: 0.5, solar: 0,
      weightGrams: 500, removable: true, comfortRangeC: [-30, 20], shellGrade: 1,
    }
    return computeAssembly([item])
  }
  it('同一需求下，欠保暖的组合得分低于略微过暖的组合', () => {
    const under = scoreAssembly(mk(1.5), demand, { requiredClo: 2.0, designHourTempC: 10 })
    const over = scoreAssembly(mk(2.5), demand, { requiredClo: 2.0, designHourTempC: 10 })
    expect(over).toBeGreaterThan(under)
  })
  it('目标不再是固定 1.0 clo：同一套衣服在恰好匹配的场景得分严格更高', () => {
    const a = mk(1.6)
    const cold = scoreAssembly(a, demand, { requiredClo: 2.6, designHourTempC: 10 })
    const mild = scoreAssembly(a, demand, { requiredClo: 1.6, designHourTempC: 10 })
    expect(mild).toBeGreaterThan(cold)
  })
})

describe('P0-5 槽位参数只有一个来源，且不静默截断', () => {
  it('第二保暖槽的触发阈值真的读配置（改 LAYERING 就改行为）', () => {
    const cold = planLayerSlots(
      { WARMTH: 96, WIND: 0, RAIN: 0, BREATHABILITY: 0, SOLAR: 0, REMOVABLE: 0 } as DemandVector,
      { requiredClo: LAYERING.secondInsulationClo - 0.2 },
    )
    const warm = planLayerSlots(
      { WARMTH: 96, WIND: 0, RAIN: 0, BREATHABILITY: 0, SOLAR: 0, REMOVABLE: 0 } as DemandVector,
      { requiredClo: LAYERING.secondInsulationClo + 0.2 },
    )
    expect(cold.filter((s) => s.role === 'INSULATION').length).toBe(1)
    expect(warm.filter((s) => s.role === 'INSULATION').length).toBe(2)
  })

  it('预算紧张时外层优先，第二保暖层让位（不静默丢外层）', () => {
    const original = LAYERING.maxLayers
    ;(LAYERING as { maxLayers: number }).maxLayers = 4
    try {
      const slots = planLayerSlots(
        { WARMTH: 96, WIND: 90, RAIN: 90, BREATHABILITY: 0, SOLAR: 0, REMOVABLE: 60 } as DemandVector,
        { requiredClo: 3.0 },
      )
      expect(slots.length).toBeLessThanOrEqual(4)
      expect(slots.some((s) => s.role === 'PROTECTION')).toBe(true)
    } finally {
      ;(LAYERING as { maxLayers: number }).maxLayers = original
    }
  })
})

describe('P0-6 穿雨具与带伞共用同一组降水事实', () => {
  it('室内活动不再把防雨需求抹成 0：通勤窗口有雨时需求 > 0', () => {
    const r = planAt({ mean: 14, amp: 4, rainChance: 70, rainMmPerHour: 0.8 }, { activity: 'OFFICE' })
    expect(r.demand.vector.RAIN).toBeGreaterThan(0)
  })

  it('说不用带伞却又要求穿雨衣 = 矛盾，不允许出现', () => {
    for (const chance of [0, 30, 60, 90]) {
      const r = planAt({ mean: 14, amp: 4, rainChance: chance, rainMmPerHour: chance >= 60 ? 1 : 0 })
      const rain = r as ReturnType<typeof plan> & {
        rainPlan?: { carry: string; wearShell: boolean; facts: { commuteMaxLegChance: number } }
      }
      if (rain.rainPlan!.carry === 'SKIP') expect(rain.rainPlan!.wearShell).toBe(false)
      // 「穿」的结论必须引用与「带」同一组窗口事实
      expect(rain.rainPlan!.facts.commuteMaxLegChance).toBeGreaterThanOrEqual(0)
    }
  })
})

describe('P0-7 枚举一致 + 缺失值不越界', () => {
  it('ACTIVITY 与 SELECTABLE_ACTIVITIES 双向差集为空', () => {
    const engine = Object.keys(ACTIVITY).sort()
    const ui = SELECTABLE_ACTIVITIES.map((a) => a.value).sort()
    expect(ui).toEqual(engine)
  })

  it('缺数据的通勤窗口不产生负概率，也不抹掉另一段的有效信号', () => {
    const report = makeReport({ mean: 14, rainChance: 40 })
    // 出门段整点概率缺失（-1 = 未知），回家段 40% 是有效信号；全天概率也拿不到
    const h = report.hourly.map((p) => ({ ...p }))
    h[8] = { ...h[8], precipitationProbabilityPercent: -1 }
    const daily: [WeatherReport['daily'][number], WeatherReport['daily'][number]] = [
      { ...report.daily[0], rainChancePercent: -1 },
      { ...report.daily[1], rainChancePercent: -1 },
    ]
    const patched: WeatherReport = { ...report, hourly: h, daily }
    const a = assessUmbrella({
      ctx: buildWeatherContext(patched),
      nextDayRainChance: patched.daily[1].rainChancePercent,
      activity: 'WALKING' as ActivityKind,
      settings: settings(),
      now: new Date(`${DATE}T07:00:00`),
    })
    for (const leg of a.legs) {
      expect(leg.probability).toBeGreaterThanOrEqual(0)
      expect(leg.probability).toBeLessThanOrEqual(100)
    }
    expect(a.probability).toBeGreaterThanOrEqual(0)
    expect(a.probability).toBeLessThanOrEqual(100)
    // 回家段有 40% 的明确逐时信号，总结论不该被缺失段压成 0
    expect(a.legs[1].probability).toBeGreaterThan(0)
    expect(a.probability).toBeGreaterThan(0)
  })
})

describe('P0-8 全量输出无 NaN / 无越界', () => {
  it('跨温度与数据质量的网格：所有数字有限，0-100 字段在范围内', () => {
    const grid: Opts[] = [
      { mean: -22, amp: 3 }, { mean: 0, amp: 5, windMs: 14 }, { mean: 14, amp: 5, rainChance: 70, rainMmPerHour: 2 },
      { mean: 30, amp: 4, uvMax: 12, rh: 85 }, { mean: 10, amp: 5, hourly: false },
      { mean: 10, amp: 5, rh: -1, uvMax: -1 },
    ]
    for (const o of grid) {
      const r = planAt(o)
      const nums: number[] = [
        ...Object.values(r.demand.vector),
        r.thermal.operativeC, r.thermal.feelsLikeC, r.thermal.requiredIntrinsicClo, r.thermal.requiredMaxClo,
        r.dayOutfit.effectiveClo, r.dayOutfit.nominalClo, r.dayScore,
        r.umbrella.probability, r.umbrella.threshold, ...r.umbrella.legs.map((l) => l.probability),
      ]
      for (const n of nums) expect(Number.isFinite(n)).toBe(true)
      for (const d of Object.values(r.demand.vector)) {
        expect(d).toBeGreaterThanOrEqual(0)
        expect(d).toBeLessThanOrEqual(100)
      }
      expect(r.umbrella.probability).toBeGreaterThanOrEqual(0)
      expect(r.umbrella.probability).toBeLessThanOrEqual(100)
      expect(r.dayScore).toBeGreaterThanOrEqual(0)
      expect(r.dayScore).toBeLessThanOrEqual(100)
    }
  })
})
