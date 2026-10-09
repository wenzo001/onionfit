// 测试场景构造（仅测试使用，不进产物）：合成一份确定性的天气报告 + 设置
// 提取自 planner.p0.spec.ts，供多个回归套件共用，避免每套复制一份天气工厂。
import { plan } from './planner'
import type { HourlyEnvironment, UserSettings, WeatherReport } from '@/core/types'

export const DATE = '2026-09-25'

export interface Opts {
  mean?: number
  amp?: number
  windMs?: number
  rh?: number
  rainChance?: number
  rainMmPerHour?: number
  uvMax?: number
  hourly?: boolean
}

export function makeReport(o: Opts = {}): WeatherReport {
  const mean = o.mean ?? 10
  const amp = o.amp ?? 5
  const wind = o.windMs ?? 2
  const rh = o.rh ?? 60
  const chance = o.rainChance ?? 0
  const mm = o.rainMmPerHour ?? 0
  const uv = o.uvMax ?? 2
  const hourlyFlag = o.hourly ?? true
  const temps = Array.from({ length: 24 }, (_, i) =>
    Math.round((mean + amp * Math.sin(((i - 9) / 24) * 2 * Math.PI)) * 100) / 100,
  )
  const hourly: HourlyEnvironment[] = temps.map((t, i) => ({
    time: `${DATE}T${String(i).padStart(2, '0')}:00`,
    temperatureC: t,
    humidityPercent: rh,
    windSpeedMs: wind,
    windDirectionDeg: 90,
    precipitationMmPerHour: (i === 8 || i === 18) && mm > 0 ? mm : 0,
    precipitationProbabilityPercent: chance,
    kind: chance >= 60 ? 'rain' : 'clear',
    cloudCoverPercent: 40,
    uvIndex: i >= 8 && i <= 16 ? uv : 0,
    solarRadiationWm2: i >= 8 && i <= 16 ? 420 : 0,
    solarElevationDeg: i > 6 && i < 18 ? 40 : 0,
    isDay: i > 6 && i < 18,
    vaporPressureHpa: 15,
    sourceFeelsLikeC: t,
    fromForecast: true,
  }))
  const day = (chanceP: number) => ({
    date: DATE,
    minC: Math.min(...temps),
    maxC: Math.max(...temps),
    dayKind: (chanceP >= 30 ? 'rain' : 'clear') as 'rain' | 'clear',
    sunrise: '06:10',
    sunset: '18:20',
    rainMm: mm * 2,
    rainChancePercent: chanceP,
    uvMax: uv,
  })
  return {
    lat: 31.2304,
    lon: 121.4737,
    timezone: 'Asia/Shanghai',
    generatedAt: `${DATE}T06:00:00.000Z`,
    current: {
      temperatureC: temps[8],
      feelsLikeC: temps[8],
      humidityPercent: rh,
      windSpeedMs: wind,
      precipitationProbabilityPercent: chance,
      condition: chance >= 60 ? 'rain' : 'clear',
      isDay: true,
    },
    hourly,
    daily: [day(chance), day(chance)],
    source: 'open-meteo',
    hasHourlyForecast: hourlyFlag,
  }
}

export function settings(over: Partial<UserSettings> = {}): UserSettings {
  return {
    profile: 'ADULT',
    sensitivity: 'NORMAL',
    activity: 'WALKING',
    outTime: '08:00',
    homeTime: '18:00',
    ...over,
  }
}

export function planAt(o: Opts, s: Partial<UserSettings> = {}, hour = 8) {
  return plan({
    report: makeReport(o),
    settings: settings(s),
    now: new Date(`${DATE}T${String(hour).padStart(2, '0')}:00:00`),
  })
}
