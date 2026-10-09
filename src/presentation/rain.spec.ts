// 雨具两件事（deck 16）：要穿一侧按「穿衣侧实际给的那件」渲染（brief §11 遗留 4 的收口）
// 预期值 = 引擎实跑读数（planAt 固定场景），不手推；数字变化必须让这里红
import { describe, expect, it } from 'vitest'
import { planAt } from '@/core/engine/test-scenarios'
import { rainFacts, rainWearLine } from './index'

describe('rainWearLine：要穿一侧点名实际推荐件', () => {
  it('带伞 + 窗口有雨：点名穿衣侧实际给的硬壳冲锋衣（不再是写死的「雨衣」）', () => {
    const r = planAt({ rainChance: 70, rainMmPerHour: 0.8 })
    expect(r.umbrella.verdict).toBe('BRING')
    expect(r.rainPlan.wearShell).toBe(true)
    expect(rainWearLine(r)).toEqual({
      piece: { id: 'p_hardshell', name: '硬壳冲锋衣' },
      headline: '硬壳冲锋衣',
      detail: '通勤窗口 70% 有雨，外层挡一下',
    })
  })

  it('按实际推荐件渲染：换温度档后点名从硬壳换成防水冲锋衣，界面不写死件名', () => {
    const r = planAt({ mean: -10, amp: 5, windMs: 8, rainChance: 90 })
    expect(r.umbrella.verdict).toBe('BRING')
    expect(rainWearLine(r)).toEqual({
      piece: { id: 'p_swim_jacket', name: '防水冲锋衣' },
      headline: '防水冲锋衣',
      detail: '通勤窗口 90% 有雨，外层挡一下',
    })
  })

  it('大风否决：要穿的理由带出窗口事实 + 风否决，而不是只说「下雨要穿」', () => {
    const r = planAt({ rainChance: 90, windMs: 13 })
    expect(r.umbrella.verdict).toBe('RAINCOAT')
    expect(rainWearLine(r).detail).toBe('通勤窗口 90% 有雨，风 13 m/s —— 伞会翻')
  })

  it('大雨否决：换雨强那条理由，不复用风的话术', () => {
    const r = planAt({ rainChance: 90, rainMmPerHour: 10 })
    expect(r.umbrella.verdict).toBe('RAINCOAT')
    expect(rainWearLine(r).detail).toBe('通勤窗口 90% 有雨，雨强 10 mm/h —— 伞挡不住')
  })

  it('不用带的日子不要求穿：要穿一侧给「不用特意穿」且不带件名', () => {
    const r = planAt({ rainChance: 10 })
    expect(r.umbrella.verdict).toBe('SKIP')
    expect(rainWearLine(r)).toEqual({
      piece: null,
      headline: '不用特意穿',
      detail: '通勤窗口 10% 有雨，外壳不用加',
    })
  })

  it('两条判定互相独立：带伞成立但雨没到穿防水的线，会同时出现「带伞」和「不用特意穿」', () => {
    const r = planAt({ rainChance: 35 })
    expect(r.umbrella.verdict).toBe('BRING')
    expect(r.rainPlan.wearShell).toBe(false)
    expect(rainWearLine(r).headline).toBe('不用特意穿')
    expect(rainWearLine(r).detail).toBe('通勤窗口 35% 有雨，外壳不用加')
  })

  it('无逐时：要穿的依据只报数据口径，不假装有逐时窗口数字', () => {
    const r = planAt({ rainChance: 70, rainMmPerHour: 2.5, hourly: false })
    expect(r.umbrella.confidence).toBe('DEGRADED')
    expect(rainWearLine(r).detail).toBe('无逐时 · 按全天雨量估')
    expect(rainWearLine(r).headline).toBe('硬壳冲锋衣')
  })
})

describe('rainFacts：两条结论共用的四格事实', () => {
  it('完整逐时：四格全部给数，值与 rainPlan.facts / legs 一致', () => {
    const r = planAt({ rainChance: 70, rainMmPerHour: 0.8 })
    expect(rainFacts(r, { out: '08:00', home: '18:00' })).toEqual([
      { key: 'chance', label: '小时降水概率', value: '70%' },
      { key: 'intensity', label: '雨强 / 累计雨量', value: '0.8 mm/h · 1.6 mm' },
      { key: 'commute', label: '出门 / 回程时段', value: '08:00 · 18:00' },
      { key: 'exposure', label: '户外暴露时长', value: '单段 18 min' },
    ])
  })

  it('暴露时长跟活动走：办公单段 12 min', () => {
    const r = planAt({ rainChance: 70, rainMmPerHour: 0.8 }, { activity: 'OFFICE' })
    const exposure = rainFacts(r, { out: '08:00', home: '18:00' }).find((c) => c.key === 'exposure')
    expect(exposure!.value).toBe('单段 12 min')
  })

  it('无逐时：概率格说「无逐时」，雨强格只留全天累计，不拿 0 冒充事实', () => {
    const r = planAt({ rainChance: 70, rainMmPerHour: 2.5, hourly: false })
    const chips = rainFacts(r, { out: '08:00', home: '18:00' })
    expect(chips.find((c) => c.key === 'chance')!.value).toBe('无逐时')
    expect(chips.find((c) => c.key === 'intensity')!.value).toBe('-- · 5 mm')
  })

  it('通勤时刻没设置：时段格回落到引擎兜底的 07:30 / 18:00（与带伞卡「估算」口径同源）', () => {
    const r = planAt({ rainChance: 70 }, { outTime: null, homeTime: null })
    expect(r.umbrella.assumed).toBe(true)
    const chips = rainFacts(r, { out: null, home: null })
    expect(chips.find((c) => c.key === 'commute')!.value).toBe('07:30 · 18:00')
  })

  it('两段都已过去：时段格仍给设置的出门/回家时刻，暴露格跟着此刻段', () => {
    const r = planAt({ rainChance: 70, rainMmPerHour: 0.8 }, {}, 22)
    expect(r.umbrella.legs).toHaveLength(1)
    expect(r.umbrella.legs[0].phase).toBe('NOW')
    const chips = rainFacts(r, { out: '08:00', home: '18:00' })
    expect(chips.find((c) => c.key === 'commute')!.value).toBe('08:00 · 18:00')
    expect(chips.find((c) => c.key === 'exposure')!.value).toBe('单段 18 min')
  })
})
