// 第五步回归（方案 §8.2 / §7.3；遗留 1、2、3、5）：外壳水项条件化、极寒下装舒适窗、
// 逐时穿脱统一 + 滞回、beam 搜后精修。
// 判据写成性质（相对大小 / 集合包含 / 逐时一致性），不锁具体某件衣服；
// 修复前的实测读数写进注释（探针 W4 / W5R / W7），断言在修复前必红。
import { describe, expect, it } from 'vitest'
import { computeAssembly, scoreDetail } from './scoring'
import { neutralPrefs } from './prefs'
import { planAt } from './test-scenarios'
import { MATCHING } from '../config'
import type { ActivityKind, ClothingItem, DemandVector, LayerRole, OutfitAssembly } from '@/core/types'

const chosenIds = (r: ReturnType<typeof planAt>) =>
  r.dayOutfit.layers.flatMap((l) => l.items.map((i) => i.id)).sort()
const divScore = (r: ReturnType<typeof planAt>) =>
  r.scoreBreakdown.find((b) => b.key === 'diversity')!.score

const NEED = { requiredClo: 0.6, designHourTempC: 14 }

describe('S5-1 防护分项按真实需求条件化：没雨的天，防水性不产生排序信号', () => {
  const mkProt = (wind: number, water: number): OutfitAssembly => {
    const item: ClothingItem = {
      id: `p-${wind}-${water}`,
      name: '合成外壳',
      category: 'OUTER',
      role: 'PROTECTION',
      insulationClo: 0.3,
      wind,
      water,
      breathability: 0.5,
      solar: 0,
      weightGrams: 300,
      removable: true,
      comfortRangeC: [-10, 25],
    }
    return computeAssembly([item], ['PROTECTION'])
  }
  const protBucket = (wind: number, water: number, demand: DemandVector) =>
    scoreDetail(mkProt(wind, water), demand, NEED, neutralPrefs()).buckets.find((b) => b.key === 'protection')!.score

  const WIND_ONLY: DemandVector = { WARMTH: 0, WIND: 60, RAIN: 0, BREATHABILITY: 0, SOLAR: 0, REMOVABLE: 0 }
  const RAIN_HEAVY: DemandVector = { WARMTH: 0, WIND: 20, RAIN: 70, BREATHABILITY: 0, SOLAR: 0, REMOVABLE: 0 }
  const ALL_ZERO: DemandVector = { WARMTH: 0, WIND: 0, RAIN: 0, BREATHABILITY: 0, SOLAR: 0, REMOVABLE: 0 }

  it('纯风天：防风更强的件严格胜出（水项权重为 0）', () => {
    expect(protBucket(0.94, 0.3, WIND_ONLY)).toBeGreaterThan(protBucket(0.9, 1.0, WIND_ONLY))
  })

  it('纯风天：只差防水性的两件完全等分（水项被条件化掉，不产生信号）', () => {
    expect(protBucket(0.9, 0.3, WIND_ONLY)).toBe(protBucket(0.9, 1.0, WIND_ONLY))
  })

  it('雨天：防水强的件反超同等防风薄壳', () => {
    expect(protBucket(0.9, 1.0, RAIN_HEAVY)).toBeGreaterThan(protBucket(0.94, 0.3, RAIN_HEAVY))
  })

  it('三需求全零：防护桶回中性常数 16（20 × 0.8）', () => {
    expect(protBucket(0.5, 0.5, ALL_ZERO)).toBe(16)
  })
})

describe('S5-2 极寒下装舒适窗：设计时刻 ≥ −28℃ 不再走槽位放宽回退', () => {
  // 修复前（探针 W5R 复现）：mean −12（设计 −17）就已 unmet=[RELAXED_BASE,HARD_SLOTS_RELAXED]。
  it('设计时刻 −17℃：下装槽硬条件成立，unmet 不含任何 RELAXED 码', () => {
    const r = planAt({ mean: -12, amp: 5, windMs: 2 })
    expect(r.facts.designHourTempC).toBe(-17)
    expect(r.coverage.unmetNeeds).not.toContain('RELAXED_BASE')
    expect(r.coverage.unmetNeeds).not.toContain('HARD_SLOTS_RELAXED')
    expect(r.coverage.status).toBe('marginal')
  })

  it('设计时刻 −21℃：诚实标注偏薄，但归因是这套衣服，不是槽位被放宽', () => {
    const r = planAt({ mean: -16, amp: 5, windMs: 2 })
    expect(r.coverage.status).toBe('marginal')
    expect(r.coverage.unmetNeeds).toContain('OUTFIT_UNDERDRESSED')
    expect(r.coverage.unmetNeeds).not.toContain('RELAXED_BASE')
  })

  it('设计时刻 −27℃：库里真凑不够 → insufficient + CATALOG_INSUFFICIENT，不归因槽位放宽', () => {
    const r = planAt({ mean: -22, amp: 5, windMs: 2 })
    expect(r.coverage.status).toBe('insufficient')
    expect(r.coverage.unmetNeeds).toContain('CATALOG_INSUFFICIENT')
    expect(r.coverage.unmetNeeds).not.toContain('RELAXED_BASE')
  })
})

describe('S5-3 此刻穿着与时间线共用同一条逐时序列（§8.2）', () => {
  const SCENES: { tag: string; o: Parameters<typeof planAt>[0] }[] = [
    { tag: '春雨', o: { mean: 15, amp: 4, windMs: 3, rainChance: 70, rainMmPerHour: 1 } },
    { tag: '寒晨', o: { mean: 4, amp: 6, windMs: 3 } },
  ]

  for (const s of SCENES) {
    it(`${s.tag}：整点穿着只在时间线有事件的整点变化，方向与事件一致`, () => {
      const plans = Array.from({ length: 24 }, (_, h) => planAt(s.o, {}, h))
      // 时间线是穿戴序列的相邻差分；两场景事件数都 ≤ 6（片段上限），不存在被截断而漏事件的情况
      const timeline = plans[0].timeline
      expect(timeline.length).toBeGreaterThan(0)
      expect(timeline.length).toBeLessThanOrEqual(6)
      for (let h = 1; h < 24; h++) {
        const prev = [...plans[h - 1].wornNowRoles].sort()
        const cur = [...plans[h].wornNowRoles].sort()
        const hh = `${String(h).padStart(2, '0')}:00`
        for (const role of cur.filter((x) => !prev.includes(x))) {
          expect(
            timeline.some((e) => e.hour === hh && e.action === 'ADD' && e.role === role),
            `${s.tag} 第 ${h} 点加穿 ${role} 未出现在时间线`,
          ).toBe(true)
        }
        for (const role of prev.filter((x) => !cur.includes(x))) {
          expect(
            timeline.some((e) => e.hour === hh && e.action === 'REMOVE' && e.role === role),
            `${s.tag} 第 ${h} 点脱下 ${role} 未出现在时间线`,
          ).toBe(true)
        }
      }
    })
  }

  it('此刻组合与全天组合同源：只切 active，不换件；贴身层始终在身', () => {
    const r = planAt(SCENES[0].o, {}, 12)
    const dayIds = new Set(r.dayOutfit.layers.flatMap((l) => l.items.map((i) => i.id)))
    r.nowOutfit.layers.flatMap((l) => l.items).forEach((i) => expect(dayIds.has(i.id)).toBe(true))
    expect(r.wornNowRoles).toContain('BASE')
  })

  it('暖雨天（22℃）：降水整点安全侧必须穿壳，雨停即脱；滞回不挡「下雨就穿」', () => {
    const o = { mean: 22, amp: 4, windMs: 2, rainChance: 70, rainMmPerHour: 1 }
    expect(planAt(o, {}, 8).wornNowRoles).toContain('PROTECTION')
    expect(planAt(o, {}, 12).wornNowRoles).not.toContain('PROTECTION')
    const tl = planAt(o, {}, 0).timeline
    expect(tl.some((e) => e.hour === '08:00' && e.action === 'ADD' && e.role === 'PROTECTION')).toBe(true)
    expect(tl.some((e) => e.hour === '09:00' && e.action === 'REMOVE' && e.role === 'PROTECTION')).toBe(true)
    expect(tl.some((e) => e.hour === '18:00' && e.action === 'ADD' && e.role === 'PROTECTION')).toBe(true)
  })
})

describe('S5-4 beam 搜后精修：前缀剪枝丢掉的组合必须被单件替换补齐', () => {
  it('纯风 10m/s（T6w）：产品配置追平全枚举（差 ≤ 1），关掉精修立刻掉档', { timeout: 30_000 }, () => {
    // 第五步复核读数（宽度 64）：产品 82.8、全枚举 83.1、关精修 80.8（差 2.0，精修确实在补分）。
    // 旧「beam=32 严格优于贪心」口径已废弃：宽度与精修都会挪动局部最优起点，两者并列互有 0.1 级胜负。
    const o = { mean: 14, amp: 8, windMs: 10, rainChance: 0 }
    const product = planAt(o).dayScore
    const origBeam = MATCHING.beamWidth
    const origPolish = MATCHING.polishPasses
    let exhaustive: number
    let noPolish: number
    try {
      ;(MATCHING as { beamWidth: number }).beamWidth = 20000
      exhaustive = planAt(o).dayScore
      ;(MATCHING as { beamWidth: number }).beamWidth = origBeam
      ;(MATCHING as { polishPasses: number }).polishPasses = 0
      noPolish = planAt(o).dayScore
    } finally {
      ;(MATCHING as { beamWidth: number }).beamWidth = origBeam
      ;(MATCHING as { polishPasses: number }).polishPasses = origPolish
    }
    expect(product).toBeGreaterThanOrEqual(exhaustive - 1)
    // 精修必须真实起效：关掉它这个场景要掉 ≥ 1 分（宽度 64 实测 82.8 → 80.8）
    expect(product - noPolish).toBeGreaterThanOrEqual(1)
  })

  it('北方寒潮（−12℃±4、11 m/s、老人怕冷）：极寒多槽换装不再输给全枚举', { timeout: 30_000 }, () => {
    // 宽度复核的判别场景：宽度 32 时最优路径前缀排第 33~64 位，产品 57.1 对比全枚举 62.8（差 5.7）；
    // 宽度 64 起收敛到全枚举。若把 beamWidth 改回 32，本用例必红。
    const o = { mean: -12, amp: 4, windMs: 11 }
    const s = { profile: 'ELDERLY' as const, sensitivity: 'COLD_SENSITIVE' as const }
    const product = planAt(o, s).dayScore
    const orig = MATCHING.beamWidth
    let exhaustive: number
    try {
      ;(MATCHING as { beamWidth: number }).beamWidth = 20000
      exhaustive = planAt(o, s).dayScore
    } finally {
      ;(MATCHING as { beamWidth: number }).beamWidth = orig
    }
    expect(product).toBeGreaterThanOrEqual(exhaustive - 1)
  })
})

describe('S5-5 多样性分项：无历史中性满分，有历史按重合度计', () => {
  it('无 previousItemIds：多样性满分 3，分项和仍等于 dayScore', () => {
    const r = planAt({ mean: 12, amp: 4, windMs: 2 })
    expect(divScore(r)).toBe(3)
    const sum = r.scoreBreakdown.reduce((s, b) => s + b.score, 0)
    expect(Math.abs(sum - r.dayScore)).toBeLessThanOrEqual(0.2)
  })

  it('重合度计分（单元）：全同 0 分、三件一件沿用 2.0、全换满分', () => {
    const base = planAt({ mean: 12, amp: 4, windMs: 2 })
    const items = base.dayOutfit.layers.flatMap((l) => l.items)
    const roles = base.dayOutfit.layers.flatMap((l) => l.items.map(() => l.role))
    const asm = computeAssembly(items, roles as LayerRole[])
    const need = { requiredClo: base.coverage.requiredClo, designHourTempC: base.facts.designHourTempC }
    const divOf = (prev: string[] | null) =>
      scoreDetail(asm, base.demand.vector, need, { ...neutralPrefs(), previousItemIds: prev }).buckets.find(
        (b) => b.key === 'diversity',
      )!.score
    expect(divOf(chosenIds(base))).toBe(0)
    expect(divOf([chosenIds(base)[0]])).toBe(2)
    expect(divOf(['zzz1', 'zzz2', 'zzz3'])).toBe(3)
  })

  it('无关旧 id 不挡新件：搜索结果与无历史时一致', () => {
    const base = planAt({ mean: 12, amp: 4, windMs: 2 })
    const unrelated = planAt({ mean: 12, amp: 4, windMs: 2 }, { previousItemIds: ['zzz1', 'zzz2', 'zzz3'] })
    expect(chosenIds(unrelated)).toEqual(chosenIds(base))
    expect(divScore(unrelated)).toBe(3)
  })
})

describe('S5-6 稳定性：天气小波动沿用旧组合，大变化和雨天安全升级不受影响', () => {
  it('12℃ → 13℃：旧组合仍逐槽合格且分差在让步内，继续穿（多样性 0）', () => {
    // 实测读数（基础分口径，已剔除多样性），宽度 64：旧组合 79.7、新搜最优 81.5，差 1.8 ≤ 让步 3 → 复用。
    // 若把多样性留在比对里：新搜那套三件全换、白得 +3，gap 变 4.8 就会被误换（B2 修复点）。
    const r1 = planAt({ mean: 12, amp: 4, windMs: 2 })
    const r2 = planAt({ mean: 13, amp: 4, windMs: 2 }, { previousItemIds: chosenIds(r1) })
    expect(chosenIds(r2)).toEqual(chosenIds(r1))
    expect(divScore(r2)).toBe(0)
    const sum = r2.scoreBreakdown.reduce((s, b) => s + b.score, 0)
    expect(Math.abs(sum - r2.dayScore)).toBeLessThanOrEqual(0.2)
  })

  it('12℃ → -5℃：旧组合不再合格，必须整套换', () => {
    const r1 = planAt({ mean: 12, amp: 4, windMs: 2 })
    const r5 = planAt({ mean: -5, amp: 4, windMs: 2 }, { previousItemIds: chosenIds(r1) })
    expect(chosenIds(r5)).not.toEqual(chosenIds(r1))
    // 实测读数：-5℃ 的 5 件里只有发热上衣 1 件与 12℃ 组重合 → 新颖度 4/5 → 2.4 分
    expect(divScore(r5)).toBe(2.4)
  })

  it('晴天组合 → 雨天：旧组合没壳被拒，安全升级优先（必穿防水壳、不被放宽）', () => {
    const sunny = planAt({ mean: 20, amp: 4, windMs: 2 })
    const rain = planAt(
      { mean: 15, amp: 4, windMs: 2, rainChance: 70, rainMmPerHour: 1 },
      { previousItemIds: chosenIds(sunny) },
    )
    const prot = rain.dayOutfit.layers.find((l) => l.role === 'PROTECTION')
    expect(prot).toBeTruthy()
    expect(prot!.items[0].water).toBeGreaterThanOrEqual(0.9)
    expect(rain.coverage.unmetNeeds).not.toContain('RELAXED_PROTECTION')
    expect(chosenIds(rain)).not.toEqual(chosenIds(sunny))
  })
})

describe('S5-7 场景矩阵：一致性闸门（7 温度 × 雨 × 3 风 × 2 UV × 9 活动 = 756 组）', () => {
  it('全部场景满足：分数域、分项和=dayScore、件不重复、覆盖判定同向、雨天壳在场', { timeout: 120_000 }, () => {
    const temps = [-15, -5, 0, 8, 15, 25, 33]
    const rains = [
      { chance: 0, mm: 0 },
      { chance: 70, mm: 1 },
    ]
    const winds = [1, 6, 12]
    const uvs = [1, 9]
    const acts: ActivityKind[] = [
      'HOME', 'OFFICE', 'CLASS', 'WALKING', 'CYCLING', 'RUNNING', 'OUTDOOR_WORK', 'OUTDOOR_LEISURE', 'DRIVING',
    ]
    const coverage = { adequate: 0, marginal: 0, insufficient: 0, unknown: 0 }
    let n = 0
    for (const t of temps) {
      for (const rain of rains) {
        for (const w of winds) {
          for (const uv of uvs) {
            for (const act of acts) {
              const o = {
                mean: t,
                amp: Math.min(4, Math.max(0, 40 - Math.abs(t))),
                windMs: w,
                rainChance: rain.chance,
                rainMmPerHour: rain.mm,
                uvMax: uv,
              }
              const r = planAt(o, { activity: act })
              n++
              const label = `${t}℃/雨${rain.mm}/${w}m/s/uv${uv}/${act}`
              // 分数域
              expect(Number.isFinite(r.dayScore), label).toBe(true)
              expect(r.dayScore, label).toBeGreaterThanOrEqual(0)
              expect(r.dayScore, label).toBeLessThanOrEqual(100)
              for (const b of r.scoreBreakdown) {
                expect(Number.isFinite(b.score), `${label}/${b.key}`).toBe(true)
                expect(b.score, `${label}/${b.key}`).toBeGreaterThanOrEqual(0)
                expect(b.score, `${label}/${b.key}`).toBeLessThanOrEqual(b.max)
              }
              const sum = r.scoreBreakdown.reduce((s, b) => s + b.score, 0)
              expect(Math.abs(sum - r.dayScore), label).toBeLessThanOrEqual(0.2)
              // 件不重复；贴身层两份从不下线
              const ids = chosenIds(r)
              expect(new Set(ids).size, label).toBe(ids.length)
              const baseItems = r.dayOutfit.layers.filter((l) => l.role === 'BASE').flatMap((l) => l.items)
              expect(baseItems.length, label).toBeGreaterThanOrEqual(2)
              // 覆盖判定与放宽同向：合格 ⇒ 无未满足项；放宽 ⇒ 只能是不足
              if (r.coverage.status === 'adequate') expect(r.coverage.unmetNeeds, label).toEqual([])
              if (r.coverage.status === 'insufficient') expect(r.coverage.unmetNeeds.length, label).toBeGreaterThan(0)
              if (r.coverage.status === 'unknown') expect(r.facts.hasHourly, label).toBe(false)
              if (r.coverage.unmetNeeds.some((c) => c.startsWith('RELAXED_'))) {
                expect(r.coverage.status, label).toBe('insufficient')
              }
              // 雨天安全侧：防水槽硬条件成立时，选中的壳必须真防水，绝不放宽
              if (r.demand.vector.RAIN > 32 && !r.coverage.unmetNeeds.includes('RELAXED_PROTECTION')) {
                const prot = r.dayOutfit.layers.find((l) => l.role === 'PROTECTION')
                expect(prot, label).toBeTruthy()
                expect(prot!.items[0].water, label).toBeGreaterThanOrEqual(0.9)
              }
              coverage[r.coverage.status]++
            }
          }
        }
      }
    }
    console.log(`S5-7|plans=${n}|coverage=${JSON.stringify(coverage)}`)
    expect(n).toBe(756)
  })
})
