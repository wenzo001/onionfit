// 把 planner 的确定性结论接给界面：同输入必同输出，界面不做任何判断
import { computed } from 'vue'
import { useWeatherStore } from '@/stores/weather'
import { useSettingsStore } from '@/stores/settings'
import { plan } from '@/core/engine/planner'
import type { ActivityKind, OutfitRecommendation, WeatherReport } from '@/core/types'

export function usePlan() {
  const weather = useWeatherStore()
  const settings = useSettingsStore()

  const report = computed<WeatherReport | null>(() => weather.report)

  const recommendation = computed<OutfitRecommendation | null>(() =>
    weather.report ? plan({ report: weather.report, settings: settings.settings }) : null,
  )

  /** 换成另一个活动再算一份：本地纯计算，用来证明「改完立刻重算」真的有差异 */
  function planAs(activity: ActivityKind): OutfitRecommendation | null {
    if (!weather.report) return null
    return plan({ report: weather.report, settings: { ...settings.settings, activity } })
  }

  return { weather, settings, report, recommendation, planAs }
}
