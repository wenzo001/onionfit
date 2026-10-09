// ScheduleEngine：早/午/晚分段（按太阳事件）+ 逐时穿脱序列 + 加/减层时间线
// 时间线与「此刻穿着」共用同一条逐时序列：事件 = 相邻两小时穿着状态差，不再两套判据（方案 §8.2）。
// 保暖层按"去掉它剩下的有效 clo 够不够"判定，脱/穿两阈值间留滞回带。

import { LAYERING, SCHEDULE } from '../config'
import type { DayPart, LayerRole, OutfitAssembly, TimelineEvent } from '../types'
import type { WeatherContext } from './weather'
import type { HourlyThermal } from './thermal'

/** 按太阳事件切分早午晚 */
export function buildDayParts(
  ctx: WeatherContext,
  thermal: HourlyThermal[],
  settingsOutTime: string | null,
  settingsHomeTime: string | null,
): DayPart[] {
  // 默认：早 6-11 / 午 11-17 / 晚 17-22；用户出门/回家时间覆盖早晚边界
  let morningStart = 6
  let noonEnd = 17
  if (settingsOutTime) {
    const h = Number(settingsOutTime.split(':')[0])
    if (Number.isFinite(h)) morningStart = Math.min(h, 10)
  }
  if (settingsHomeTime) {
    const h = Number(settingsHomeTime.split(':')[0])
    if (Number.isFinite(h)) noonEnd = Math.max(h - 4, noonEnd - 4)
  }

  const avgOf = (s: number, e: number) => {
    const seg = thermal.filter((t) => t.hour >= s && t.hour < e)
    if (!seg.length) return ctx.dayMaxC
    return seg.reduce((sum, t) => sum + t.temperatureC, 0) / seg.length
  }

  return [
    {
      phase: 'morning',
      label: '早间',
      startHour: morningStart,
      endHour: 12,
      avgTemp: avgOf(morningStart, 12),
      advice: '出门时段，注意体感温度',
    },
    {
      phase: 'noon',
      label: '午后',
      startHour: 12,
      endHour: noonEnd,
      avgTemp: avgOf(12, noonEnd),
      advice: '一天里最暖，可能需要脱一层',
    },
    {
      phase: 'evening',
      label: '晚间',
      startHour: noonEnd,
      endHour: 24,
      avgTemp: avgOf(noonEnd, 24),
      advice: '回家时段，气温下降注意添衣',
    },
  ]
}

/** 单小时穿着状态（BASE 恒穿；INSULATION / PROTECTION 按热需求与滞回判定） */
export interface WearingStep {
  hour: number
  active: Set<LayerRole>
}

/**
 * 逐时穿脱序列（0-23 时）：
 * - 保暖层：去掉它后剩下的有效 clo ≥ 当小时所需 + 滞回余量 → 脱下；不够了 → 穿回
 * - 防护层：降水时段必穿（安全侧不设滞回）；无雨时气温低于 protectionColdC 穿、高出滞回带才脱
 * - 初始状态按 0 时事实直接判，避免把"半夜换装"事件带进时间线
 * metabolismReduce 与选衣同口径（需求 = 原始需求 − 活动代谢抵消），保证穿着判据与这套衣服一致。
 */
export function buildWearingSeries(
  dayOutfit: OutfitAssembly,
  thermal: HourlyThermal[],
  ctx: WeatherContext,
  metabolismReduce = 0,
): WearingStep[] {
  const byHour = new Map(thermal.map((t) => [t.hour, t]))
  // 各角色对整套名义 clo 的贡献：与 computeAssembly 同一套层间递减
  const contrib: Partial<Record<LayerRole, number>> = {}
  const roleCount: Partial<Record<LayerRole, number>> = {}
  dayOutfit.layers.forEach((l) =>
    l.items.forEach((it) => {
      const k = roleCount[l.role] ?? 0
      roleCount[l.role] = k + 1
      contrib[l.role] = (contrib[l.role] ?? 0) + it.insulationClo * Math.pow(LAYERING.layerDiminish, k)
    }),
  )
  const total = Object.values(contrib).reduce((s, v) => s + (v ?? 0), 0)
  // 风穿透折损与 computeAssembly 同口径：防护层风挡 ≥0.8 才拿满系数 1，否则（含无防护层）都按 0.85
  const protItem = dayOutfit.layers.find((l) => l.role === 'PROTECTION')?.items[0]
  const windFactor = protItem && protItem.wind >= 0.8 ? 1 : 0.85
  const effWithout = (role: LayerRole): number => (total - (contrib[role] ?? 0)) * windFactor
  const raining = (h: number): boolean => ctx.dayRainMm > 0.3 && ctx.rainfallAt(h) > 0
  const reqAt = (t: HourlyThermal): number => Math.max(0, t.requiredClo - metabolismReduce)

  const series: WearingStep[] = []
  const hasIns = (contrib.INSULATION ?? 0) > 0
  const hasProt = (contrib.PROTECTION ?? 0) > 0
  let insOn = false
  let protOn = false
  for (let h = 0; h < 24; h++) {
    const t = byHour.get(h)
    if (!t) continue
    const req = reqAt(t)
    if (h === 0 || series.length === 0) {
      insOn = hasIns && effWithout('INSULATION') < req
      protOn = hasProt && (raining(h) || t.temperatureC <= SCHEDULE.protectionColdC)
    } else {
      if (insOn) {
        if (effWithout('INSULATION') >= req + SCHEDULE.insulationOffMarginClo) insOn = false
      } else if (hasIns && effWithout('INSULATION') < req) {
        insOn = true
      }
      if (protOn) {
        if (!raining(h) && t.temperatureC > SCHEDULE.protectionColdC + SCHEDULE.protectionHysteresisK) protOn = false
      } else if (hasProt && (raining(h) || t.temperatureC <= SCHEDULE.protectionColdC)) {
        protOn = true
      }
    }
    const active = new Set<LayerRole>(['BASE'])
    if (insOn && hasIns) active.add('INSULATION')
    if (protOn && hasProt) active.add('PROTECTION')
    series.push({ hour: h, active })
  }
  return series
}

/** 某小时的穿着状态（序列外的小时回退到最近一步/空） */
export function wearingAt(series: WearingStep[], hour: number): Set<LayerRole> {
  const step = series.find((x) => x.hour === hour) ?? series[0]
  return step ? step.active : new Set<LayerRole>(['BASE'])
}

/** 把穿着状态套回整套层（不改 items，只切 active 标记） */
export function applyWearing(dayOutfit: OutfitAssembly, active: Set<LayerRole>): OutfitAssembly {
  const layers = dayOutfit.layers.map((l) => ({ ...l, active: l.items.length > 0 && active.has(l.role) }))
  return { ...dayOutfit, layers }
}

/** 时间线 = 逐时序列的相邻状态差（ADD/REMOVE ≤6 条），与「此刻穿着」天然一致 */
export function buildTimeline(dayOutfit: OutfitAssembly, series: WearingStep[]): TimelineEvent[] {
  const events: TimelineEvent[] = []
  const itemsOf = (role: LayerRole) => dayOutfit.layers.find((l) => l.role === role)?.items ?? []
  for (let i = 1; i < series.length; i++) {
    const prev = series[i - 1]
    const cur = series[i]
    for (const role of ['INSULATION', 'PROTECTION'] as LayerRole[]) {
      if (prev.active.has(role) === cur.active.has(role)) continue
      const items = itemsOf(role)
      if (!items.length) continue
      events.push({
        hour: `${String(cur.hour).padStart(2, '0')}:00`,
        action: cur.active.has(role) ? 'ADD' : 'REMOVE',
        role,
        layerLabel: items[0].name || (role === 'INSULATION' ? '中间层' : '防护层'),
      })
    }
  }
  return events.slice(0, 6)
}
