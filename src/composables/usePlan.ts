// 把 planner 的确定性结论接给界面：同输入必同输出，界面不做任何判断
import { computed, watch } from 'vue'
import { useWeatherStore } from '@/stores/weather'
import { useSettingsStore } from '@/stores/settings'
import { useNow } from './useNow'
import { plan } from '@/core/engine/planner'
import { dateKey, recordShown, rollPreviousItems } from '@/core/engine/prefs'
import type { ActivityKind, OutfitRecommendation, WeatherReport } from '@/core/types'

export function usePlan() {
  const weather = useWeatherStore()
  const settings = useSettingsStore()
  const now = useNow()

  const report = computed<WeatherReport | null>(() => weather.report)

  const planDate = computed(() => dateKey(now.value))

  // 跨天先抬升「上一套」再算：当天重复访问不抬（多样性分对比的是昨天那套）
  const planSettings = computed(() => rollPreviousItems(settings.settings, planDate.value) ?? settings.settings)

  // now 是入参：挂着的页面跨过整点后，正穿/带着与通勤段会自己更新（同输入仍同输出）
  const recommendation = computed<OutfitRecommendation | null>(() =>
    weather.report ? plan({ report: weather.report, settings: planSettings.value, now: now.value }) : null,
  )

  // 抬升结果写回一次（immediate：挂载即有缓存快照时也要立即落盘，不能等一次"恰好发生"的重算）
  // 幂等：写回后再算 rollPreviousItems 必为 null，不会形成写循环
  watch(
    planSettings,
    (v) => {
      if (v !== settings.settings) settings.replace(v)
    },
    { immediate: true },
  )

  // 输出侧记录本轮展示的整套（lastShown 不参与本轮打分，只有跨天才抬进 previousItemIds）
  // immediate：挂载时快照已给出整套就算"已展示"；幂等（同日同套返回 null），不会形成写循环
  watch(
    recommendation,
    (rec) => {
      if (!rec) return
      const ids = rec.dayOutfit.layers.flatMap((l) => l.items.map((i) => i.id))
      const next = recordShown(settings.settings, ids, planDate.value)
      if (next) settings.replace(next)
    },
    { immediate: true },
  )

  /** 换成另一个活动再算一份：本地纯计算，用来证明「改完立刻重算」真的有差异 */
  function planAs(activity: ActivityKind): OutfitRecommendation | null {
    if (!weather.report) return null
    return plan({ report: weather.report, settings: { ...planSettings.value, activity }, now: now.value })
  }

  return { weather, settings, report, recommendation, planAs, now, planDate }
}
