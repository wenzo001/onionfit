// 边界状态推导：8 个真实会发生的样子，全部由 store / 结论里的事实触发，不假装确定
// 文案口径与 presentation.STATE_WALL 同源，避免两处清单漂移

import { computed } from 'vue'
import type { ComputedRef } from 'vue'
import { STATE_WALL, formatClock, umbrellaHeadline } from '@/presentation'
import type { AppState } from '@/presentation'
import type { OutfitRecommendation } from '@/core/types'
import type { useWeatherStore } from '@/stores/weather'

type Weather = ReturnType<typeof useWeatherStore>

export interface ActiveState extends AppState {
  /** day=主屏顶部条，timeline=「一天」屏，any=两屏都可出现 */
  scope: 'day' | 'timeline' | 'any'
  ctaAction?: 'refresh' | 'settings' | 'city'
}

/** DANGER 由 SafetyAlert 单独承载（唯一压过穿搭建议的样式），这里不重复出条 */
export function useBoundaryStates(
  weather: Weather,
  recommendation: ComputedRef<OutfitRecommendation | null>,
): { activeStates: ComputedRef<ActiveState[]> } {
  const activeStates = computed<ActiveState[]>(() => {
    const out: ActiveState[] = []
    const rec = recommendation.value
    const mins = weather.minutesAgo
    const hours = Math.floor(mins / 60)
    const clock = weather.report ? formatClock(new Date(weather.report.generatedAt)) : '--:--'

    // S8 连不上也定位不到：没数据就不给结论
    if (weather.error && !weather.report) {
      out.push(state('COLD_START_FAIL', { scope: 'day', ctaAction: 'city' }))
    }

    // S5 城市已切、天气还是上一座的
    if (weather.cityMismatch) {
      out.push(
        state('CITY_SWITCHING', {
          title: `正在切到${weather.city.name}…`,
          body: '上面还是上一座的天气，别急着出门',
          scope: 'day',
        }),
      )
    }

    // S1 离线快照 / S2 数据太旧
    if (weather.stale && weather.report) {
      out.push(
        state('OFFLINE_SNAPSHOT', {
          title: hours >= 1 ? `离线 · ${hours} 小时前的` : '离线 · 刚才的',
          body: rec
            ? `下面是 ${clock} 的结果：${rec.wornNowCount} 层 + ${umbrellaShort(rec)}`
            : `下面是 ${clock} 的结果`,
          scope: 'any',
        }),
      )
    } else if (mins > 60) {
      out.push(
        state('SNAPSHOT_STALE', {
          body: `${mins} 分钟没更新，别照它出门`,
          scope: 'any',
          ctaAction: 'refresh',
        }),
      )
    }

    // S3 定位被拒 → IP 兜底（城市级精度，结论可信度不同）
    if (weather.locationSource === 'ip') {
      out.push(
        state('GEO_DENIED', {
          body: `没拿到精确定位，按${weather.city.name}估算（城市级）`,
          scope: 'day',
          ctaAction: 'settings',
        }),
      )
    }

    // S4 没有逐时预报：脱衣时刻是估的
    if (weather.report && !weather.report.hasHourlyForecast) {
      out.push(state('NO_HOURLY', { scope: 'timeline' }))
    }

    // S6 一天不用加减层
    if (rec && rec.timeline.length === 0) {
      out.push(state('NO_TIMELINE', { scope: 'timeline' }))
    }

    return out
  })

  return { activeStates }
}

function umbrellaShort(rec: OutfitRecommendation): string {
  return rec.umbrella.verdict === 'SKIP' ? '不用带伞' : umbrellaHeadline(rec.umbrella)
}

function state(key: StateKey, patch: Pick<ActiveState, 'scope'> & Partial<ActiveState>): ActiveState {
  const base = STATES.get(key)
  // 状态文案是设计资产，取不到说明 key 写错——开发期直接暴露，不在界面上静默兜底
  if (!base) throw new Error(`未登记的状态：${key}`)
  return { ...base, ...patch }
}

const STATE_KEYS = [
  'OFFLINE_SNAPSHOT',
  'SNAPSHOT_STALE',
  'GEO_DENIED',
  'NO_HOURLY',
  'CITY_SWITCHING',
  'NO_TIMELINE',
  'DANGER',
  'COLD_START_FAIL',
] as const

type StateKey = (typeof STATE_KEYS)[number]

const STATES = new Map<string, AppState>(STATE_WALL.map((s) => [s.key, s]))
