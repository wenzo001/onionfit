// WeatherEngine：WeatherReport → WeatherContext（全天 24h、日级统计、设计需要）

import type { WeatherReport, WeatherKind } from '@/core/types'

export interface HourPoint {
  hour: number // 0-23
  temperatureC: number
  humidityPercent: number
  windSpeedMs: number
  precipitationMm: number
  precipitationProb: number
  kind: WeatherKind
  cloudCover: number
  uvIndex: number
  radiationWm2: number
  isDay: boolean
  solarElevationDeg: number
  humidityOk: boolean // 湿度是否可用
}

export interface WeatherContext {
  day: HourPoint[]
  /** 当天最早一小时的日期（YYYY-MM-DD） */
  date: string
  dayMinC: number
  dayMaxC: number
  dayRangeC: number
  dayRainMm: number
  dayRainChanceMax: number
  dayKind: WeatherKind
  dayUvMax: number
  windMaxMs: number
  hasHourly: boolean
  /** 体感（用 sourcesFeelsLike 或温差估算） */
  sourceFeelsLikeC: number | null
  /** 查询某整点云量（未知返回 -1） */
  cloudAt(hour: number): number
  /** 某整点辐射（未知时 -1） */
  radiationAt(hour: number): number
  /** 某整点 UV（未知时 -1） */
  uvAt(hour: number): number
  /** 某整点雨量 mm/h */
  rainfallAt(hour: number): number
}

const NEG = -1

function kindOf(report: WeatherReport, i: number): WeatherKind {
  return report.hourly[i]?.kind ?? report.current.condition
}

/** 组装全天逐时（无 hourly 时用合成估算） */
export function buildWeatherContext(report: WeatherReport): WeatherContext {
  const hourly = report.hourly
  const hasHourly = report.hasHourlyForecast && hourly.length > 0
  const day1 = report.daily[0]

  let points: HourPoint[] = []
  if (hasHourly) {
    points = hourly.map((h, i) => ({
      hour: new Date(h.time).getHours(),
      temperatureC: h.temperatureC,
      humidityPercent: h.humidityPercent,
      windSpeedMs: h.windSpeedMs,
      precipitationMm: h.precipitationMmPerHour,
      precipitationProb: h.precipitationProbabilityPercent,
      kind: kindOf(report, i),
      cloudCover: h.cloudCoverPercent,
      uvIndex: h.uvIndex,
      radiationWm2: h.solarRadiationWm2,
      isDay: h.isDay,
      solarElevationDeg: h.solarElevationDeg,
      humidityOk: h.humidityPercent >= 0,
    }))
  } else {
    // 降级：按当日最低 / 最高温 + 日出日落生成昼夜曲线（第三步起不再固定 ±6℃）；
    // 峰值取日照中点后 2 小时（地表热滞后），谷值落在其 12 小时对侧
    const tMin = Number.isFinite(day1.minC) ? day1.minC : report.current.temperatureC
    const tMax = Number.isFinite(day1.maxC) ? day1.maxC : report.current.temperatureC
    const mid = (tMin + tMax) / 2
    const amp = Math.max(0, (tMax - tMin) / 2)
    const sunriseH = clockHours(day1.sunrise, 6.5)
    const sunsetH = clockHours(day1.sunset, 18.5)
    const peakH = sunsetH > sunriseH ? (sunriseH + sunsetH) / 2 + 2 : 14
    points = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      temperatureC: Math.round((mid + amp * Math.cos(((i - peakH) / 24) * 2 * Math.PI)) * 10) / 10,
      humidityPercent: report.current.humidityPercent,
      windSpeedMs: report.current.windSpeedMs,
      precipitationMm: 0,
      precipitationProb: report.current.precipitationProbabilityPercent,
      kind: report.current.condition,
      cloudCover: NEG,
      uvIndex: i >= 8 && i <= 16 ? 3 : 0,
      radiationWm2: i >= 8 && i <= 16 ? 400 : 0,
      isDay: i > 6 && i < 18,
      solarElevationDeg: i > 6 && i < 18 ? 30 : 0,
      humidityOk: report.current.humidityPercent >= 0,
    }))
  }

  const dayRainChanceMax = day1.rainChancePercent

  const hourIndex = new Map(points.map((p) => [p.hour, p]))

  return {
    day: points,
    date: day1.date,
    dayMinC: day1.minC,
    dayMaxC: day1.maxC,
    dayRangeC: day1.maxC - day1.minC,
    dayRainMm: day1.rainMm,
    dayRainChanceMax,
    dayKind: day1.dayKind,
    dayUvMax: day1.uvMax,
    windMaxMs: Math.max(...points.map((p) => p.windSpeedMs), 0),
    hasHourly: hasHourly,
    sourceFeelsLikeC: report.current.feelsLikeC,
    cloudAt: (h) => hourIndex.get(h)?.cloudCover ?? NEG,
    radiationAt: (h) => hourIndex.get(h)?.radiationWm2 ?? NEG,
    uvAt: (h) => hourIndex.get(h)?.uvIndex ?? NEG,
    rainfallAt: (h) => hourIndex.get(h)?.precipitationMm ?? 0,
  }
}

/** 找昼夜温差最大的时间段（作为可脱卸判断的补充信号，沿用 dayRangeC） */
export function daySpanRange(ctx: WeatherContext): { hour: number; min: number; max: number } {
  let minH = 0
  let maxH = 0
  ctx.day.forEach((p, i) => {
    if (p.temperatureC < ctx.day[minH].temperatureC) minH = i
    if (p.temperatureC > ctx.day[maxH].temperatureC) maxH = i
  })
  return { hour: maxH, min: ctx.day[minH].temperatureC, max: ctx.day[maxH].temperatureC }
}

/** "06:10" 或 ISO 时间串 → 小时小数（6.17）；取首个 HH:MM，解析失败用兜底值 */
function clockHours(t: string, fallback: number): number {
  const m = /(\d{1,2}):(\d{2})/.exec(t ?? '')
  if (!m) return fallback
  const h = Number(m[1]) + Number(m[2]) / 60
  return Number.isFinite(h) ? h : fallback
}