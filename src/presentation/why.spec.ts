// 为什么是这套（deck 13）回归：理由出处 / 分项行 / 安全独立线 / 反事实对比
// 口径来自设计 deck 13 与方案 §9（reasons[].source）+ §9「为什么推荐这件而不是另一件」；
// 反事实的每个数字都要求与引擎重算一致，不许出现「界面说自己算过」的断言
import { describe, expect, it } from 'vitest'
import { planAt } from '@/core/engine/test-scenarios'
import { CATALOG } from '@/core/catalog'
import { computeAssembly, scoreDetail as engineScoreDetail } from '@/core/engine/scoring'
import { resolvePrefs } from '@/core/engine/prefs'
import {
  BUCKET_LABEL,
  STYLE_LABEL,
  WHY_SOURCE_LABEL,
  scoreRows,
  scoreSafetyNote,
  thickAlternative,
  whyReasons,
} from './index'
import { settings as makeSettings } from '@/core/engine/test-scenarios'
import type { OutfitRecommendation } from '@/core/types'

const COLD_WINDY = { mean: 2, amp: 8, windMs: 6 }
const MILD_TOPPED = { mean: 12, amp: 5, windMs: 6 }
const EXTREME = { mean: -22, amp: 3, windMs: 14 }
const HOT = { mean: 25, amp: 5, windMs: 2 }
const DEEP_COLD = { mean: -5, amp: 5, windMs: 8 }

/** 所有引擎写下的理由句（扁平），用来证明界面没有自己造句 */
function engineSentences(r: OutfitRecommendation): string[] {
  return Object.values(r.demand.reasons).flat().filter((x): x is string => !!x)
}

describe('whyReasons：每条理由都标出处', () => {
  it('出处标签与方案 §9 source 对齐为 天气/个人/安全/风格', () => {
    expect(WHY_SOURCE_LABEL.weather).toBe('天气')
    expect(WHY_SOURCE_LABEL.profile).toBe('个人')
    expect(WHY_SOURCE_LABEL.safety).toBe('安全')
    expect(WHY_SOURCE_LABEL.style).toBe('风格')
  })

  it('天气行的句子全部来自引擎，没有界面自己造的话；最多 4 行', () => {
    const r = planAt(COLD_WINDY)
    const out = whyReasons(r, makeSettings())
    const weather = out.filter((x) => x.source === 'weather')
    expect(weather.length).toBeGreaterThan(0)
    expect(weather.length).toBeLessThanOrEqual(4)
    const mine = new Set(engineSentences(r))
    for (const w of weather) expect(mine.has(w.text)).toBe(true)
  })

  it('「当前运动自带风感」归到个人；办公（无自生风）时全篇不出现这句', () => {
    const walk = planAt(COLD_WINDY)
    const walkOut = whyReasons(walk, makeSettings())
    const selfWind = walkOut.find((x) => x.text === '当前运动自带风感')
    expect(selfWind).toBeDefined()
    expect(selfWind!.source).toBe('profile')
    expect(walkOut.filter((x) => x.source === 'weather').some((x) => x.text === '当前运动自带风感')).toBe(false)

    const office = planAt(COLD_WINDY, { activity: 'OFFICE' })
    const officeOut = whyReasons(office, makeSettings({ activity: 'OFFICE' }))
    expect(officeOut.some((x) => x.text === '当前运动自带风感')).toBe(false)
  })

  it('个人行带上活动名与暴露口径', () => {
    const r = planAt(COLD_WINDY)
    const out = whyReasons(r, makeSettings())
    expect(out.some((x) => x.source === 'profile' && x.text === '选的是「步行」，户外暴露久，风雨按全程算')).toBe(true)
  })

  it('安全行 = 引擎预警原句 + 最大强制维的抬升数字', () => {
    const r = planAt(COLD_WINDY)
    const out = whyReasons(r, makeSettings())
    const safety = out.filter((x) => x.source === 'safety')
    expect(r.safety.level).toBe('WATCH')
    expect(safety[0].text).toBe(r.safety.warnings[0])
    expect(safety.length).toBeLessThanOrEqual(3)
    const top = (Object.entries(r.safety.forcedDemands) as [string, number][]).sort((a, b) => b[1] - a[1])[0]
    expect(safety.some((x) => x.text.includes(`被强制抬到 ${top[1]}`))).toBe(true)
  })

  it('两个维都被抬升时报最大的那个（95 而不是 50）', () => {
    const r = planAt(EXTREME)
    expect(r.safety.forcedDemands.WARMTH).toBe(95)
    expect(r.safety.forcedDemands.WIND).toBe(50)
    const safety = whyReasons(r, makeSettings()).filter((x) => x.source === 'safety')
    expect(safety.some((x) => x.text.includes('被强制抬到 95'))).toBe(true)
    expect(safety.some((x) => x.text.includes('被强制抬到 50'))).toBe(false)
  })

  it('风格行只在设置里真的选了风格/场合时出现，用的就是那套设置的标签', () => {
    const s = makeSettings({ styles: ['DAILY', 'KOREAN_CLEAN'], occasion: 'OFFICE' })
    const withStyle = planAt(COLD_WINDY, s)
    const out = whyReasons(withStyle, s)
    expect(out.some((x) => x.source === 'style' && x.text.includes('日常简约、韩系干净'))).toBe(true)
    expect(out.some((x) => x.source === 'style' && x.text.includes('办公'))).toBe(true)

    // 同一份结论，不传设置时风格行必须缺席（不能拿别处的风格冒充）
    expect(whyReasons(withStyle).some((x) => x.source === 'style')).toBe(false)
  })

  it('出处按 天气→个人→安全→风格 分组', () => {
    const s = makeSettings({ styles: ['DAILY'] })
    const out = whyReasons(planAt(COLD_WINDY, s), s)
    const order = [...new Set(out.map((x) => x.source))]
    expect(order).toEqual(['weather', 'profile', 'safety', 'style'])
  })

  it('没有任何需求项的日子给兜底行，不留空白', () => {
    const out = whyReasons(planAt({ mean: 18, amp: 1, windMs: 1, rh: 45, uvMax: 1 }))
    expect(out).toEqual([{ source: 'fallback', text: '今天没有突出的需求项，按中性组合配的' }])
  })
})

describe('scoreRows：8 个分项就是引擎 breakdown 的投影', () => {
  it('标签 = deck 13 的 8 项，顺序与引擎分项一致，值原样来自 scoreBreakdown', () => {
    const r = planAt(COLD_WINDY)
    const rows = scoreRows(r)
    expect(rows.map((x) => x.label)).toEqual(Object.values(BUCKET_LABEL))
    expect(rows).toHaveLength(8)
    expect(r.scoreBreakdown).toHaveLength(8)
    rows.forEach((row, i) => {
      const b = r.scoreBreakdown[i]
      expect(row.value).toBe(`${b.score}/${b.max}`)
    })
    expect(rows[0].label).toBe('热舒适 / 保暖匹配')
    expect(rows[7].label).toBe('多样性')
  })

  it('换一份 breakdown，行跟着变（纯投影，不重算不缓存）', () => {
    const r = planAt(COLD_WINDY)
    const tweaked = {
      ...r,
      scoreBreakdown: r.scoreBreakdown.map((b) => (b.key === 'style' ? { ...b, score: 12.3 } : b)),
    }
    expect(scoreRows(tweaked).find((x) => x.label.includes('风格'))!.value).toBe('12.3/18')
  })
})

describe('scoreSafetyNote：推荐分不是安全等级', () => {
  it('NORMAL 日：明说没有预警，等级独立成行', () => {
    const r = planAt(HOT)
    expect(r.safety.level).toBe('NORMAL')
    const note = scoreSafetyNote(r)
    expect(note.line).toContain(`${Math.round(r.dayScore)} 分只表示「这套和当前需求有多匹配」`)
    expect(note.line).toContain('今天 NORMAL，没有预警')
    expect(note.levelLine).toBe('安全等级 NORMAL · 独立于推荐分')
  })

  it('WATCH/DANGER 日：报预警条数，不说「没有预警」', () => {
    for (const opts of [COLD_WINDY, EXTREME]) {
      const r = planAt(opts)
      expect(r.safety.level).not.toBe('NORMAL')
      const note = scoreSafetyNote(r)
      expect(note.line).not.toContain('没有预警')
      expect(note.line).toContain(`今天 ${r.safety.level}，有 ${r.safety.warnings.length} 条预警`)
      expect(note.levelLine).toContain(`安全等级 ${r.safety.level}`)
    }
  })
})

describe('thickAlternative：反事实不许撒谎', () => {
  it('仪器自检：按 rec 重建的整套分就是 dayScore（need/prefs 口径无误差）', () => {
    for (const opts of [MILD_TOPPED, DEEP_COLD, EXTREME, HOT]) {
      const r = planAt(opts)
      const chosen = r.dayOutfit.layers.flatMap((l) => l.items)
      const roles = r.dayOutfit.layers.flatMap((l) => l.items.map(() => l.role))
      const base = computeAssembly(chosen, roles)
      const need = { requiredClo: r.coverage.requiredClo, designHourTempC: r.facts.designHourTempC }
      expect(base.effectiveClo).toBe(r.dayOutfit.effectiveClo)
      expect(engineScoreDetail(base, r.demand.vector, need, resolvePrefs(makeSettings())).total).toBe(r.dayScore)
    }
  })

  it('棉服被罚：脱不掉的后果写的是分数掉幅，不是需求数字', () => {
    const r = planAt(MILD_TOPPED)
    const alt = thickAlternative(r, makeSettings())!
    expect(alt).not.toBeNull()
    expect(alt.rejected.name).toBe('棉服')
    expect(alt.rejected.clo).toBe(1)
    expect(alt.rejected.note).toContain('它脱不掉，可脱卸分从 5 掉到 0')
    expect(alt.chosen.names).toBe('轻薄羽绒服 + 针织开衫')
    expect(alt.chosen.clo).toBe(1.3)
    expect(alt.chosen.note).toBe('正好够用，还能随时脱')
  })

  it('在极寒里反事实的结论仍成立：羽绒服更厚但不划算', () => {
    const r = planAt(EXTREME)
    const alt = thickAlternative(r, makeSettings())!
    expect(alt.rejected.name).toBe('羽绒服')
    expect(alt.chosen.note).toContain('还差')
    // 独立复算：把库里的「羽绒服」换上，分数必须真的低于当前这套
    const chosen = r.dayOutfit.layers.flatMap((l) => l.items)
    const roles = r.dayOutfit.layers.flatMap((l) => l.items.map(() => l.role))
    const altItem = CATALOG.find((it) => it.name === alt.rejected.name)!
    const kept = chosen.map((c, i) => ({ c, r: roles[i] })).filter((x) => x.c.category !== altItem.category)
    const swapped = computeAssembly(
      [...kept.map((x) => x.c), altItem],
      [...kept.map((x) => x.r), altItem.role],
    )
    const need = { requiredClo: r.coverage.requiredClo, designHourTempC: r.facts.designHourTempC }
    const altTotal = engineScoreDetail(swapped, r.demand.vector, need, resolvePrefs(makeSettings())).total
    expect(altTotal).toBeLessThan(r.dayScore)
  })

  it('回暖的账要算在「超过所需」上', () => {
    const r = planAt(COLD_WINDY)
    const alt = thickAlternative(r, makeSettings())!
    expect(alt.rejected.name).toBe('羽绒服')
    expect(alt.rejected.note).toContain(`超过所需的 ${r.coverage.requiredClo}`)
  })

  it('肩上没有这类活（盛夏）或已穿着最厚组合时，不给反事实', () => {
    expect(thickAlternative(planAt(HOT), makeSettings())).toBeNull()
    expect(thickAlternative(planAt(DEEP_COLD), makeSettings())).toBeNull()
  })

  it('穿在身上的件永远不许当「反面例子」', () => {
    const r = planAt(EXTREME)
    const wornNames = r.dayOutfit.layers.flatMap((l) => l.items.map((i) => i.name))
    const alt = thickAlternative(r, makeSettings())!
    expect(wornNames).not.toContain(alt.rejected.name)
    expect(alt.chosen.names.split(' + ').every((n) => wornNames.includes(n.replace('…', '')))).toBe(true)
  })
})

describe('风格标签表：与 deck / 设置里的名字同源', () => {
  it('覆盖全部 8 种风格，两个示名字与 deck 13 一致', () => {
    expect(Object.keys(STYLE_LABEL)).toHaveLength(8)
    expect(STYLE_LABEL.DAILY).toBe('日常简约')
    expect(STYLE_LABEL.KOREAN_CLEAN).toBe('韩系干净')
  })
})
