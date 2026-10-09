// 第三步回归（方案 §4）：地理气候上下文 + 数据置信度
// 期望值都是领域事实（气象季节、日最低/最高温、置信度序关系），不从被测常量推导
import { describe, expect, it } from 'vitest'
import { plan } from './planner'
import { buildWeatherContext } from './weather'
import { makeReport, settings, DATE } from './test-scenarios'

const at = (h: number) => new Date(`${DATE}T${String(h).padStart(2, '0')}:00:00`)

describe('step3 地理上下文：位置、半球与季节', () => {
  it('北半球城市：半球与季节由纬度、日期得出（9 月 → 秋）', () => {
    const rep = makeReport()
    const r = plan({ report: rep, settings: settings(), now: at(8) })
    expect(r.geo.hemisphere).toBe('north')
    expect(r.geo.season).toBe('autumn')
    expect(r.geo.latitude).toBe(rep.lat)
    expect(r.geo.longitude).toBe(rep.lon)
    expect(r.geo.timezone).toBe(rep.timezone)
    expect(r.geo.dataSource).toBe('forecast')
  })

  it('南半球城市：同一天季节相反（9 月 → 春）', () => {
    const rep = { ...makeReport(), lat: -33.87, lon: 151.21, timezone: 'Australia/Sydney' }
    const r = plan({ report: rep, settings: settings(), now: at(8) })
    expect(r.geo.hemisphere).toBe('south')
    expect(r.geo.season).toBe('spring')
  })

  it('赤道坐标：半球 / 季节 unknown，但不误报缺位置', () => {
    const rep = { ...makeReport(), lat: 0, lon: 0 }
    const r = plan({ report: rep, settings: settings(), now: at(8) })
    expect(r.geo.hemisphere).toBe('unknown')
    expect(r.geo.season).toBe('unknown')
    expect(r.geo.missingInputs).toEqual([])
  })
})

describe('step3 数据置信度：缺位置只降置信度，不改结论', () => {
  it('位置缺失：地理层退 fallback，两级置信度都下降；穿衣结论本身不变', () => {
    const ok = plan({ report: makeReport(), settings: settings(), now: at(8) })
    const noLoc = plan({
      report: { ...makeReport(), lat: NaN, lon: NaN, timezone: '' },
      settings: settings(),
      now: at(8),
    })
    expect(noLoc.geo.hemisphere).toBe('unknown')
    expect(noLoc.geo.season).toBe('unknown')
    expect(noLoc.geo.dataSource).toBe('fallback')
    expect(noLoc.geo.missingInputs).toContain('location')
    expect(noLoc.geo.confidence).toBeLessThan(ok.geo.confidence)
    expect(noLoc.coverage.confidence).toBeLessThan(ok.coverage.confidence)
    const ids = (r: ReturnType<typeof plan>) =>
      r.dayOutfit.layers.flatMap((l) => l.items.map((i) => i.id))
    expect(ids(noLoc)).toEqual(ids(ok))
    expect(noLoc.coverage.status).toBe(ok.coverage.status)
  })

  it('置信度始终落在 (0,1]，且无逐时低于有逐时', () => {
    const withH = plan({ report: makeReport(), settings: settings(), now: at(8) })
    const noH = plan({ report: makeReport({ hourly: false }), settings: settings(), now: at(8) })
    for (const r of [withH, noH]) {
      expect(r.coverage.confidence).toBeGreaterThan(0)
      expect(r.coverage.confidence).toBeLessThanOrEqual(1)
    }
    expect(noH.coverage.confidence).toBeLessThan(withH.coverage.confidence)
  })
})

describe('step3 合成曲线：贴合日最低 / 最高与日出日落', () => {
  it('无逐时：曲线峰谷贴合日最高 / 最低温，峰值落在午后', () => {
    const rep = makeReport({ mean: 10, amp: 9, hourly: false })
    const ctx = buildWeatherContext(rep)
    const temps = ctx.day.map((p) => p.temperatureC)
    const max = Math.max(...temps)
    const min = Math.min(...temps)
    expect(Math.abs(max - rep.daily[0].maxC)).toBeLessThan(0.3)
    expect(Math.abs(min - rep.daily[0].minC)).toBeLessThan(0.3)
    const peakHour = ctx.day[temps.indexOf(max)].hour
    expect(peakHour).toBeGreaterThanOrEqual(13)
    expect(peakHour).toBeLessThanOrEqual(17)
  })

  it('日出推迟时峰值小时随之推后（真的读了 sunrise）', () => {
    const base = buildWeatherContext(makeReport({ mean: 10, amp: 9, hourly: false }))
    const late = makeReport({ mean: 10, amp: 9, hourly: false })
    late.daily[0] = { ...late.daily[0], sunrise: '09:00' }
    const ctx = buildWeatherContext(late)
    const peakOf = (c: ReturnType<typeof buildWeatherContext>) => {
      const temps = c.day.map((p) => p.temperatureC)
      return c.day[temps.indexOf(Math.max(...temps))].hour
    }
    expect(peakOf(ctx)).toBeGreaterThan(peakOf(base))
  })
})
