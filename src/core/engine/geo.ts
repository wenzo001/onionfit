// GeoEngine：地理与气候上下文（方案 §4，第三步）
// 只消费天气源已有的位置字段（lat/lon/timezone）与日期；缺位置时降置信度并标记 fallback。
// 不引入气候带数据库、不做"按气候带加减温度"；沿海 / 海拔修正仅在对应气象字段缺失时
// 才该启用——当前天气源不缺这些字段，故不启用，也不重复加成。

import { GEO } from '../config'
import type { GeoClimateContext, WeatherReport } from '@/core/types'

export type { GeoClimateContext } from '@/core/types'

/** 气象季节：月份 + 半球；赤道带与缺位置都返回 unknown（不做无依据的推断） */
export function seasonOf(
  month: number,
  hemisphere: GeoClimateContext['hemisphere'],
): GeoClimateContext['season'] {
  if (!Number.isFinite(month) || month < 1 || month > 12) return 'unknown'
  if (hemisphere === 'unknown') return 'unknown'
  const north: GeoClimateContext['season'] =
    month >= 3 && month <= 5
      ? 'spring'
      : month >= 6 && month <= 8
        ? 'summer'
        : month >= 9 && month <= 11
          ? 'autumn'
          : 'winter'
  if (hemisphere === 'north') return north
  const opposite = {
    spring: 'autumn',
    summer: 'winter',
    autumn: 'spring',
    winter: 'summer',
  } as const
  return opposite[north as keyof typeof opposite]
}

/** 由天气报告 + 当前时刻构建地理气候上下文 */
export function buildGeoClimate(report: WeatherReport, now: Date): GeoClimateContext {
  const latitude = Number.isFinite(report.lat) ? report.lat : null
  const longitude = Number.isFinite(report.lon) ? report.lon : null
  const timezone = report.timezone ? report.timezone : null
  const hasLocation = latitude !== null && longitude !== null
  const hemisphere: GeoClimateContext['hemisphere'] =
    latitude === null || latitude === 0 ? 'unknown' : latitude > 0 ? 'north' : 'south'
  const month = now.getMonth() + 1

  return {
    latitude,
    longitude,
    timezone,
    hemisphere,
    season: hasLocation ? seasonOf(month, hemisphere) : 'unknown',
    dataSource: hasLocation ? 'forecast' : 'fallback',
    confidence: hasLocation ? GEO.confidenceWithLocation : GEO.confidenceWithoutLocation,
    missingInputs: hasLocation ? [] : ['location'],
  }
}
