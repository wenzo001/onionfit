// ClothingPlanner：穿搭算法唯一入口（对应 requirements ClothingPlanner）
// 输入：天气报告 + 用户设置 + 当前时刻；输出：完整推荐结论
// 确定性：同输入必同输出；欢迎单测

import type {
  OutfitAssembly,
  OutfitRecommendation,
  UserSettings,
  WeatherReport,
} from '../types'
import { buildWeatherContext, type WeatherContext } from './weather'
import { buildSolarContext } from './solar'
import { resolvePerson } from './person'
import { resolveActivity } from './activity'
import { buildHourlyThermal } from './thermal'
import { assessSafety } from './safety'
import { buildDemandVector } from './requirement'
import { planLayerSlots } from './layering'
import { matchCandidates } from './matching'
import { assembleOutfit } from './scoring'
import { buildDayParts, buildTimeline } from './schedule'
import { accessoriesOf } from './accessories'
import { assessUmbrella } from './umbrella'
import { round1 } from './psychrometrics'
import { THERMAL } from '../config'

export interface PlanInput {
  report: WeatherReport
  settings: UserSettings
  /** 当前本地时间 */
  now?: Date
}

/** 主入口：生成今日推荐 */
export function plan({ report, settings, now = new Date() }: PlanInput): OutfitRecommendation {
  const ctx = buildWeatherContext(report)
  const nowHour = now.getHours()
  const person = resolvePerson(settings)
  const activity = resolveActivity(settings.activity)
  const solar = buildSolarContext(ctx, nowHour)
  const { hourly: hourlyThermal, designHour } = buildHourlyThermal(
    ctx,
    nowHour,
    person,
    activity,
    (h) => radiationGainAt(ctx, h),
  )

  const safety = assessSafety(ctx, person, activity)
  const demand = buildDemandVector(ctx, person, activity, hourlyThermal, solar, safety)

  // 层结构与匹配
  const slots = planLayerSlots(demand.vector)
  const candidates = matchCandidates(demand.vector, slots)
  const { assembly: dayOutfit, score } = assembleOutfit(slots, candidates, demand.vector)

  // 此刻穿着：按当前热状态决定哪些层 active
  const nowThermal = hourlyThermal.find((t) => t.hour === nowHour) ?? hourlyThermal[0]
  const nowOutfit = applyNowConditions(dayOutfit, nowThermal, ctx, nowHour)

  const periods = buildDayParts(ctx, hourlyThermal, settings.outTime, settings.homeTime)
  const timeline = buildTimeline(ctx, hourlyThermal, dayOutfit)
  // 明日一句话由 presentation 按 daily[1] 与今日事实对比生成（引擎不再拼文案）
  const accessories = accessoriesOf(ctx, demand.vector, person)
  const umbrella = assessUmbrella({
    ctx,
    nextDayRainChance: report.daily[1].rainChancePercent,
    activity: settings.activity,
    settings,
    now,
  })

  const wornNow = nowOutfit.layers.filter((l) => l.active)
  return {
    current: {
      temperatureC: report.current.temperatureC,
      feelsLikeC: report.current.feelsLikeC,
      condition: report.current.condition,
      isDay: report.current.isDay,
      humidityPercent: report.current.humidityPercent,
      windSpeedMs: report.current.windSpeedMs,
      precipitationProbability: report.current.precipitationProbabilityPercent,
    },
    demand: { vector: demand.vector, reasons: demand.reasons },
    thermal: {
      operativeC: nowThermal.operativeC,
      feelsLikeC: nowThermal.feelsLikeC,
      windChillK: nowThermal.windChillK,
      humidityLoadK: nowThermal.humidityLoadK,
      requiredIntrinsicClo: nowThermal.requiredClo,
      maxRequiredCloHour: designHour.hour,
      requiredMaxClo: designHour.requiredClo,
    },
    dayOutfit,
    nowOutfit,
    wornNowCount: wornNow.length,
    wornNowRoles: wornNow.map((l) => l.role),
    facts: {
      dayMinC: ctx.dayMinC,
      dayMaxC: ctx.dayMaxC,
      dayRangeC: ctx.dayRangeC,
      windMaxMs: ctx.windMaxMs,
      dayRainMm: ctx.dayRainMm,
      dayUvMax: ctx.dayUvMax,
      designHourTempC: designHour.temperatureC,
      rainExposure: activity.rainExposure,
      hasHourly: ctx.hasHourly,
    },
    periods,
    timeline,
    accessories,
    umbrella,
    safety,
    dayScore: score,
    reasons: flattenReasons(demand.reasons),
  }
}

/** 某整点的辐射增益估算（不改气温，只抬作用温度，封顶防失真） */
function radiationGainAt(ctx: WeatherContext, hour: number): number {
  const rad = ctx.radiationAt(hour)
  if (rad < 0) return 0
  const isDay = hour >= 7 && hour <= 18
  if (!isDay) return 0
  return Math.min(rad * THERMAL.radiantGainCoeff, THERMAL.radiantGainMaxK)
}

/** 根据当前热状态决定"此刻穿几层"（设计时刻穿全套；现在暖则脱中层，防雨看雨况） */
function applyNowConditions(
  dayOutfit: OutfitAssembly,
  nowThermal: { operativeC: number },
  ctx: WeatherContext,
  nowHour: number,
): OutfitAssembly {
  const layers = dayOutfit.layers.map((l) => ({ ...l, active: l.items.length > 0 }))
  const t = nowThermal.operativeC

  for (const l of layers) {
    const base = l.items[0]
    if (!base) {
      l.active = false
      continue
    }
    // 贴身层始终穿
    if (l.role === 'BASE') {
      l.active = true
      continue
    }
    // 保暖层：温度高于其舒适上界时脱下
    if (l.role === 'INSULATION') {
      l.active = t <= base.comfortRangeC[1] + 3
      continue
    }
    // 防护层：雨/风需要时穿；否则仅早晚冷时穿
    if (l.role === 'PROTECTION') {
      const raining = ctx.dayRainMm > 0.3 && ctx.rainfallAt(nowHour) > 0
      l.active = raining || t <= 12
    }
  }
  void nowHour
  return { ...dayOutfit, layers }
}

function flattenReasons(reasons: Record<string, string[] | undefined>): string[] {
  const out: string[] = []
  Object.values(reasons).forEach((arr) => arr?.forEach((r) => out.push(r)))
  return out
}

/** 便捷工具：温度取整（展示用） */
export const fmtTemp = (v: number) => (Number.isFinite(v) ? round1(v) : '--')