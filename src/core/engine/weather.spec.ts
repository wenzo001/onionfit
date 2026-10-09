// 逐时时间戳解析回归（缺陷：非补零日期 → Invalid Date → hour NaN）。
// 现场：2026-10-9T00:00 这类不补零 ISO 串被 new Date 判为 Invalid Date，
// hour 变成 NaN，于是设计时刻显示「NaN:00」，暴露窗口也取不到整点样本、误报「无逐时」。
import { describe, expect, it } from 'vitest'
import { buildWeatherContext, localHourOf } from './weather'
import { plan } from './planner'
import { DATE, makeReport, settings } from './test-scenarios'
import type { WeatherReport } from '@/core/types'

/** 把逐时时间戳整体换成另一种写法（数据本身不动） */
function respell(report: WeatherReport, f: (hour: number) => string): WeatherReport {
  return {
    ...report,
    hourly: report.hourly.map((h) => ({ ...h, time: f(Number(h.time.slice(11, 13))) })),
  }
}

describe('localHourOf 按字面读整点', () => {
  it('不补零日期（2026-10-9T16:00）也读得出 16', () => {
    expect(localHourOf('2026-10-9T16:00')).toBe(16)
    expect(localHourOf('2026-10-9T00:00')).toBe(0)
  })

  it('带时区偏移时读的是城市当地时刻，不是设备时区换算后的时刻', () => {
    expect(localHourOf('2026-10-09T10:00+08:00')).toBe(10)
  })

  it('标准补零写法不受影响', () => {
    expect(localHourOf('2026-10-09T07:00')).toBe(7)
  })

  it('完全解析不出时退回序号，不返回 NaN', () => {
    expect(localHourOf('', 9)).toBe(9)
    expect(localHourOf('bad-time', 3)).toBe(3)
  })
})

describe('时间戳写法不改变结论（雨通勤场景）', () => {
  const opts = { rainChance: 62, rainMmPerHour: 1, mean: 8, amp: 4 }
  const at = (report: WeatherReport) =>
    plan({ report, settings: settings(), now: new Date(`${DATE}T08:00:00`) })

  const base = at(makeReport(opts))
  const variants: [string, WeatherReport][] = [
    ['不补零日期', respell(makeReport(opts), (h) => `2026-9-25T${String(h).padStart(2, '0')}:00`)],
    ['带 +08:00 偏移', respell(makeReport(opts), (h) => `${DATE}T${String(h).padStart(2, '0')}:00+08:00`)],
  ]

  it('标准写法本身是健康的：小时序列 0-23、有逐时结论', () => {
    const ctx = buildWeatherContext(makeReport(opts))
    expect(ctx.day.map((p) => p.hour)).toEqual(Array.from({ length: 24 }, (_, i) => i))
    expect(base.umbrella.confidence).toBe('HOURLY')
    expect(Number.isFinite(base.thermal.maxRequiredCloHour)).toBe(true)
  })

  for (const [label, report] of variants) {
    it(`${label}：整条链路与标准写法逐项一致，且无 NaN`, () => {
      const ctx = buildWeatherContext(report)
      expect(ctx.day.every((p) => Number.isFinite(p.hour))).toBe(true)
      expect(ctx.day.filter((p) => p.hour === 16)).toHaveLength(1)

      const rec = at(report)
      expect(Number.isFinite(rec.thermal.maxRequiredCloHour)).toBe(true)
      expect(rec.thermal.maxRequiredCloHour).toBe(base.thermal.maxRequiredCloHour)
      expect(rec.thermal.requiredMaxClo).toBe(base.thermal.requiredMaxClo)
      expect(rec.dayScore).toBe(base.dayScore)
      expect(rec.umbrella.confidence).toBe('HOURLY')
      expect(rec.umbrella.probability).toBe(base.umbrella.probability)
      expect(rec.rainPlan.facts.commuteMaxLegChance).toBe(base.rainPlan.facts.commuteMaxLegChance)
    })
  }
})
