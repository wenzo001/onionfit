<script setup lang="ts">
// 一天（屏 03 的时间线部分）：Q3「之后几点」—— 加减层事件、24h 曲线、三段、配饰
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import InkCard from '@/components/InkCard.vue'
import SectionTitle from '@/components/SectionTitle.vue'
import HoursCurve from '@/components/HoursCurve.vue'
import EventList from '@/components/EventList.vue'
import AccessoryRow from '@/components/AccessoryRow.vue'
import StateBanner from '@/components/StateBanner.vue'
import TomorrowRow from '@/components/TomorrowRow.vue'
import PageSkeleton from '@/components/PageSkeleton.vue'
import { usePlan } from '@/composables/usePlan'
import { useBoundaryStates } from '@/composables/useBoundaryStates'
import { CURVE_HINT } from '@/presentation'

const router = useRouter()
const { weather, report, recommendation, now: clock } = usePlan()
const { activeStates } = useBoundaryStates(weather, recommendation)

const rec = computed(() => recommendation.value)
const nextDay = computed(() => report.value?.daily[1] ?? null)
const nowHour = computed(() => clock.value.getHours())
const doffHour = computed(() => {
  const e = rec.value?.timeline.find((x) => x.action === 'REMOVE')
  return e ? Number(e.hour.split(':')[0]) : null
})
const view = computed(() => {
  if (!rec.value || !report.value || !nextDay.value) return null
  return { rec: rec.value, report: report.value, next: nextDay.value }
})
</script>

<template>
  <div class="page">
    <div class="screen">
      <StateBanner
        v-for="s in activeStates"
        :key="s.key"
        class="span-all"
        :state="s"
        @cta="router.push({ name: 'me' })"
      />

      <PageSkeleton v-if="!view && !weather.error" />
      <template v-else-if="view">
      <section class="col">
        <SectionTitle
          title="接下来几点"
          sub="最多 6 条"
        />
        <EventList :rec="view.rec" :now-hour="nowHour" />
      </section>

      <section class="col">
        <SectionTitle
          title="今天 24 小时"
          :sub="CURVE_HINT"
        />
        <InkCard class="pad">
          <HoursCurve
            :hourly="view.report.hourly"
            :now-hour="nowHour"
            :doff-hour="doffHour"
          />
        </InkCard>
        <TomorrowRow
          :rec="view.rec"
          :next="view.next"
        />
      </section>

      <section class="col col-wide">
        <SectionTitle
          title="别忘了这些"
          sub="配饰按阈值触发"
        />
        <AccessoryRow :rec="view.rec" />
      </section>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/tokens' as *;

.col {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.col-wide {
  grid-column: 1 / -1;
}

.pad {
  padding: #{$sp} #{$sp} #{$sp * 1.25};
}
</style>
