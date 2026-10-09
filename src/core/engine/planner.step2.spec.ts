// 第二步回归（算法优化方案 §11-2 / §12-2）：反季过滤 + 上下装协调 + 目录语义
// 判据写成"性质"，不锁具体某件衣服，目录更新不写脆。
import { describe, expect, it } from 'vitest'
import { CATALOG } from '../catalog'
import { MATCHING } from '../config'
import { planLayerSlots, type EnsembleNeed } from './layering'
import { matchCandidates } from './matching'
import { assembleOutfit, computeAssembly, scoreAssembly } from './scoring'
import { planAt } from './test-scenarios'
import type { ClothingItem, DemandVector } from '@/core/types'

/** 反季容忍度：故意在测试里写字面量，产品常量被改小也必须先红 */
const SEASON_TOL_C = 6

describe('S2-1 反季衣物不得入选（短袖/短裤不进深秋隆冬场景）', () => {
  for (const mean of [6, 8, 10, 12]) {
    it(`${mean}℃：所有选中件的舒适窗都罩得住设计时刻（±${SEASON_TOL_C}℃）`, () => {
      const r = planAt({ mean, amp: 5 })
      const design = r.facts.designHourTempC
      const chosen = r.dayOutfit.layers.flatMap((l) => l.items)
      expect(chosen.length).toBeGreaterThan(0)
      for (const it of chosen) {
        const [lowC, highC] = it.comfortRangeC
        expect(lowC - SEASON_TOL_C).toBeLessThanOrEqual(design)
        expect(highC + SEASON_TOL_C).toBeGreaterThanOrEqual(design)
      }
    })
  }

  it('6℃：下装必须存在，且不是短裤/沙滩裤', () => {
    const r = planAt({ mean: 6, amp: 5 })
    const bottoms = r.dayOutfit.layers.flatMap((l) => l.items).filter((it) => it.category === 'BOTTOM')
    expect(bottoms.length).toBeGreaterThan(0)
    for (const it of bottoms) expect(['b_shorts', 'b_swim_short']).not.toContain(it.id)
  })
})

describe('S2-2 6℃ 的成套保暖量要贴近需求（此前逐槽取薄只给一半）', () => {
  it('6℃（日较差 5）：有效 clo ≥ 1.4', () => {
    const r = planAt({ mean: 6, amp: 5 })
    expect(r.dayOutfit.effectiveClo).toBeGreaterThanOrEqual(1.4)
  })
})

describe('S2-3 目录语义：快干不等于防水', () => {
  it('沙滩裤的 water 不高于 0.2（快干是排水，不是挡雨）', () => {
    const item = CATALOG.find((i) => i.id === 'b_swim_short')
    expect(item).toBeTruthy()
    expect(item!.water).toBeLessThanOrEqual(0.2)
  })

  it('干爽热天：整套组合的 water 不高于 0.3（不能带出防水属性）', () => {
    const r = planAt({ mean: 30, amp: 4 })
    expect(r.dayOutfit.water).toBeLessThanOrEqual(0.3)
  })
})

/** 测试内自算"离舒适窗的距离"，期望值不借产品实现推导 */
const distTo = (it: ClothingItem, t: number) => {
  const [lo, hi] = it.comfortRangeC
  return t < lo ? lo - t : t > hi ? t - hi : 0
}

describe('S2-4 上下装协调：冷场景下装过薄要被扣分（同一总保暖量下的净效应）', () => {
  const demand: DemandVector = {
    WARMTH: 100, WIND: 0, RAIN: 0, BREATHABILITY: 0, SOLAR: 0, REMOVABLE: 0,
  }
  const mkItem = (id: string, category: 'TOP' | 'BOTTOM', clo: number): ClothingItem => ({
    id,
    name: id,
    category,
    role: 'BASE',
    insulationClo: clo,
    wind: 0,
    water: 0,
    breathability: 0.6,
    solar: 0,
    weightGrams: 300,
    removable: false,
    comfortRangeC: [-30, 30],
  })
  // 两组打折后的有效总 clo 相同（0.364+0.08×0.85 = 0.16+0.32×0.85 = 0.432），
  // 仅在上下装之间分配不同：冷场景所需下装份额由 (onsetC - designTemp) × cloPerDegree 折算，
  // 薄下装组缺 0.24 clo × 60 = 14.4 分；其余评分项（重量/透气/风/水）两组逐项相同
  const thinLegs = computeAssembly([mkItem('top', 'TOP', 0.364), mkItem('thin', 'BOTTOM', 0.08)], ['BASE', 'BASE'])
  const warmLegs = computeAssembly([mkItem('top2', 'TOP', 0.16), mkItem('warm', 'BOTTOM', 0.32)], ['BASE', 'BASE'])

  it('0℃ 设计时刻：薄下装的组合得分严格低于下装达标的组合', () => {
    const need = { requiredClo: 1.5, designHourTempC: 0 }
    expect(scoreAssembly(warmLegs, demand, need)).toBeGreaterThan(scoreAssembly(thinLegs, demand, need))
  })

  it('24℃ 设计时刻：同款两组合得分相等（热天不得触发腿部惩罚）', () => {
    const need = { requiredClo: 0.3, designHourTempC: 24 }
    expect(scoreAssembly(warmLegs, demand, need)).toBe(scoreAssembly(thinLegs, demand, need))
  })
})

describe('S2-5 极寒兜底：合格池为空时按"离设计时刻最近"交付候选', () => {
  const allBottoms = CATALOG.filter((it) => it.role === 'BASE' && it.category === 'BOTTOM')
  const minDistAt = (t: number) => Math.min(...allBottoms.map((it) => distTo(it, t)))

  it('BASE/BOTTOM 槽在 -24℃ 设计时刻无一合格：候选首位是最接近的件（而非拟合分高的裙装）', () => {
    const demand: DemandVector = {
      WARMTH: 100, WIND: 0, RAIN: 0, BREATHABILITY: 0, SOLAR: 0, REMOVABLE: 0,
    }
    const need = { requiredClo: 3.8, designHourTempC: -24 }
    const slot = planLayerSlots(demand, need).find((s) => s.role === 'BASE' && s.category === 'BOTTOM')
    expect(slot).toBeTruthy()
    const pool = matchCandidates(demand, [slot!], need)[0]
    expect(pool.length).toBeGreaterThan(0)
    expect(distTo(pool[0], need.designHourTempC)).toBe(minDistAt(need.designHourTempC))
  })

  it('-22℃（日较差 5）全链路：选中下装是全库 BASE/BOTTOM 件里离设计时刻最近的', () => {
    const r = planAt({ mean: -22, amp: 5, windMs: 0 })
    const design = r.facts.designHourTempC
    const bottom = r.dayOutfit.layers.flatMap((l) => l.items).find((it) => it.category === 'BOTTOM')
    expect(bottom).toBeTruthy()
    expect(distTo(bottom!, design)).toBe(minDistAt(design))
  })
})

describe('S2-6 搜后精修必须追平全枚举（beam 前缀剪枝的落差由单件替换补齐）', () => {
  // 旧口径「beam=32 严格优于 beam=1」（68.6>65.3 / 69.6>64.0 / 76.4>76.2）在精修落地后不再成立：
  // 两条起点各跑一轮单件精修都收敛到同一局部最优（现读数 73.3 / 74.3 / 79.6，三方相等）。
  // 现在锁「产品配置（beam 32 + 精修）不劣于全枚举（beamWidth=20000）− 1」；
  // 缺陷的真实判别场景（纯风天 T6w：修复前 69 / 全枚举 80.1）在 planner.step5.spec.ts S5-4。
  const scenes: { name: string; demand: DemandVector; need: EnsembleNeed }[] = [
    {
      name: '6℃近似（保暖与重量取舍点）',
      demand: { WARMTH: 85, WIND: 0, RAIN: 0, BREATHABILITY: 10, SOLAR: 0, REMOVABLE: 60 },
      need: { requiredClo: 2.0, designHourTempC: 1 },
    },
    {
      name: '-8℃近似（厚薄分配取舍点）',
      demand: { WARMTH: 95, WIND: 0, RAIN: 0, BREATHABILITY: 0, SOLAR: 0, REMOVABLE: 60 },
      need: { requiredClo: 3.0, designHourTempC: -8 },
    },
    {
      name: '雨天近似（防水与轻便取舍点）',
      demand: { WARMTH: 60, WIND: 20, RAIN: 70, BREATHABILITY: 20, SOLAR: 0, REMOVABLE: 60 },
      need: { requiredClo: 1.1, designHourTempC: 14 },
    },
  ]

  for (const s of scenes) {
    it(`${s.name}：产品配置与全枚举得分差 ≤ 1`, () => {
      const slots = planLayerSlots(s.demand, s.need)
      const cands = matchCandidates(s.demand, slots, s.need)
      const observed = assembleOutfit(slots, cands, s.demand, s.need).score
      const orig = MATCHING.beamWidth
      let exhaustive: number
      try {
        ;(MATCHING as { beamWidth: number }).beamWidth = 20000
        exhaustive = assembleOutfit(slots, cands, s.demand, s.need).score
      } finally {
        ;(MATCHING as { beamWidth: number }).beamWidth = orig
      }
      expect(observed).toBeGreaterThanOrEqual(exhaustive - 1)
    })
  }
})
