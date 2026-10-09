// Psychrometrics：水汽压、体感温度（低温风寒 / 高温湿度双区间模型）
// 遵循复核点：湿度仅在高温侧加载；风低温风寒、高温受湿度限制

import { THERMAL } from '../config'

export const NEG = -1

/** Magnus 饱和水汽压（hPa） */
export function saturationVaporPressure(tempC: number): number {
  return 6.112 * Math.exp((17.62 * tempC) / (243.12 + tempC))
}

/** 实际水汽压（hPa）；湿度未知返回 NEG */
export function vaporPressure(humidityPercent: number, tempC: number): number {
  return (humidityPercent / 100) * saturationVaporPressure(tempC)
}

/**
 * 风寒降温（K）。低温侧模型（JAG/TI 风寒公式简化）：
 *   T 有效 = 13.12 + 0.6215*T - 11.37*v^0.16 + 0.3965*T*v^0.16 （v 单位 km/h）
 * 输出为"相对无风时的降温量"，仅当 T ≤ onset 且风较大时生效。
 */
export function windChillK(tempC: number, windMs: number): number {
  if (tempC > THERMAL.windChillOnsetC || windMs <= 0) return 0
  // 转 km/h
  const v = windMs * 3.6
  if (v < 4.8) return 0
  const chilled =
    13.12 + 0.6215 * tempC - 11.37 * Math.pow(v, 0.16) + 0.3965 * tempC * Math.pow(v, 0.16)
  return Math.max(0, tempC - chilled) // 降温量为正 → 作用温度降低
}

/**
 * 高温湿度负载（K）→ 升温。仅当 T ≥ onset 时加载，避免低温误读湿度。
 * 湿度越高，体感越闷热（感觉更暖）。
 */
export function humidityLoadK(tempC: number, humidityPercent: number): number {
  if (tempC < THERMAL.humidityOnsetC || humidityPercent < 0) return 0
  const overBaseline = Math.max(0, humidityPercent - THERMAL.humidityBaseline)
  return (overBaseline / 10) * THERMAL.humidityPer10
}

/**
 * 体感温度（简化流体模型）：
 *   feelsLike = temp + radiantGain − windChill + humidityLoad
 * radiantGain 由 SolarEngine 提供（不改气温，只作用于人体感受）
 */
export function feelsLikeC(
  tempC: number,
  windMs: number,
  humidityPercent: number,
  radiantGainK: number,
): number {
  return tempC + radiantGainK - windChillK(tempC, windMs) + humidityLoadK(tempC, humidityPercent)
}

/**
 * 由作用温度反推"所需内在 clo"。
 * 不封顶：低温侧的区分度靠这个原始缺口（方案 §5.2），展示用的 0-100 归一化另有其口径。
 */
export function requiredIntrinsicClo(tempC: number, neutralC: number): number {
  const diff = neutralC - tempC
  if (diff <= 0) return 0
  return diff / THERMAL.cloPerDegree
}

export interface ThermalPoint {
  operativeC: number
  feelsLikeC: number
  requiredClo: number
  windChillK: number
  humidityLoadK: number
}

/** 对某时刻算热状态 */
export function thermalPoint(
  tempC: number,
  windMs: number,
  humidityPercent: number,
  radiantGainK: number,
  neutralC: number,
): ThermalPoint {
  const wcK = windChillK(tempC, windMs)
  const hK = humidityLoadK(tempC, humidityPercent)
  const operative = tempC + radiantGainK - wcK + hK
  return {
    operativeC: round1(operative),
    feelsLikeC: round1(feelsLikeC(tempC, windMs, humidityPercent, radiantGainK)),
    requiredClo: round2(requiredIntrinsicClo(operative, neutralC)),
    windChillK: round2(wcK),
    humidityLoadK: round2(hK),
  }
}

export const round1 = (v: number) => Math.round(v * 10) / 10
export const round2 = (v: number) => Math.round(v * 100) / 100

/** 归一化到 0-100，带平滑边界 */
export function normalize(value: number, onset: number, full: number): number {
  if (value <= onset) return 0
  if (value >= full) return 100
  return Math.round(((value - onset) / (full - onset)) * 100)
}