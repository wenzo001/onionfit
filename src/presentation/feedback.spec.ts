// 这套准吗（deck 15）回归：4 个反馈胶囊 / 最后一批换人话 / 滞回说明与活状态 / 沿用进「为什么是这套」
// 数字类期望写成字面量（0.1 / 0.3 / +2 分），不引用被测量的常量，防止口径漂移同源地一起漂
import { describe, expect, it } from 'vitest'
import { planAt } from '@/core/engine/test-scenarios'
import {
  FEEDBACK_CHIPS,
  FEEDBACK_FOOTNOTE,
  HYSTERESIS,
  WHY_SOURCE_LABEL,
  feedbackNote,
  hysteresisStateLine,
  lastFeedback,
  whyReasons,
} from './index'
import type { FeedbackEntry, FeedbackKind } from '@/core/types'

const e = (kind: FeedbackKind, at: string): FeedbackEntry => ({ kind, at })
const idsOf = (r: ReturnType<typeof planAt>) =>
  r.dayOutfit.layers.flatMap((l) => l.items.map((i) => i.id)).sort()

describe('4 个反馈胶囊（deck 15）', () => {
  it('标签与 deck 一致；「偏热 / 闷」一次点击同时记 HOT 与 STUFFY', () => {
    expect(FEEDBACK_CHIPS.map((c) => c.label)).toEqual(['偏冷', '偏热 / 闷', '不符合场合', '很合适'])
    expect(FEEDBACK_CHIPS[0].kinds).toEqual(['COLD'])
    expect(FEEDBACK_CHIPS[1].kinds).toEqual(['HOT', 'STUFFY'])
    expect(FEEDBACK_CHIPS[2].kinds).toEqual(['OFF_OCCASION'])
    expect(FEEDBACK_CHIPS[3].kinds).toEqual(['JUST_RIGHT'])
  })

  it('每句说明都报出步长与上限（字面量校对）', () => {
    expect(feedbackNote(['COLD'])).toBe('下次同样天气会多加 0.1 clo —— 上限 0.3 clo，不会一路加上去。')
    expect(feedbackNote(['HOT', 'STUFFY'])).toBe('下次同样天气会少要 0.1 clo、更看重透气 —— 上限各 0.3，不会一路加上去。')
    expect(feedbackNote(['OFF_OCCASION'])).toBe('下次同样场合会更看重正式度 —— 每步 0.1，上限 0.3，不会一路加上去。')
    expect(feedbackNote(['JUST_RIGHT'])).toBe('相似天气下更容易沿用这套 —— 每步 1 分，上限 2 分。')
  })

  it('脚注两条承诺都在：随时可撤销、不改安全阈值与天气事实', () => {
    expect(FEEDBACK_FOOTNOTE).toBe('只小步调整、设上下限、随时可撤销。单次反馈不改安全阈值，也不改天气事实。')
  })
})

describe('lastFeedback：把最后一批点击换成人话', () => {
  it('空历史 → null', () => {
    expect(lastFeedback(undefined)).toBe(null)
    expect(lastFeedback([])).toBe(null)
  })

  it('单条与同刻两条一批', () => {
    expect(lastFeedback([e('COLD', 't1')])?.label).toBe('偏冷')
    expect(lastFeedback([e('OFF_OCCASION', 't1')])?.label).toBe('不符合场合')
    expect(lastFeedback([e('JUST_RIGHT', 't1')])?.label).toBe('很合适')
    const batch = lastFeedback([e('COLD', 't1'), e('HOT', 't2'), e('STUFFY', 't2')])
    expect(batch?.label).toBe('偏热 / 闷')
    expect(batch?.kinds).toEqual(['HOT', 'STUFFY'])
  })
})

describe('沿用进「为什么是这套」与滞回说明（deck 15 下半）', () => {
  const r1 = planAt({ mean: 12, amp: 4, windMs: 2 })
  const reused = planAt({ mean: 13, amp: 4, windMs: 2 }, { previousItemIds: idsOf(r1) })

  it('沿用当天：第一行理由是「沿用」，标签表同步', () => {
    expect(WHY_SOURCE_LABEL.stability).toBe('沿用')
    expect(reused.reusedPrevious).toBe(true)
    const out = whyReasons(reused)
    expect(out[0]).toEqual({
      source: 'stability',
      text: '轻微天气变化不换装：沿用上一套（逐槽仍合格，差异在容差内）',
    })
  })

  it('没沿用的日子不给这行', () => {
    expect(r1.reusedPrevious).toBe(false)
    expect(whyReasons(r1).some((x) => x.source === 'stability')).toBe(false)
  })

  it('滞回说明块三条 + 硬触发词', () => {
    expect(HYSTERESIS.title).toBe('轻微天气变化不换装')
    expect(HYSTERESIS.example).toBe('昨天 12° 薄毛衣 + 外套 → 今天 11° 沿用那套')
    expect(HYSTERESIS.upgrade).toBe('只有明显改善舒适度、新增安全要求、或原方案违反硬约束时，才允许大幅换装')
    expect(HYSTERESIS.urgent).toBe('暴雨 / 强风 / 极端温度 / UV 升高 → 立即调整，不等滞回')
  })

  it('hysteresisStateLine：沿用当天给活的状态句，否则 null', () => {
    expect(hysteresisStateLine(reused)).toBe('今天：沿用上一套（每层仍合格，差异在容差内）')
    expect(hysteresisStateLine(r1)).toBe(null)
  })
})
