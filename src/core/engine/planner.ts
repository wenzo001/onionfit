// ClothingPlanner：穿搭算法唯一入口（对应 requirements ClothingPlanner）
// 输入：天气报告 + 用户设置 + 当前时刻；输出：完整推荐结论
// 确定性：同输入必同输出；欢迎单测

import type {
  CoverageReport,
  CoverageStatus,
  OutfitAssembly,
  OutfitRecommendation,
  RainPlan,
  ReasonCode,
  UmbrellaAssessment,
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
import { planLayerSlots, type LayerSlot } from './layering'
import { matchCandidates, capacityCandidates } from './matching'
import { assembleOutfit, computeAssembly } from './scoring'
import { buildDayParts, buildTimeline } from './schedule'
import { accessoriesOf } from './accessories'
import { assessUmbrella } from './umbrella'
import { planExposure, summarizeExposure, type ExposureFacts } from './exposure'
import { round1 } from './psychrometrics'
import { COVERAGE, DATA_QUALITY, DEMAND, SAFETY, THERMAL } from '../config'

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
  // 暴露窗口先算：穿衣防雨需求与带伞结论必须引用同一组通勤事实
  const legPlan = planExposure(settings, settings.activity, now)
  const exposure = summarizeExposure(ctx, legPlan)
  const demand = buildDemandVector(ctx, person, activity, hourlyThermal, solar, safety, exposure)

  // 层结构与匹配：用未封顶的保暖缺口，不用会饱和的展示维
  const need = { requiredClo: demand.requiredClo, designHourTempC: designHour.temperatureC }
  const slots = planLayerSlots(demand.vector, need)
  const candidates = matchCandidates(demand.vector, slots, need)
  const { assembly: dayOutfit, score, relaxedCodes } = assembleOutfit(slots, candidates, demand.vector, need)

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
      designHourWindMs:
        ctx.day.find((p) => p.hour === designHour.hour)?.windSpeedMs ?? ctx.windMaxMs,
      rainExposure: activity.rainExposure,
      hasHourly: ctx.hasHourly,
    },
    periods,
    timeline,
    accessories,
    umbrella,
    rainPlan: buildRainPlan(exposure, ctx, umbrella),
    coverage: buildCoverage(
      demand.requiredClo,
      dayOutfit.effectiveClo,
      capacityFor(slots),
      ctx.hasHourly,
      relaxedCodes,
    ),
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

/** 同样的槽位结构，库里最多能凑到多少有效保暖 */
function capacityFor(slots: LayerSlot[]): number {
  const items = capacityCandidates(slots)
  if (!items.length) return 0
  return computeAssembly(items, slots.map((s) => s.role)).effectiveClo
}

/** 衣物库够不够用：分清「这套偏薄」与「库里根本没有」两件事 */
export function buildCoverage(
  requiredClo: number,
  availableClo: number,
  capacityClo: number,
  hourly: boolean,
  relaxed: string[],
): CoverageReport {
  const confidence = hourly ? DATA_QUALITY.withHourly : DATA_QUALITY.synthetic
  const round2 = (v: number) => Math.round(v * 100) / 100
  const required = round2(requiredClo)
  const shortfall = Math.max(0, round2(requiredClo - availableClo))
  const catalogGap = Math.max(0, round2(requiredClo - capacityClo))
  // 死区：差得出一件轻中层才算库不够；小缺口归"勉强够"，不按浮点误差吓人
  const bar = Math.min(COVERAGE.insufficientDeficitClo, requiredClo * COVERAGE.insufficientDeficitRatio)

  let status: CoverageStatus
  // 槽位被放宽与预报质量无关：组装都没满足硬条件，任何数据下都不能算合格
  if (relaxed.length) status = 'insufficient'
  else if (!hourly) status = 'unknown'
  else if (catalogGap > bar) status = 'insufficient'
  else if (shortfall > COVERAGE.shortfallClo) status = 'marginal'
  else if (requiredClo >= COVERAGE.warmDayClo && availableClo - requiredClo < COVERAGE.marginalMarginClo) status = 'marginal'
  else status = 'adequate'

  const unmetNeeds: ReasonCode[] = [...relaxed]
  if (relaxed.length) unmetNeeds.push('HARD_SLOTS_RELAXED')
  if (status === 'insufficient' && catalogGap > 0) unmetNeeds.push('CATALOG_INSUFFICIENT')
  if (status === 'marginal' && shortfall > COVERAGE.shortfallClo) unmetNeeds.push('OUTFIT_UNDERDRESSED')
  if (status === 'unknown') unmetNeeds.push('NO_HOURLY_FORECAST')
  return {
    status,
    requiredClo: required,
    availableClo,
    capacityClo,
    deficitClo: shortfall,
    catalogDeficitClo: catalogGap,
    confidence,
    unmetNeeds,
  }
}

/** 穿与带分开给结论，但两条都用同一组暴露事实 */
function buildRainPlan(
  exposure: ExposureFacts,
  ctx: WeatherContext,
  umbrella: UmbrellaAssessment,
): RainPlan {
  const maxChance = Math.max(exposure.maxChance, 0)
  const dayRainMm = Math.max(ctx.dayRainMm, 0)
  const wetInWindow =
    maxChance >= DEMAND.commuteRainFloorChance ||
    exposure.maxMmPerHour >= 0.5 ||
    dayRainMm >= SAFETY.watchRainMm
  // 不带伞的日子也不该要求穿上防水外壳（两者共用结论线，不互相打脸）
  const wearShell = umbrella.verdict !== 'SKIP' && wetInWindow
  const reasons: ReasonCode[] = []
  if (wearShell) reasons.push('rain-in-window')
  if (umbrella.verdict === 'RAINCOAT') reasons.push('umbrella-ineffective')
  if (!exposure.hourly) reasons.push('no-hourly-exposure-data')
  return {
    facts: {
      commuteMaxLegChance: maxChance,
      commuteMaxLegMmPerHour: exposure.maxMmPerHour,
      dayRainMm,
      windMaxInCommuteMs: exposure.maxWindMs,
    },
    carry: umbrella.verdict,
    wearShell,
    reasons,
  }
}

function flattenReasons(reasons: Record<string, string[] | undefined>): string[] {
  const out: string[] = []
  Object.values(reasons).forEach((arr) => arr?.forEach((r) => out.push(r)))
  return out
}

/** 便捷工具：温度取整（展示用） */
export const fmtTemp = (v: number) => (Number.isFinite(v) ? round1(v) : '--')