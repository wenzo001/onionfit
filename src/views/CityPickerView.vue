<script setup lang="ts">
// 选城页：中文搜索（防抖 300ms）+ 一键定位
// 定位结果把「精度来源」写回 store（GPS / IP 兜底），带伞与边界状态都读这一位
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useDebounceFn, useVibrate } from '@vueuse/core'
import AppIcon from '@/components/AppIcon.vue'
import InkCard from '@/components/InkCard.vue'
import { searchCities } from '@/data/geo/citySearch'
import { CityService } from '@/services/cityService'
import { useWeatherStore } from '@/stores/weather'
import type { CityInfo } from '@/core/types'

const router = useRouter()
const weather = useWeatherStore()
const cityService = new CityService()

const query = ref('')
const results = ref<CityInfo[]>([])
const searching = ref(false)
const locating = ref(false)
const locatingError = ref<string | null>(null)
const searchError = ref<string | null>(null)
const hasSearched = ref(false)

const { vibrate } = useVibrate({ pattern: [10] })

async function doSearch() {
  const q = query.value.trim()
  if (!q) {
    results.value = []
    hasSearched.value = false
    return
  }
  searching.value = true
  searchError.value = null
  try {
    results.value = await searchCities(q)
    hasSearched.value = true
  } catch {
    searchError.value = '搜索失败，请检查网络'
  } finally {
    searching.value = false
  }
}

const debouncedSearch = useDebounceFn(doSearch, 300)

async function pick(city: CityInfo, source: 'gps' | 'ip' | 'manual' = 'manual') {
  vibrate()
  await weather.selectCity(city, source)
  goBack()
}

async function locate() {
  locating.value = true
  locatingError.value = null
  const outcome = await cityService.locateCurrent()
  locating.value = false
  if (outcome.error) {
    locatingError.value = outcome.error
    return
  }
  await pick(outcome.city, outcome.viaIpFallback ? 'ip' : 'gps')
}

/** 从选城页返回：仅当确实从应用内导航而来时 back，深链接/刷新进入时回首页 */
function goBack() {
  const back = router.options.history.state.back as string | null | undefined
  const isFromApp = Boolean(back && back !== 'about:blank' && back.startsWith(location.origin))
  if (isFromApp) router.back()
  else router.replace({ name: 'day' })
}
</script>

<template>
  <main class="picker-page">
    <!-- 搜索栏钉在顶部（iOS 选城页的行为），结果列表从它下面滚过去 -->
    <div class="topbar">
      <header class="picker-header">
        <button
          type="button"
          class="back-btn"
          aria-label="返回"
          @click="goBack"
        >
          <AppIcon
            icon="fluent:chevron-left-28-regular"
            :size="22"
          />
        </button>
        <h1 class="title">选择城市</h1>
        <div class="header-spacer" />
      </header>

      <InkCard class="search-box">
        <AppIcon
          icon="fluent:search-24-regular"
          :size="18"
          class="search-icon"
        />
        <input
          v-model="query"
          type="search"
          class="search-input"
          placeholder="搜索城市（中文）"
          @input="debouncedSearch"
        />
        <button
          v-if="query"
          type="button"
          class="clear-btn"
          aria-label="清除"
          @click="query = ''; results = []; hasSearched = false"
        >
          <AppIcon
            icon="fluent:dismiss-circle-24-regular"
            :size="18"
          />
        </button>
      </InkCard>
    </div>

    <button
      type="button"
      class="locate-btn"
      :disabled="locating"
      @click="locate"
    >
      <AppIcon
        icon="fluent:location-28-regular"
        :size="18"
      />
      <span>{{ locating ? '定位中…' : '使用我的当前位置' }}</span>
    </button>

    <p
      v-if="locatingError"
      class="notice warn"
    >
      {{ locatingError }}
    </p>
    <p
      v-if="searchError"
      class="notice warn"
    >
      {{ searchError }}
    </p>

    <div
      v-if="searching"
      class="notice"
    >
      搜索中…
    </div>

    <ul
      v-else-if="results.length"
      class="result-list"
    >
      <li
        v-for="c in results"
        :key="c.id"
        class="result-item"
      >
        <button
          type="button"
          class="result-btn"
          @click="pick(c)"
        >
          <span class="result-name">{{ c.name }}</span>
          <span
            v-if="c.admin1 || c.country"
            class="result-sub"
          >{{ [c.admin1, c.country].filter(Boolean).join(' · ') }}</span>
        </button>
      </li>
    </ul>

    <div
      v-else-if="hasSearched"
      class="notice"
    >
      未找到相关城市
    </div>
  </main>
</template>

<style scoped lang="scss">
@use '@/styles/tokens' as *;

.picker-page {
  padding: 0 #{$page-pad} calc(env(safe-area-inset-bottom, 12px) + #{$sp * 3});
  background: var(--paper);
}

/* 钉住的搜索区：横向用负 margin 铺满，滚过去的结果列表才不会从它两侧露出来 */
.topbar {
  position: sticky;
  top: 0;
  z-index: 6;
  padding: calc(env(safe-area-inset-top, 0px) + #{$sp}) #{$page-pad} #{$sp};
  margin: 0 -#{$page-pad};
  background: var(--paper);
}

.picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: #{$sp};
}

.back-btn {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border: var(--sw) solid var(--ink);
  border-radius: 50%;
  background: var(--card);
  color: var(--ink);
  box-shadow: 2px 2px 0 var(--ink);
}

.title {
  font-size: 17px;
  font-weight: #{$title-weight};
  color: var(--ink);
}

.header-spacer {
  width: 44px;
}

.search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 #{$sp};
  min-height: 48px;
}

.search-icon {
  color: rgba(0, 0, 0, 0.55);
}

.search-input {
  flex: 1;
  min-width: 0;
  background: none;
  border: none;
  outline: none;
  color: var(--ink);
  font-size: 16px;
  font-weight: 700;

  &::placeholder {
    color: rgba(0, 0, 0, 0.45);
    font-weight: 400;
  }
}

.clear-btn {
  display: grid;
  place-items: center;
  width: 32px;
  height: 32px;
  color: rgba(0, 0, 0, 0.55);
}

.locate-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  min-height: 48px;
  margin-top: #{$sp * 1.5};
  border: var(--sw) solid var(--ink);
  border-radius: var(--r);
  background: var(--orange);
  color: var(--ink);
  font-size: 14px;
  font-weight: #{$title-weight};
  box-shadow: var(--shadow);

  &:disabled {
    opacity: 0.6;
    box-shadow: none;
  }
}

.notice {
  margin-top: #{$sp};
  font-size: 12.5px;
  color: rgba(0, 0, 0, 0.6);
  text-align: center;
}

.notice.warn {
  color: #{$warn};
  font-weight: 700;
}

.result-list {
  list-style: none;
  margin: #{$sp * 1.5} 0 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.result-btn {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  width: 100%;
  min-height: 48px;
  padding: 8px #{$sp * 1.5};
  border: var(--sw) solid var(--ink);
  border-radius: var(--r);
  background: var(--card);
  text-align: left;
}

.result-name {
  font-size: 15px;
  font-weight: #{$title-weight};
  color: var(--ink);
}

.result-sub {
  font-size: 11.5px;
  color: rgba(0, 0, 0, 0.62);
}
</style>
