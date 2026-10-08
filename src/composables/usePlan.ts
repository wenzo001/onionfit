// 把 planner 的确定性结论接给界面：同输入必同输出，界面不做任何判断
import { computed } from 'vue'
import { useWeatherStore } from '@/stores/weather'
import { useSettingsStore } from '@/stores/settings'
import { useNow } from './useNow'
import { plan } from '@/core/engine/planner'
import type { ActivityKind, OutfitRecommendation, WeatherReport } from '@/core/types'

export function usePlan() {
  const weather = useWeatherStore()
  const settings = useSettingsStore()
  const now = useNow()

  const report = computed<WeatherReport | null>(() => weather.report)

  // now 是入参：挂着的页面跨过整点后，正穿/带着与通勤段会自己更新（同输入仍同输出）
  const recommendation = computed<OutfitRecommendation | null>(() =>
    weather.report ? plan({ report: weather.report, settings: settings.settings, now: now.value }) : null,
  )

  /** 换成另一个活动再算一份：本地纯计算，用来证明「改完立刻重算」真的有差异 */
  function planAs(activity: ActivityKind): OutfitRecommendation | null {
    if (!weather.report) return null
    return plan({ report: weather.report, settings: { ...settings.settings, activity }, now: now.value })
  }

  return { weather, settings, report, recommendation, planAs, now }
}
