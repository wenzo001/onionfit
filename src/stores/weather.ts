// 城市与天气 store：当前城市、天气快照、加载态、错误、刷新
// 定位来源与「城市已切、天气未切」是界面边界状态的依据，必须在 store 留痕（不在组件里猜）

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import type { CityInfo, WeatherReport } from '@/core/types'
import { readSnapshot, writeSnapshot } from '@/data/snapshot'
import { WeatherService } from '@/services/weatherService'
import { useSettingsStore } from './settings'

export type LocationSource = 'gps' | 'ip' | 'manual'

const LOCATION_SOURCE_KEY = 'onionfit.locationSource'

/** 定位来源持久化：读写都在 store 单点负责，格式与设置里的 onboarded 标记一致 */
function readLocationSource(): LocationSource {
  const raw = (localStorage.getItem(LOCATION_SOURCE_KEY) ?? '').replace(/"/g, '')
  return raw === 'ip' || raw === 'gps' ? raw : 'manual'
}

const service = new WeatherService()

export const useWeatherStore = defineStore('weather', () => {
  const saved = readSnapshot()

  const city = ref<CityInfo>(saved.city)
  const report = ref<WeatherReport | null>(saved.weather)
  const loading = ref(false)
  const refreshing = ref(false)
  const error = ref<string | null>(null)
  const stale = ref(false)
  const lastFetchedAt = ref<Date | null>(null)
  const sourceLabel = ref('Open-Meteo')
  /** 当前城市坐标是怎么来的：精确定位 / 定位被拒走 IP / 手动选城 */
  const locationSource = ref<LocationSource>(readLocationSource())

  function setLocationSource(source: LocationSource): void {
    locationSource.value = source
    try {
      localStorage.setItem(LOCATION_SOURCE_KEY, JSON.stringify(source))
    } catch {
      // 隐私模式下不落盘，本次会话仍然知道来源
    }
  }

  /** 城市已切换但天气还是上一座的（切城过程中的过渡态，必须显式告诉用户） */
  const cityMismatch = computed(() => {
    const r = report.value
    if (!r) return false
    return Math.abs(r.lat - city.value.lat) > 0.01 || Math.abs(r.lon - city.value.lon) > 0.01
  })

  /** 数据是否久于 60 分钟（stale 标记，FR-08 简化） */
  const isStale = computed(() => {
    if (!report.value) return false
    try {
      const minutes = (Date.now() - new Date(report.value.generatedAt).getTime()) / 60000
      return minutes > 60
    } catch {
      return false
    }
  })

  /** 距上次成功更新的分钟数 */
  const minutesAgo = computed(() => {
    if (!report.value) return 0
    try {
      return Math.max(
        0,
        Math.floor((Date.now() - new Date(report.value.generatedAt).getTime()) / 60000),
      )
    } catch {
      return 0
    }
  })

  const settingsStore = useSettingsStore()

  /** 重新拉取当前城市天气 → 更新快照 → 持久化 */
  async function refresh(): Promise<void> {
    if (loading.value) return
    loading.value = true
    error.value = null
    try {
      const result = await service.fetchOrCached(city.value.lat, city.value.lon, report.value)
      report.value = result.report
      stale.value = result.stale
      sourceLabel.value = result.sourceLabel
      lastFetchedAt.value = result.stale && report.value ? fromMinutesAgo(result.minutesAgo) : new Date()
      persist()
    } catch (err) {
      error.value = err instanceof Error ? err.message : String(err)
    } finally {
      loading.value = false
      refreshing.value = false
    }
  }

  /** 更换城市（选城页调用）：乐观更新——城市立即切换、旧天气保留展示，新数据到达后平滑替换 */
  async function selectCity(newCity: CityInfo, source: LocationSource = 'manual'): Promise<void> {
    city.value = newCity
    setLocationSource(source)
    stale.value = false
    error.value = null
    await refresh()
  }

  /** 只重算不网络：设置变化时由页面 watch 触发，这里保证存在数据 */
  function ensureData(): void {
    if (!report.value && !loading.value) void refresh()
  }

  function persist(): void {
    writeSnapshot({
      city: city.value,
      weather: report.value,
      settings: settingsStore.settings,
      updatedAt: new Date().toISOString(),
    })
  }

  /** 启动时立即尝试刷新（首次进入有天气） */
  function bootstrap(): void {
    if (!report.value) void refresh()
  }

  return {
    city,
    report,
    loading,
    refreshing,
    error,
    stale,
    lastFetchedAt,
    sourceLabel,
    locationSource,
    setLocationSource,
    cityMismatch,
    isStale,
    minutesAgo,
    refresh,
    selectCity,
    ensureData,
    bootstrap,
    persist,
  }
})

function fromMinutesAgo(min: number): Date {
  return new Date(Date.now() - min * 60000)
}