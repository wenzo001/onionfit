// ScheduleEngine：早/午/晚分段（按太阳事件）+ 加/减层时间线（ADD/REMOVE ≤6）

import type { DayPart, OutfitAssembly, TimelineEvent } from '../types'
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

/**
 * 时间线：从设计时刻（最暖）向两侧推导加/减层。
 * 返回按时间排序的 ≤6 条事件（REMOVE 在午后升温段、ADD 在傍晚降温段）
 */
export function buildTimeline(
  ctx: WeatherContext,
  thermal: HourlyThermal[],
  dayOutfit: OutfitAssembly,
): TimelineEvent[] {
  const events: TimelineEvent[] = []
  const layersByRole = new Map(dayOutfit.layers.map((l) => [l.role, l]))
  const insulation = layersByRole.get('INSULATION')
  const protection = layersByRole.get('PROTECTION')

  // 找最暖整点
  const warmest = thermal.slice(8, 18).reduce((acc, h) => (h.temperatureC > acc.temperatureC ? h : acc), thermal[8])

  // 午间过暖 → REMOVE（先薄后厚）
  if (insulation && insulation.items.length > 0) {
    events.push({
      hour: `${String(warmest.hour).padStart(2, '0')}:00`,
      action: 'REMOVE',
      role: 'INSULATION',
      layerLabel: layerName(insulation.items.map((i) => i.name).join('/')),
    })
  }
  // 傍晚转凉 → ADD
  const eveningCool = thermal.slice(warmest.hour + 1, 22).find((t) => t.temperatureC <= warmest.temperatureC - 4)
  if (eveningCool && insulation && insulation.items.length > 0) {
    events.push({
      hour: `${String(eveningCool.hour).padStart(2, '0')}:00`,
      action: 'ADD',
      role: 'INSULATION',
      layerLabel: layerName(insulation.items.map((i) => i.name).join('/')),
    })
  }
  if (protection && protection.items.length > 0 && ctx.dayRainMm > 0) {
    events.push({
      hour: `${String(Math.max(warmest.hour + 2, 17)).padStart(2, '0')}:00`,
      action: 'ADD',
      role: 'PROTECTION',
      layerLabel: layerName(protection.items.map((i) => i.name).join('/')),
    })
  }

  const sorted = events.sort((a, b) => (a.hour < b.hour ? -1 : 1)).slice(0, 6)
  void ctx
  return sorted
}

function layerName(names: string): string {
  return names.split('/')[0] || '中间层'
}
