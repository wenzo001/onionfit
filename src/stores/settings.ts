// 用户设置 store：deck 14 的 12 个维度（人群/体质/出汗/活动/暴露/场合/出门/回家/风格/呈现/版型/色彩）
// 就地修改、改设置只重算不重新拉网络（FR-05）
// 全量持久化到 localStorage（类原生应用：重启/刷新后配置仍在）

import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { useLocalStorage } from '@vueuse/core'
import type { UserSettings } from '@/core/types'
import { DEFAULT_SETTINGS } from '@/core/types'
import { readSnapshot } from '@/data/snapshot'

const SETTINGS_KEY = 'onionfit.settings'
const ONBOARD_KEY = 'onionfit.onboarded'

/** localStorage 不可用（隐私模式/测试环境）时一律按未完成处理 */
function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === '1'
  } catch {
    return false
  }
}

/** 初始值：优先本地缓存；老版本设置存在 app 快照里，首次迁移 */
function initialSettings(): UserSettings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<UserSettings>
      return { ...DEFAULT_SETTINGS, ...parsed }
    }
    // 迁移旧快照（早期版本设置随天气快照存储）
    const snap = readSnapshot()
    if (snap.settings) return snap.settings
  } catch {
    // 解析失败回默认
  }
  return { ...DEFAULT_SETTINGS }
}

export const useSettingsStore = defineStore('settings', () => {
  const state = useLocalStorage<UserSettings>(SETTINGS_KEY, initialSettings(), {
    // 标签页间不互相覆盖；写回由本 store 单点负责
    listenToStorageChanges: false,
  })

  /** 是否已完成首次引导（首次进入自动展开设置面板，完成后不再打扰） */
  const isOnboarded = ref(readFlag(ONBOARD_KEY))

  function completeOnboarding(): void {
    try {
      localStorage.setItem(ONBOARD_KEY, '1')
    } catch {
      // 隐私模式等静默失败，不影响会话
    }
    isOnboarded.value = true
  }

  const profile = computed(() => state.value.profile)
  const sensitivity = computed(() => state.value.sensitivity)
  const activity = computed(() => state.value.activity)
  const outTime = computed(() => state.value.outTime)
  const homeTime = computed(() => state.value.homeTime)

  /** 交给引擎的完整设置：12 个维度一个不少（曾只透传 5 个，扩展维度被静默剥掉） */
  const settings = computed<UserSettings>(() => ({ ...state.value }))

  /** 是否有完整日程（两时间都填） */
  const hasSchedule = computed(() => Boolean(state.value.outTime && state.value.homeTime))

  function apply(saved: UserSettings | null) {
    if (!saved) return
    state.value = {
      ...DEFAULT_SETTINGS,
      ...saved,
      profile: saved.profile ?? DEFAULT_SETTINGS.profile,
      sensitivity: saved.sensitivity ?? DEFAULT_SETTINGS.sensitivity,
      activity: saved.activity ?? DEFAULT_SETTINGS.activity,
      outTime: saved.outTime ?? null,
      homeTime: saved.homeTime ?? null,
    }
  }

  /** 通用赋值：时间空串归一化为 null（= 用默认 07:30 / 18:00），其余原样写入 */
  function set(key: keyof UserSettings, value: unknown) {
    if (key === 'outTime' || key === 'homeTime') {
      state.value = { ...state.value, [key]: (value as string) || null }
      return
    }
    state.value = { ...state.value, [key]: value } as UserSettings
  }

  function clearSchedule() {
    state.value = { ...state.value, outTime: null, homeTime: null }
  }

  return {
    profile,
    sensitivity,
    activity,
    outTime,
    homeTime,
    settings,
    hasSchedule,
    isOnboarded,
    completeOnboarding,
    apply,
    set,
    clearSchedule,
  }
})
