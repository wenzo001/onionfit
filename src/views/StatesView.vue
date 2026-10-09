<script setup lang="ts">
// 状态墙（屏 05）：8 个真实会发生的边界，一次排全，上线前对着它逐条核对
// 每条都标出「此刻是否真的成立」，避免墙上的样子和线上跑的不是同一套
import { computed } from 'vue'
import StateBanner from '@/components/StateBanner.vue'
import SafetyAlert from '@/components/SafetyAlert.vue'
import SectionTitle from '@/components/SectionTitle.vue'
import InkCard from '@/components/InkCard.vue'
import { STATE_WALL } from '@/presentation'
import type { AppState } from '@/presentation'
import type { ActiveState } from '@/composables/useBoundaryStates'
import { usePlan } from '@/composables/usePlan'
import { useBoundaryStates } from '@/composables/useBoundaryStates'

const { weather, recommendation } = usePlan()
const { activeStates } = useBoundaryStates(weather, recommendation)

/** 墙上的示例数字与设计交付包 §07 一致 */
const VARS: Record<string, Record<string, string | number>> = {
  OFFLINE_SNAPSHOT: { n: 2, clock: '08:12', layers: '2 层', umbrella: '带伞' },
  SNAPSHOT_STALE: { n: 180 },
  GEO_DENIED: { city: '上海' },
  CITY_SWITCHING: { city: '北京', old: '上海' },
  DANGER: {},
  COLD_START_FAIL: {},
  NO_HOURLY: {},
  NO_TIMELINE: {},
}

const liveKeys = computed(() => new Set(activeStates.value.map((s) => s.key)))

const wall = computed<ActiveState[]>(() =>
  STATE_WALL.filter((s) => s.key !== 'DANGER').map((s) => fill(s)),
)

function fill(s: AppState): ActiveState {
  const vars = VARS[s.key] ?? {}
  const sub = (t: string) => t.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''))
  return { ...s, title: sub(s.title), body: sub(s.body), scope: 'any' }
}

const danger = computed(() => {
  const base = STATE_WALL.find((s) => s.key === 'DANGER')!
  return base
})
</script>

<template>
  <div class="page">
    <div class="screen">
      <section class="col col-wide">
        <SectionTitle
          title="真实会发生的 8 种状态"
          sub="每个都真实会发生，不藏错误"
        />
      </section>

      <section class="col col-wide">
        <SafetyAlert
          :safety="{ level: 'DANGER', warnings: ['最高 37°，超 32° 有 9 小时。不用管保暖，重点透气遮阳。'], forcedDemands: { BREATHABILITY: 80, SOLAR: 70 } }"
          :facts="{
            dayMinC: 24,
            dayMaxC: 37,
            dayRangeC: 13,
            windMaxMs: 3.2,
            dayRainMm: 0,
            dayUvMax: 8.4,
            designHourTempC: 24,
            designHourWindMs: 3.2,
            rainExposure: 0.4,
            hasHourly: true,
          }"
        />
        <p class="note">
          S7 DANGER 由 SafetyAlert 承载 —— 全稿唯一黑底白字，永远排在穿搭建议之前。
        </p>
      </section>

      <section
        v-for="s in wall"
        :key="s.key"
        class="col"
      >
        <StateBanner :state="s" />
        <InkCard
          flat
          class="live"
          :class="{ on: liveKeys.has(s.key) }"
        >
          {{ liveKeys.has(s.key) ? '此刻成立 · 线上就是这个样子' : '当前未触发' }}
        </InkCard>
      </section>

      <section class="col col-wide">
        <p class="meta">
          示例数字取自设计交付包 §07；{{ danger.key }} 之外全部由 store / 结论里的事实驱动，
          上面的「此刻」不是画出来的。
        </p>
      </section>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/tokens' as *;

.col {
  display: flex;
  flex-direction: column;
  gap: 6px;
  min-width: 0;
}

.col-wide {
  grid-column: 1 / -1;
}

.live {
  padding: 4px #{$sp};
  border: 2px dashed rgba(0, 0, 0, 0.24) !important;
  border-radius: var(--r);
  font-size: 11px;
  font-weight: 700;
  color: rgba(0, 0, 0, 0.55);
}

.live.on {
  border: 2px solid var(--ink) !important;
  background: var(--mint);
  color: var(--ink);
}

.note,
.meta {
  font-size: 11.5px;
  line-height: 1.6;
  color: rgba(0, 0, 0, 0.62);
}
</style>
