<script setup lang="ts">
// 时间线段：加减层事件（最多 6 条）+ 一天三段
// 事件来自 ScheduleEngine 的真实推导，没有事件时由状态条（S6）说明「今天不用加减」
import { computed } from 'vue'
import InkCard from './InkCard.vue'
import { daypartLines, timelineLines } from '@/presentation'
import type { OutfitRecommendation } from '@/core/types'

const props = defineProps<{
  rec: OutfitRecommendation
  /** 当前整点：用来标出「现在在哪一段」（粉 = 现在，与曲线上的指针同色） */
  nowHour?: number
}>()

const events = computed(() => timelineLines(props.rec.timeline))
const parts = computed(() =>
  daypartLines(props.rec.periods, props.rec).map((line, i) => {
    const p = props.rec.periods[i]
    return { ...line, isNow: props.nowHour != null && props.nowHour >= p.startHour && props.nowHour < p.endHour }
  }),
)
</script>

<template>
  <div class="wrap">
    <div
      v-if="events.length"
      class="events"
    >
      <div
        v-for="e in events"
        :key="e.hour + e.title"
        class="ev"
      >
        <InkCard
          flat
          class="ev-card"
        >
          <div class="ev-head">
            <span class="hour num">{{ e.hour }}</span>
            <b>{{ e.title }}</b>
          </div>
          <div class="ev-note">{{ e.note }}</div>
        </InkCard>
      </div>
    </div>

    <div class="parts">
      <div
        v-for="p in parts"
        :key="p.hour"
        class="part"
        :class="{ now: p.isNow }"
      >
        <div class="part-hour num">{{ p.hour }}</div>
        <div class="part-temp num">{{ p.title }}</div>
        <div class="part-note">{{ p.note }}</div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/tokens' as *;

.events {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.ev-card {
  padding: #{$sp} #{$sp * 1.5};
}

.ev-head {
  display: flex;
  align-items: baseline;
  gap: #{$sp};
}

.ev-head b {
  font-size: 14px;
  font-weight: #{$title-weight};
  color: var(--ink);
}

.hour {
  padding: 1px 8px;
  border: 2px solid var(--ink);
  border-radius: var(--r-pill);
  background: var(--paper);
  font-weight: #{$numeral-weight};
  font-size: 12px;
  color: var(--ink);
}

.ev-note {
  margin-top: 3px;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.72);
}

/* 三段一律白卡：行底色是层角色的专用语言，时间不借用它 */
.parts {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-top: #{$sp * 1.5};
}

.part {
  border: var(--sw) solid var(--ink);
  border-radius: var(--r);
  padding: #{$sp};
  background: var(--card);
}

/* 现在所在的那一段，用与「现在」指针同色的粉描边 */
.part.now {
  border-color: var(--pink);
  box-shadow: 2px 2px 0 var(--pink);
}

.part.now .part-hour {
  color: var(--pink);
}

.part-hour {
  font-size: 11px;
  font-weight: #{$numeral-weight};
  color: rgba(0, 0, 0, 0.66);
}

.part-temp {
  font-size: 17px;
  font-weight: #{$numeral-weight};
  line-height: 1.2;
  color: var(--ink);
}

.part-note {
  margin-top: 2px;
  font-size: 11.5px;
  font-weight: 700;
  color: rgba(0, 0, 0, 0.78);
}
</style>
