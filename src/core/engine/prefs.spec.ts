// 反馈闭环补口（方案 §6.1 第 4 条）与「上一套」写回语义（deck 15 的沿用那套）
// 判据：只有「很合适」放宽复用容差且封顶；撤销整批；跨天才抬升、同天不污染显示分
import { describe, expect, it } from 'vitest'
import {
  applyFeedback,
  dateKey,
  recordShown,
  resolvePrefs,
  revokeLastFeedback,
  rollPreviousItems,
  sameIds,
} from './prefs'
import { DEFAULT_SETTINGS, type FeedbackEntry, type FeedbackKind, type UserSettings } from '@/core/types'

const base = (over: Partial<UserSettings> = {}): UserSettings => ({ ...DEFAULT_SETTINGS, ...over })
const hist = (...kinds: FeedbackKind[]): FeedbackEntry[] =>
  kinds.map((kind, i) => ({ kind, at: `2026-09-2${i}` }))

describe('reuseBonus：只有「很合适」放宽复用容差，小步、有上限', () => {
  it('默认 0；1 条 +1；2 条 +2；5 条仍 +2（封顶）', () => {
    expect(resolvePrefs(base()).reuseBonus).toBe(0)
    expect(resolvePrefs(base({ feedbackHistory: hist('JUST_RIGHT') })).reuseBonus).toBe(1)
    expect(resolvePrefs(base({ feedbackHistory: hist('JUST_RIGHT', 'JUST_RIGHT') })).reuseBonus).toBe(2)
    expect(resolvePrefs(base({ feedbackHistory: hist(...Array(5).fill('JUST_RIGHT' as const)) })).reuseBonus).toBe(2)
  })

  it('其他反馈不放宽容差', () => {
    expect(resolvePrefs(base({ feedbackHistory: hist('COLD', 'HOT', 'STUFFY', 'OFF_OCCASION') })).reuseBonus).toBe(0)
  })
})

describe('撤销：同一次点击的多条一起撤', () => {
  it('HOT+STUFFY 同刻两条视为一批：先撤掉最后一条 COLD，再撤两条一起走', () => {
    const t = '2026-10-09T09:00:00.000Z'
    let s = base()
    s = applyFeedback(s, 'HOT', t)
    s = applyFeedback(s, 'STUFFY', t)
    s = applyFeedback(s, 'COLD', '2026-10-09T10:00:00.000Z')
    expect(s.feedbackHistory).toHaveLength(3)
    const after = revokeLastFeedback(s)
    expect(after.feedbackHistory).toHaveLength(2)
    expect(revokeLastFeedback(after).feedbackHistory).toHaveLength(0)
  })
})

describe('dateKey：本地日期键', () => {
  it('YYYY-MM-DD 补零', () => {
    expect(dateKey(new Date(2026, 0, 5))).toBe('2026-01-05')
    expect(dateKey(new Date(2026, 9, 9, 23, 59))).toBe('2026-10-09')
  })
})

describe('「上一套」写回：跨天才抬升，同天不污染', () => {
  const shownYesterday = base({
    previousItemIds: ['old1'],
    lastShown: { ids: ['y1', 'y2'], date: '2026-10-08' },
  })

  it('新的一天：previousItemIds 抬成昨天最后展示的一套', () => {
    expect(rollPreviousItems(shownYesterday, '2026-10-09')?.previousItemIds).toEqual(['y1', 'y2'])
  })

  it('同一天内不再抬升（今天的分对比的是昨天那套，不是自己）', () => {
    expect(rollPreviousItems(shownYesterday, '2026-10-08')).toBe(null)
  })

  it('值已到位时幂等（不会反复写）', () => {
    const done = base({ previousItemIds: ['y1', 'y2'], lastShown: { ids: ['y1', 'y2'], date: '2026-10-08' } })
    expect(rollPreviousItems(done, '2026-10-09')).toBe(null)
  })

  it('没有展示记录：不动', () => {
    expect(rollPreviousItems(base(), '2026-10-09')).toBe(null)
  })

  it('recordShown：空件不写；无变化不写；变化写整套+日期；跨天补日期', () => {
    expect(recordShown(base(), [], '2026-10-09')).toBe(null)
    const first = recordShown(base(), ['a1', 'a2'], '2026-10-09')
    expect(first?.lastShown).toEqual({ ids: ['a1', 'a2'], date: '2026-10-09' })
    expect(recordShown(first!, ['a1', 'a2'], '2026-10-09')).toBe(null)
    const second = recordShown(first!, ['b1', 'b2'], '2026-10-09')
    expect(second?.lastShown).toEqual({ ids: ['b1', 'b2'], date: '2026-10-09' })
    expect(recordShown(second!, ['b1', 'b2'], '2026-10-10')?.lastShown).toEqual({ ids: ['b1', 'b2'], date: '2026-10-10' })
  })
})

describe('sameIds：不看重顺序', () => {
  it('长度与成员都相同才相等', () => {
    expect(sameIds(['a', 'b'], ['b', 'a'])).toBe(true)
    expect(sameIds([], [])).toBe(true)
    expect(sameIds(['a'], ['a', 'b'])).toBe(false)
    expect(sameIds(['a'], ['c'])).toBe(false)
  })
})
