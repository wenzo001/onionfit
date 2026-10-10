// 呈现专属件准入（deck 14 ⑩「不指定」不应给出性别专属款）：
// presentation 不含 UNISEX 的件（当前唯一：厚裙）只在用户显式选中该呈现时进入候选池与兜底，
// 未指定 / 中性 / 男性化下一律不出现；显式女性化时仍可达（准入不是把件从库里删掉）。
import { describe, expect, it } from 'vitest'
import { planAt } from './test-scenarios'
import type { OutfitRecommendation } from '@/core/types'

const SKIRT = 'i_skirt_thick'

const allIds = (r: OutfitRecommendation) =>
  r.dayOutfit.layers.flatMap((l) => l.items.map((i) => i.id))

/** 复现场景：厚裙舒适窗 [6, 24] + 轻 + 可脱卸，中冷天里它压过裤子进了 BOTTOM BASE 槽 */
const SCENE_A = { mean: 8, amp: 4, windMs: 2, rainChance: 0, uvMax: 2 }
const SCENE_B = { mean: 4, amp: 4 }

describe('S4-9 呈现专属件准入', () => {
  it('未指定（默认设置）：不得出现厚裙（多场景）', () => {
    expect(allIds(planAt(SCENE_A))).not.toContain(SKIRT)
    expect(allIds(planAt(SCENE_B))).not.toContain(SKIRT)
    expect(allIds(planAt(SCENE_B, { activity: 'RUNNING' }))).not.toContain(SKIRT)
  })

  it('显式中性 / 男性化：同样不得出现', () => {
    expect(allIds(planAt(SCENE_A, { presentation: 'NEUTRAL' }))).not.toContain(SKIRT)
    expect(allIds(planAt(SCENE_A, { presentation: 'MASCULINE' }))).not.toContain(SKIRT)
    expect(allIds(planAt(SCENE_B, { presentation: 'MASCULINE' }))).not.toContain(SKIRT)
  })

  it('显式女性化：厚裙仍可达（准入不是删库）', () => {
    const scenes = [SCENE_A, SCENE_B, { mean: 12, amp: 6 }, { mean: 16, amp: 5 }]
    const hit = scenes.some((sc) => allIds(planAt(sc, { presentation: 'FEMININE' })).includes(SKIRT))
    expect(hit).toBe(true)
  })

  it('准入只动呈现：未指定与女性化下需求向量 / 安全 / 带伞结论完全一致', () => {
    const a = planAt(SCENE_A)
    const b = planAt(SCENE_A, { presentation: 'FEMININE' })
    expect(b.demand.vector).toEqual(a.demand.vector)
    expect(JSON.stringify(b.safety)).toBe(JSON.stringify(a.safety))
    expect(JSON.stringify(b.umbrella)).toBe(JSON.stringify(a.umbrella))
  })
})
