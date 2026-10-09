<script setup lang="ts">
// 今日主屏（屏 01）：Q2 此刻穿几层是唯一主角，Q4 带伞第二块，Q5 明日压成一行
// 平板双栏（左：此刻穿什么 / 右：一屏看完一天），桌面三栏再加「依据」列
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import HeroCard from '@/components/HeroCard.vue'
import LayerCard from '@/components/LayerCard.vue'
import UmbrellaCard from '@/components/UmbrellaCard.vue'
import TomorrowRow from '@/components/TomorrowRow.vue'
import SafetyAlert from '@/components/SafetyAlert.vue'
import StateBanner from '@/components/StateBanner.vue'
import InkCard from '@/components/InkCard.vue'
import SectionTitle from '@/components/SectionTitle.vue'
import HoursCurve from '@/components/HoursCurve.vue'
import EventList from '@/components/EventList.vue'
import DemandBars from '@/components/DemandBars.vue'
import WhyCard from '@/components/WhyCard.vue'
import CheckupCard from '@/components/CheckupCard.vue'
import PageSkeleton from '@/components/PageSkeleton.vue'
import { usePlan } from '@/composables/usePlan'
import { useBoundaryStates } from '@/composables/useBoundaryStates'
import { usePullToRefresh } from '@/composables/usePullToRefresh'
import { useSettingsStore } from '@/stores/settings'
import { CURVE_HINT } from '@/presentation'

const router = useRouter()
const { weather, settings, report, recommendation, now: clock } = usePlan()
const { activeStates } = useBoundaryStates(weather, recommendation)

weather.bootstrap()

// 首次使用先走零索取引导
const appSettings = useSettingsStore()
if (!appSettings.isOnboarded && !weather.report) {
  router.replace({ name: 'welcome' })
}

const scrollRef = ref<HTMLElement | null>(null)
const pull = usePullToRefresh(scrollRef, () => weather.refresh())
const pullStyle = computed(() => ({
  transform: `translateY(${pull.distance}px)`,
  transition: pull.refreshing ? 'transform 0.3s' : 'none',
}))

const rec = computed(() => recommendation.value)
const dayStates = computed(() => activeStates.value.filter((s) => s.scope !== 'timeline'))
const nextDay = computed(() => report.value?.daily[1] ?? null)
const nowHour = computed(() => clock.value.getHours())
const doffHour = computed(() => {
  const e = rec.value?.timeline.find((x) => x.action === 'REMOVE')
  return e ? Number(e.hour.split(':')[0]) : null
})

/** 一次收口：拿到这里就保证 rec / report / next 三者同时存在，模板不再写断言 */
const view = computed(() => {
  if (!rec.value || !report.value || !nextDay.value) return null
  return { rec: rec.value, report: report.value, next: nextDay.value }
})

function onCta(action: 'refresh' | 'settings' | 'city') {
  if (action === 'refresh') void weather.refresh()
  else if (action === 'city') router.push({ name: 'city' })
  else router.push({ name: 'me' })
}
</script>

<template>
  <div
    ref="scrollRef"
    class="day-page"
  >
    <div
      class="pull"
      :class="{ show: pull.distance > 0 || pull.refreshing }"
    >
      {{ pull.refreshing ? '刷新中…' : pull.ready ? '松开刷新' : '下拉刷新' }}
    </div>

    <div
      class="content"
      :style="pullStyle"
    >
      <div class="screen">
        <!-- 唯一压过穿搭建议的样式，永远在最顶 -->
        <SafetyAlert
          v-if="view"
          class="span-all"
          :safety="view.rec.safety"
          :facts="view.rec.facts"
        />

        <StateBanner
          v-for="s in dayStates"
          :key="s.key"
          class="span-all"
          :state="s"
          @cta="onCta"
        />

        <!-- 没数据就不给结论：只有真在拉取时才显示占位，失败态直说（S8） -->
        <PageSkeleton v-if="!view && !weather.error" />
        <template v-else-if="view">
          <section class="col-now">
          <HeroCard
            :rec="view.rec"
            :city="weather.city"
            :generated-at="view.report.generatedAt"
            @pick-city="router.push({ name: 'city' })"
          />
          <LayerCard :rec="view.rec" />
          <UmbrellaCard
            :umbrella="view.rec.umbrella"
            :commute="{ out: settings.outTime, home: settings.homeTime }"
            @adjust="router.push({ name: 'me' })"
          />
          <TomorrowRow
            :rec="view.rec"
            :next="view.next"
          />
        </section>

        <section class="col-day">
          <SectionTitle
            title="一屏看完一天"
            :sub="CURVE_HINT"
          />
          <InkCard class="curve-card">
            <HoursCurve
              :hourly="view.report.hourly"
              :now-hour="nowHour"
              :doff-hour="doffHour"
            />
          </InkCard>
          <EventList :rec="view.rec" :now-hour="nowHour" />
        </section>

        <section class="col-evidence">
          <SectionTitle
            title="依据"
            sub="这套怎么来的"
          />
          <InkCard class="curve-card">
            <DemandBars
              :vector="view.rec.demand.vector"
              :facts="view.rec.facts"
              :safety="view.rec.safety"
            />
          </InkCard>
          <WhyCard :rec="view.rec" />
          <CheckupCard :rec="view.rec" />
        </section>
        </template>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/tokens' as *;

.day-page {
  position: relative;
  overflow-x: clip;
}

.content {
  position: relative;
}

.pull {
  position: fixed;
  top: calc(env(safe-area-inset-top, 0px) + 4px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 6;
  padding: 3px 12px;
  border: 2px solid var(--ink);
  border-radius: var(--r-pill);
  background: var(--card);
  font-family: var(--font-num);
  font-size: 11px;
  font-weight: #{$numeral-weight};
  color: var(--ink);
  opacity: 0;
  transition: opacity 0.2s ease;
}

.pull.show {
  opacity: 1;
}

.col-now,
.col-day,
.col-evidence {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

/* 依据列只在桌面三栏出现；窄屏走 /onion 下钻屏，不在这里挤 */
.col-evidence {
  display: none;
}

@media (min-width: $bp-desktop) {
  .col-evidence {
    display: flex;
  }
}

.curve-card {
  padding: #{$sp} #{$sp} #{$sp * 1.25};
}
</style>
