<script setup lang="ts">
// 带伞（屏 03 的 Q4 部分）：结论 + 通勤段明细 + 三种答案的口径说明
// 三个结论只有一个会出现，这里同时把「另外两个长什么样」讲清，避免用户以为漏判
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import InkCard from '@/components/InkCard.vue'
import BadgePill from '@/components/BadgePill.vue'
import SectionTitle from '@/components/SectionTitle.vue'
import UmbrellaCard from '@/components/UmbrellaCard.vue'
import StateBanner from '@/components/StateBanner.vue'
import PageSkeleton from '@/components/PageSkeleton.vue'
import { usePlan } from '@/composables/usePlan'
import { useBoundaryStates } from '@/composables/useBoundaryStates'
import { UMBRELLA_OUTCOMES, formatClock } from '@/presentation'

const router = useRouter()
const { weather, settings, recommendation } = usePlan()
const { activeStates } = useBoundaryStates(weather, recommendation)

const rec = computed(() => recommendation.value)
const states = computed(() => activeStates.value.filter((s) => s.scope !== 'timeline'))
const commute = computed(() => ({ out: settings.outTime, home: settings.homeTime }))
const now = computed(() => formatClock(new Date()))
</script>

<template>
  <div class="page">
    <div class="screen">
      <StateBanner
        v-for="s in states"
        :key="s.key"
        class="span-all"
        :state="s"
        @cta="router.push({ name: 'me' })"
      />

      <PageSkeleton v-if="!rec && !weather.error" />
      <template v-else-if="rec">
      <section class="col">
        <SectionTitle
          title="带伞"
          sub="按通勤两段的暴露窗口测算"
        />
        <UmbrellaCard
          :umbrella="rec.umbrella"
          :commute="commute"
          @adjust="router.push({ name: 'me' })"
        />
      </section>

      <section class="col">
        <SectionTitle
          title="带伞三种答案"
          sub="只有一个会出现"
        />
        <InkCard
          flat
          class="legend"
        >
          <div
            v-for="o in UMBRELLA_OUTCOMES"
            :key="o.key"
            class="line"
            :class="{ current: o.key === rec.umbrella.verdict }"
          >
            <BadgePill :tone="o.key === 'BRING' ? 'blue' : o.key === 'RAINCOAT' ? 'orange' : 'mint'">
              {{ o.key }}
            </BadgePill>
            <div class="copy">
              <b>{{ o.label }}</b>
              <span>{{ o.note }}</span>
            </div>
          </div>
        </InkCard>

        <InkCard
          tone="paper"
          class="commute"
        >
          <div class="row">
            <span class="k">出门</span>
            <b class="num">{{ commute.out ?? '未设置' }}</b>
          </div>
          <div class="row">
            <span class="k">回家</span>
            <b class="num">{{ commute.home ?? '未设置' }}</b>
          </div>
          <div class="row">
            <span class="k">现在</span>
            <b class="num now">{{ now }}</b>
          </div>
          <button
            type="button"
            class="edit"
            @click="router.push({ name: 'me' })"
          >
            改通勤时间 →
          </button>
        </InkCard>
      </section>
      </template>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/tokens' as *;

.page {
  min-height: 100vh;
}

.col {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.legend {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.line {
  display: flex;
  align-items: center;
  gap: #{$sp};
  padding: 6px #{$sp};
  border: 2px solid rgba(0, 0, 0, 0.16);
  border-radius: var(--r);

  &.current {
    border: var(--sw) solid var(--ink);
    background: var(--paper);
    box-shadow: 2px 2px 0 var(--ink);
  }
}

.copy {
  min-width: 0;
}

.copy b {
  display: block;
  font-size: 13px;
  font-weight: #{$title-weight};
  color: var(--ink);
}

.copy span {
  display: block;
  font-size: 11.5px;
  color: rgba(0, 0, 0, 0.7);
}

.commute {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 13px;
}

.row .k {
  color: rgba(0, 0, 0, 0.66);
  font-weight: 700;
}

.row b {
  font-weight: #{$numeral-weight};
  color: var(--ink);
}

.row b.now {
  color: var(--pink);
}

.edit {
  min-height: 44px;
  margin-top: 6px;
  border: var(--sw) solid var(--ink);
  border-radius: var(--r);
  background: var(--card);
  font-size: 12.5px;
  font-weight: 800;
  color: var(--ink);
}
</style>
