<script setup lang="ts">
// 带伞（deck 16 雨具两件事）：穿与带分开给结论，共用同一组事实；下接三态口径说明
// 三个带伞结论只有一个会出现，这里同时把「另外两个长什么样」讲清，避免用户以为漏判
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import InkCard from '@/components/InkCard.vue'
import BadgePill from '@/components/BadgePill.vue'
import SectionTitle from '@/components/SectionTitle.vue'
import UmbrellaCard from '@/components/UmbrellaCard.vue'
import RainWearCard from '@/components/RainWearCard.vue'
import StateBanner from '@/components/StateBanner.vue'
import PageSkeleton from '@/components/PageSkeleton.vue'
import { usePlan } from '@/composables/usePlan'
import { useBoundaryStates } from '@/composables/useBoundaryStates'
import { UMBRELLA_OUTCOMES, formatClock, rainFacts } from '@/presentation'

const router = useRouter()
const { weather, settings, recommendation, now: clock } = usePlan()
const { activeStates } = useBoundaryStates(weather, recommendation)

const rec = computed(() => recommendation.value)
const states = computed(() => activeStates.value.filter((s) => s.scope !== 'timeline'))
const commute = computed(() => ({ out: settings.outTime, home: settings.homeTime }))
const now = computed(() => formatClock(clock.value))
const facts = computed(() => (rec.value ? rainFacts(rec.value, commute.value) : []))
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
          title="雨具两件事"
          sub="穿着和携带分开判断，但共用同一组事实"
        />
        <RainWearCard :rec="rec" />
        <UmbrellaCard
          :umbrella="rec.umbrella"
          :commute="commute"
          label="要带"
          @adjust="router.push({ name: 'me' })"
        />
        <InkCard
          tone="yellow"
          class="facts"
        >
          <b class="facts-title">两条结论用的是同一组事实</b>
          <div class="chips">
            <div
              v-for="c in facts"
              :key="c.key"
              class="chip"
            >
              <span class="chip-k">{{ c.label }}</span>
              <b class="chip-v">{{ c.value }}</b>
            </div>
          </div>
          <p class="note">一套天气事实同时喂给「穿」和「带」，不会出现「说不用带伞、又说要穿雨衣」。</p>
          <p class="note">「室内」只降低雨暴露权重，不等于不经过户外。</p>
        </InkCard>
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

.facts {
  display: flex;
  flex-direction: column;
  gap: #{$sp};
}

.facts-title {
  font-size: 13px;
  font-weight: #{$title-weight};
  letter-spacing: -0.01em;
}

.chips {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
}

.chip {
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 6px #{$sp};
  border: 2px solid var(--ink);
  border-radius: var(--r);
  background: #fff;
}

.chip-k {
  font-size: 10.5px;
  font-weight: 700;
  color: rgba(0, 0, 0, 0.66);
}

.chip-v {
  font-family: var(--font-num);
  font-size: 12.5px;
  font-weight: #{$numeral-weight};
  font-variant-numeric: var(--tnum);
  color: var(--ink);
}

.note {
  margin: 0;
  font-size: 11.5px;
  line-height: 1.5;
  color: rgba(0, 0, 0, 0.78);
}
</style>
