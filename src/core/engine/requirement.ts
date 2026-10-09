// RequirementEngine：六维需求向量（各维度取全天最坏值）。
// 安全 forcedDemands 以 max 合并，永不下调。
// 展示用的 0-100 允许饱和；选衣用的是未封顶的 requiredClo，两者分开（方案 §5.2）。

import { DEMAND } from '../config'
import type { DemandDim, DemandVector } from '../types'
import { normalize } from './psychrometrics'
import type { WeatherContext } from './weather'
import type { PersonProfile } from './person'
import type { ResolvedActivity } from './activity'
import type { SafetyReport } from './safety'
import type { HourlyThermal } from './thermal'
import type { SolarContext } from './solar'
import type { ExposureFacts } from './exposure'

export type DemandReasons = Partial<Record<DemandDim, string[]>>

export interface DemandResult {
  vector: DemandVector
  reasons: DemandReasons
  /** 未封顶的保暖缺口（clo，已扣代谢产热），选衣与覆盖判定用它 */
  requiredClo: number
  /** 全天最大所需 clo（未扣代谢），用于解释"最冷那一小时" */
  rawMaxClo: number
}

/**
 * 全天每时刻算六维，逐维取最坏值（保暖取最冷、防风取风最大…），独立归一后逐维 max。
 */
export function buildDemandVector(
  ctx: WeatherContext,
  person: PersonProfile,
  activity: ResolvedActivity,
  thermal: HourlyThermal[],
  solar: SolarContext,
  safety: SafetyReport,
  exposure: ExposureFacts,
  /** 暴露习惯系数（1 = 短时户外基准；求不放大「窗口有雨」的下限——下限是窗口事实，不是习惯） */
  rainFactor = 1,
): DemandResult {
  const reasons: DemandReasons = {}

  // ---- 保暖 WARMTH：全天最大所需 clo（未封顶），展示维另算 ----
  const rawMaxClo = Math.max(...thermal.map((t) => t.requiredClo), 0)
  const requiredClo = Math.max(0, rawMaxClo - activity.metabolicCloReduce)
  const baseWarmth = normalize(rawMaxClo, 0.4, DEMAND.warmthFullCloDiff + 0.4)
  // 活动代谢产热可抵消保暖需求
  const warmth = clamp(Math.round(baseWarmth - activity.metabolicCloReduce * 15), 0, 100)
  if (warmth > 20) reasons.WARMTH = ['全天温差大', `最冷时段需约 ${rawMaxClo.toFixed(1)} clo 保暖`]

  // ---- 防风 WIND：全天最大有效风速（环境 + 自生风） ----
  const windMax = Math.max(...ctx.day.map((p) => p.windSpeedMs)) + activity.selfWindMs
  const wind = normalize(windMax, DEMAND.windOnsetMs, DEMAND.windFullMs)
  if (wind > 10) reasons.WIND = activity.selfWindMs > 0.5
    ? ['当前运动自带风感', `全天风速峰值约 ${windMax.toFixed(0)} m/s`]
    : [`全天风速峰值约 ${windMax.toFixed(0)} m/s`]

  // ---- 防雨 RAIN：降水概率与雨量取较大者，再按暴露加权 ----
  const rainChance = ctx.dayRainChanceMax
  const rainMm = ctx.dayRainMm
  const rainByChance = normalize(Math.max(rainChance, 0), DEMAND.rainChanceOnset, DEMAND.rainChanceFull)
  const rainByMm = normalize(Math.max(rainMm, 0), DEMAND.rainMmOnset, DEMAND.rainMmFull)
  const weighted = Math.max(rainByChance, rainByMm) * Math.min(1, activity.rainExposure * rainFactor)
  // 「室内」只降低暴露权重：通勤窗口里确实有雨时，防雨需求不归零，否则与带伞结论互相打脸
  const windowChance = exposure.hourly ? exposure.maxChance : Math.max(rainChance, 0)
  const floor = windowChance >= DEMAND.commuteRainFloorChance ? DEMAND.commuteRainFloor : 0
  const rain = Math.max(weighted, floor)
  if (rain > 15 && rainChance >= 0) reasons.RAIN = [`降水概率 ${Math.min(Math.max(rainChance, 0), 100)}%`]

  // ---- 透气 BREATHABILITY：高温 + 高湿 + 高强度活动 ----
  const hotHours = thermal.filter((t) => t.operativeC >= DEMAND.breathabilityOnsetC)
  const maxOp = hotHours.length ? Math.max(...hotHours.map((t) => t.operativeC)) : DEMAND.breathabilityOnsetC
  const humidity = Math.max(...ctx.day.map((p) => p.humidityPercent), 0)
  let breathability = normalize(maxOp, DEMAND.breathabilityOnsetC, DEMAND.breathabilityFullC)
  if (humidity > 70) breathability = Math.min(100, breathability + 15) // 湿热加成
  if (activity.breathabilityBoost) breathability = Math.max(breathability, 45) // 高强度运动必透气
  const breath = Math.min(100, Math.round(breathability))
  if (breath > 25) reasons.BREATHABILITY = ['午后较热，需要透气面料', '湿度较高，闷热感增强']

  // ---- 遮阳 SOLAR：UV 与活动日晒暴露 ----
  const solarD = solar.solarDemand * activity.sunExposure * person.sunSensitivity
  if (solarD > 15) reasons.SOLAR = [`紫外线指数 ${solar.uvIndex}`, '注意防晒']

  // ---- 可脱卸 REMOVABLE：昼夜温差与外出时长 ----
  const removable = normalize(ctx.dayRangeC, DEMAND.removableOnsetDiff, DEMAND.removableFullDiff)
  if (removable > 15) reasons.REMOVABLE = [`昼夜温差约 ${ctx.dayRangeC.toFixed(0)}℃`, '中层建议便于穿脱']

  // ---- 安全 forced 合并（只上调 max）----
  const vector: DemandVector = {
    WARMTH: mergeDim(warmth, safety.forcedDemands.WARMTH),
    WIND: mergeDim(wind, safety.forcedDemands.WIND),
    RAIN: mergeDim(rain, safety.forcedDemands.RAIN),
    BREATHABILITY: mergeDim(breath, safety.forcedDemands.BREATHABILITY),
    SOLAR: mergeDim(solarD, safety.forcedDemands.SOLAR),
    REMOVABLE: mergeDim(removable, safety.forcedDemands.REMOVABLE),
  }
  return { vector, reasons, requiredClo, rawMaxClo }
}

function mergeDim(base: number, forced: number | undefined): number {
  return forced === undefined ? Math.round(base) : Math.max(Math.round(base), Math.round(forced))
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v))
}
