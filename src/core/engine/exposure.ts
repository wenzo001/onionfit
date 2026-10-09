// 暴露窗口建模的唯一来源：穿衣判定与带伞判定共用同一组通勤事实（方案 §5.4）
// 「室内」只降低暴露权重，不等于完全不经过户外——所以窗口事实必须能被需求侧读到。

import { UMBRELLA } from '../config'
import type { ActivityKind, UserSettings } from '../types'
import type { WeatherContext } from './weather'

export interface ExposureLeg {
  phase: 'OUT' | 'HOME' | 'NOW'
  /** 当日分钟数，> 1440 表示落在次日 */
  start: number
  minutes: number
  /** true = 落在次日，当日逐时数据不可用 */
  nextDay: boolean
}

export interface LegPlan {
  legs: ExposureLeg[]
  /** 通勤时刻来自兜底默认值 */
  assumed: boolean
  /** 计划中的两段都已过去，改按"此刻起一段" */
  passed: boolean
}

/** 某段暴露覆盖到的整点样本；weight = 该小时被窗口覆盖的比例 */
export interface LegSample {
  hour: number
  weight: number
  prob: number
  windMs: number
  mm: number
}

function toMinutes(hhmm: string): number | null {
  const [h, m] = hhmm.split(':').map(Number)
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null
  return h * 60 + m
}

/** 由通勤时刻 + 活动 + 当前时刻，得到计划中的暴露窗口 */
export function planExposure(settings: UserSettings, activity: ActivityKind, now: Date): LegPlan {
  const minutes = UMBRELLA.legMinutes[activity] ?? UMBRELLA.legMinutes.WALKING
  const nowMinutes = now.getHours() * 60 + now.getMinutes()
  const assumed = settings.outTime === null || settings.homeTime === null

  const out = toMinutes(settings.outTime ?? '') ?? UMBRELLA.fallbackOutMinutes
  const homeRaw = toMinutes(settings.homeTime ?? '') ?? UMBRELLA.fallbackHomeMinutes
  // 回家不晚于出门 → 夜班，回家段属于次日
  const home = homeRaw > out ? homeRaw : homeRaw + 1440

  const planned: ExposureLeg[] = [
    { phase: 'OUT', start: out, minutes, nextDay: false },
    { phase: 'HOME', start: home, minutes, nextDay: home >= 1440 },
  ]

  // 两段都已过去（深夜还在看这条建议）→ 改按"此刻起一段"，避免全天报废
  const upcoming = planned.filter((l) => l.start + l.minutes > nowMinutes)
  const legs = upcoming.length ? upcoming : [{ phase: 'NOW' as const, start: nowMinutes, minutes, nextDay: false }]
  return { legs, assumed, passed: !upcoming.length }
}

/** 窗口覆盖到哪些整点、各占多大比例；概率未知（<0）的整点不作为样本 */
export function legSamples(ctx: WeatherContext, leg: ExposureLeg): LegSample[] {
  if (!ctx.hasHourly || leg.nextDay) return []
  const byHour = new Map(ctx.day.map((p) => [p.hour, p]))
  const end = leg.start + leg.minutes
  const samples: LegSample[] = []
  for (let h = Math.floor(leg.start / 60); h < Math.ceil(end / 60) && h < 24; h++) {
    const overlap = Math.min(end, (h + 1) * 60) - Math.max(leg.start, h * 60)
    if (overlap <= 0) continue
    const point = byHour.get(h)
    if (!point || point.precipitationProb < 0) continue
    samples.push({
      hour: h,
      weight: overlap / 60,
      prob: point.precipitationProb,
      windMs: point.windSpeedMs,
      mm: point.precipitationMm,
    })
  }
  return samples
}

export interface ExposureFacts {
  /** 窗口内最大的整点降水概率；拿不到逐时时为 -1（未知，不是 0） */
  maxChance: number
  maxMmPerHour: number
  maxWindMs: number
  hourly: boolean
}

/** 汇总所有暴露窗口的降水事实，供需求侧与雨具结论共用 */
export function summarizeExposure(ctx: WeatherContext, plan: LegPlan): ExposureFacts {
  let maxChance = -1
  let maxMm = 0
  let maxWind = 0
  let hourly = false
  for (const leg of plan.legs) {
    for (const s of legSamples(ctx, leg)) {
      hourly = true
      maxChance = Math.max(maxChance, s.prob)
      maxMm = Math.max(maxMm, s.mm)
      maxWind = Math.max(maxWind, s.windMs)
    }
  }
  if (!hourly) return { maxChance: -1, maxMmPerHour: 0, maxWindMs: 0, hourly: false }
  return { maxChance, maxMmPerHour: maxMm, maxWindMs: maxWind, hourly }
}

/** 当日分钟数 → HH:mm（次日时刻折回 00:00-23:59） */
export function fmtMinutes(total: number): string {
  const t = ((total % 1440) + 1440) % 1440
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.round(t % 60)).padStart(2, '0')}`
}
