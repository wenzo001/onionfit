// 覆盖情况文案回归：四种状态各自的结论句、数字行、补救清单与置信度口径
// 口径来自方案 §5.2（目录无法覆盖 / 减少暴露 / 更高等级装备）与设计 deck 12，断言独立于实现表
import { describe, expect, it } from 'vitest'
import { plan } from '@/core/engine/planner'
import { makeReport, planAt, settings } from '@/core/engine/test-scenarios'
import { UMBRELLA } from '@/core/config'
import { closetGapWords, coverageCopy, type CoverageIcon } from './index'
import type { CoverageStatus } from '@/core/types'

describe('closetGapWords：clo 缺口折算分档', () => {
  it('≈ 一件轻中层起报，0.7 以上升级为厚羽绒档；再小不折算', () => {
    expect(closetGapWords(1.2)).toBe('约一件厚羽绒或一条加绒长裤')
    expect(closetGapWords(0.7)).toBe('约一件厚羽绒或一条加绒长裤')
    expect(closetGapWords(0.69)).toBe('约一件薄毛衣')
    expect(closetGapWords(0.4)).toBe('约一件薄毛衣')
    expect(closetGapWords(0.39)).toBeNull()
    expect(closetGapWords(0)).toBeNull()
  })
})

// 每态一个真实场景：极寒双缺 / 勉强够 / 够用 / 无逐时
const CASES: {
  label: string
  opts: Parameters<typeof planAt>[0]
  status: CoverageStatus
  icon: CoverageIcon
  tone: string
  title: string
}[] = [
  { label: '极寒双缺', opts: { mean: -22, amp: 3, windMs: 14 }, status: 'insufficient', icon: '!', tone: 'pink', title: '现有的衣服不够用' },
  { label: '勉强够', opts: { mean: 8, amp: 4 }, status: 'marginal', icon: '~', tone: 'yellow', title: '刚好够，没有余量' },
  { label: '够用', opts: { mean: 2, amp: 4 }, status: 'adequate', icon: '✓', tone: 'mint', title: '够用' },
  { label: '无逐时', opts: { mean: 15, amp: 5, hourly: false }, status: 'unknown', icon: '?', tone: 'paper', title: '拿不到足够数据' },
]

describe('coverageCopy：四态各自成立且互不串味', () => {
  it('场景网格确实产出四种状态，且图标/色调/标题两两不同', () => {
    const seen = CASES.map((c) => coverageCopy(planAt(c.opts)))
    expect(seen.map((s) => s.status)).toEqual(CASES.map((c) => c.status))
    expect(new Set(seen.map((s) => s.icon)).size).toBe(4)
    expect(new Set(seen.map((s) => s.title)).size).toBe(4)
  })

  for (const c of CASES) {
    it(`${c.label} → ${c.status}：图标/色调/标题成套`, () => {
      const copy = coverageCopy(planAt(c.opts))
      expect(copy.status).toBe(c.status)
      expect(copy.icon).toBe(c.icon)
      expect(copy.tone).toBe(c.tone)
      expect(copy.title).toBe(c.title)
      expect(copy.line.length).toBeGreaterThan(0)
      expect(copy.scope.length).toBeGreaterThan(0)
      expect(copy.trust.factors).toHaveLength(2)
    })
  }

  it('极寒双缺：数字行给「需要/这套给/还差」，库容量另说，补救含减少暴露与更高等级装备', () => {
    const rec = planAt({ mean: -22, amp: 3, windMs: 14 })
    const copy = coverageCopy(rec)
    expect(copy.rows).not.toBeNull()
    const rows = copy.rows!
    expect(rows.map((r) => r.label)).toEqual(['需要', '这套给', '还差'])
    expect(rows[0].value).toBe(`${rec.coverage.requiredClo} clo`)
    expect(rows[1].value).toBe(`${rec.coverage.availableClo} clo`)
    expect(rows[2].value).toBe(`${rec.coverage.deficitClo} clo`)
    expect(copy.line).toContain(rows[0].value)
    expect(copy.line).toContain(rows[1].value)
    // 库容量是另一回事：就算全穿最厚的也差
    expect(copy.catalogLine).toContain('库里最厚')
    expect(copy.catalogLine).toContain(`${rec.coverage.capacityClo} clo`)
    const titles = copy.fixes.map((f) => f.title)
    expect(titles).toContain('缩短户外时间')
    expect(titles).toContain('添置更高等级的单品')
    expect(copy.fixes.length).toBeLessThanOrEqual(3)
  })

  it('勉强够：数字行收在「余量」上，补救只提换厚档位', () => {
    const copy = coverageCopy(planAt({ mean: 8, amp: 4 }))
    expect(copy.rows!.map((r) => r.label)).toEqual(['需要', '这套给', '余量'])
    expect(copy.catalogLine).toBeNull()
    expect(copy.fixes.map((f) => f.title)).toEqual(['换上更厚的档位'])
  })

  it('够用：不给补救清单，也不提库容量（没有要补的）', () => {
    const copy = coverageCopy(planAt({ mean: 2, amp: 4 }))
    expect(copy.line).toContain('余量')
    expect(copy.rows!.map((r) => r.label)).toEqual(['需要', '这套给', '余量'])
    expect(copy.catalogLine).toBeNull()
    expect(copy.fixes).toHaveLength(0)
  })

  it('无逐时：不装数字，只给「连上网再算」与降级后的置信度', () => {
    const rec = planAt({ mean: 15, amp: 5, hourly: false })
    expect(rec.coverage.status).toBe('unknown')
    expect(rec.facts.hasHourly).toBe(false)
    const copy = coverageCopy(rec)
    expect(copy.rows).toBeNull()
    expect(copy.line).toContain('逐时')
    expect(copy.trust.percent).toBe(40)
    expect(copy.trust.factors[0]).toBe('无逐时预报 · 按日级估计')
    expect(copy.fixes.map((f) => f.title)).toEqual(['连上网再算一次'])
  })

  it('置信度百分号取整自 coverage.confidence，四种场景都对齐', () => {
    for (const c of CASES) {
      const rec = planAt(c.opts)
      expect(coverageCopy(rec).trust.percent).toBe(Math.round(rec.coverage.confidence * 100))
    }
  })
})

describe('coverageCopy：口径说明只说已发生的事实', () => {
  it('位置来自天气源 + 有日程：不提估算；北半球秋季成立', () => {
    const copy = coverageCopy(planAt({ mean: 15, amp: 5 }))
    expect(copy.trust.factors).toEqual(['有逐时预报', '位置来自天气源'])
    expect(copy.scope[0]).toBe('北半球 · 秋季')
    expect(copy.scope.join('｜')).not.toContain('估算')
  })

  it('没填通勤时间：默认时刻与 config 兜底一致（07:30 / 18:00）', () => {
    // 兜底常量本身也锁住：文案里的时刻必须跟它同源
    expect(UMBRELLA.fallbackOutMinutes).toBe(450)
    expect(UMBRELLA.fallbackHomeMinutes).toBe(1080)
    const copy = coverageCopy(planAt({ mean: 15, amp: 5 }, { outTime: null, homeTime: null }))
    expect(copy.scope.join('｜')).toContain('通勤时刻是估算的')
    expect(copy.scope.join('｜')).toContain('07:30 / 18:00')
  })

  it('位置缺失：置信度打对折，明确说没用气候带', () => {
    const rec = plan({
      report: { ...makeReport({ mean: 15, amp: 5 }), lat: NaN, lon: NaN },
      settings: settings(),
      now: new Date('2026-09-25T08:00:00'),
    })
    expect(rec.geo.dataSource).toBe('fallback')
    const copy = coverageCopy(rec)
    expect(copy.trust.factors[1]).toBe('位置缺失 · 通用模型')
    expect(copy.trust.percent).toBe(50)
    expect(copy.scope[0]).toBe('位置缺失，没有采用气候带')
  })
})
