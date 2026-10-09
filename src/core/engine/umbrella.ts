// UmbrellaEngine：通勤时段被淋雨概率 + 带伞判定（确定性，无 LLM）
// 口径与需求向量不同：demand.RAIN 量的是「需不需要防水面料」，本引擎量的是「上下班那十几分钟会不会被淋」。
// 暴露窗口与逐时样本来自 ExposureEngine（与穿衣防雨需求同一来源），本文件只负责概率合并与三值结论。

import { SAFETY, UMBRELLA } from '../config'
import type {
  ActivityKind,
  ReasonCode,
  UmbrellaAssessment,
  UmbrellaLeg,
  UmbrellaVerdict,
  UserSettings,
} from '../types'
import type { WeatherContext } from './weather'
import { fmtMinutes, legSamples, planExposure } from './exposure'

export type { UmbrellaAssessment, UmbrellaLeg, UmbrellaVerdict }

export interface UmbrellaInput {
  ctx: WeatherContext
  /** 次日降水概率 %（跨零点夜班时供回家段取值；-1 = 未知） */
  nextDayRainChance: number
  activity: ActivityKind
  settings: UserSettings
  now: Date
}

const clampPercent = (v: number) => Math.min(100, Math.max(0, v))

/**
 * 一段暴露的淋雨概率：P = 1 − Π (1 − q_h)，
 * q_h = p_h × (w + (1 − w) × rainPersistence)，w = 该小时被暴露窗口覆盖的比例。
 * 单小时全覆盖（w=1）时正好退化为该小时的整点概率。
 */
function legProbability(hours: { prob: number; weight: number }[]): number {
  let dry = 1
  for (const h of hours) {
    if (h.prob <= 0) continue
    const w = Math.min(Math.max(h.weight, 0), 1)
    dry *= 1 - (h.prob / 100) * (w + (1 - w) * UMBRELLA.rainPersistence)
  }
  return clampPercent((1 - dry) * 100)
}

/** 主入口：给出今天带不带伞的量化结论 */
export function assessUmbrella({
  ctx,
  nextDayRainChance,
  activity,
  settings,
  now,
}: UmbrellaInput): UmbrellaAssessment {
  const threshold = Math.round(100 / (1 + UMBRELLA.lossRatio))
  const plan = planExposure(settings, activity, now)
  const reasons: ReasonCode[] = []
  if (plan.assumed) reasons.push('assumed-commute-time')
  if (plan.passed) reasons.push('commute-passed')

  const dayCap = Math.max(ctx.dayRainChanceMax, 0)
  const nextCap = Math.max(nextDayRainChance, 0)
  let confidence: UmbrellaAssessment['confidence'] = 'HOURLY'

  let dryAll = 1
  let windMs = 0
  let rainMmPerHour = 0
  /** 有逐时依据的段里最强的那个概率：别的段缺数据不该把它抹掉 */
  let grounded = 0
  const measured: UmbrellaLeg[] = []

  for (const leg of plan.legs) {
    const samples = legSamples(ctx, leg)
    const hourly = samples.length > 0
    // 逐时不可用（缺数据 / 段落在次日）时，退回用全天或次日概率折算这段暴露
    const reference = leg.nextDay ? nextCap : dayCap
    let prob = legProbability(
      hourly ? samples : [{ prob: reference, weight: leg.minutes / 60 }],
    )
    if (hourly) {
      grounded = Math.max(grounded, prob)
    } else {
      confidence = 'DEGRADED'
      // 没有逐时定位时，不应比唯一可用信号本身更有把握
      prob = Math.min(prob, reference)
    }
    for (const s of samples) {
      windMs = Math.max(windMs, s.windMs)
      rainMmPerHour = Math.max(rainMmPerHour, s.mm)
    }
    dryAll *= 1 - prob / 100
    measured.push({
      phase: leg.phase,
      start: fmtMinutes(leg.start),
      minutes: leg.minutes,
      probability: Math.round(clampPercent(prob)),
    })
  }

  const combined = clampPercent((1 - dryAll) * 100)
  let probability = combined
  if (confidence === 'DEGRADED') {
    // 降级：整体不超过可用来源信号，但也不能低于某段已有的逐时依据
    probability = Math.max(Math.min(combined, Math.max(dayCap, nextCap)), grounded)
  }
  probability = Math.round(clampPercent(probability))

  const wetEnough = probability >= threshold
  const windy = confidence === 'HOURLY' && windMs >= UMBRELLA.windVetoMs
  const heavy = confidence === 'HOURLY' && rainMmPerHour >= SAFETY.dangerRainMm

  let verdict: UmbrellaVerdict = 'SKIP'
  if (wetEnough && windy) {
    verdict = 'RAINCOAT'
    reasons.push('wind-rain')
  } else if (wetEnough && heavy) {
    verdict = 'RAINCOAT'
    reasons.push('heavy-rain')
  } else if (wetEnough) {
    verdict = 'BRING'
    reasons.push('rain')
  }
  if (confidence === 'DEGRADED') reasons.push('degraded-forecast')

  return {
    probability,
    verdict,
    threshold,
    legs: measured,
    windMs: Math.round(windMs * 10) / 10,
    rainMmPerHour: Math.round(rainMmPerHour * 10) / 10,
    confidence,
    assumed: plan.assumed,
    reasons,
  }
}
