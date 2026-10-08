<script setup lang="ts">
// 六维需求条（组件 C）：每维独立归一到 0–100，右侧标注触发它的事实数字
// 中间态数字默认折进这一屏，主屏只在必要处露 m/s（设计决策 4）
import { computed } from 'vue'
import BadgePill from './BadgePill.vue'
import { demandBars } from '@/presentation'
import type { DemandVector, RecommendationFacts, SafetyReport } from '@/core/types'

const props = defineProps<{
  vector: DemandVector
  facts: RecommendationFacts
  safety: SafetyReport
}>()

const bars = computed(() => demandBars(props.vector, props.facts, props.safety.forcedDemands))
</script>

<template>
  <div class="bars">
    <div
      v-for="b in bars"
      :key="b.dim"
      class="bar-row"
    >
      <div class="head">
        <span class="label">
          {{ b.label }} · {{ b.fact }}
          <BadgePill
            v-if="b.forced"
            tone="pink"
          >强制</BadgePill>
        </span>
        <span
          class="val"
          :class="`c-${b.dim}`"
        >{{ b.value }}</span>
      </div>
      <div
        class="track"
        role="img"
        :aria-label="`${b.label} ${b.value} 分（满分 100）`"
      >
        <i
          class="fill"
          :class="`c-bg-${b.dim}`"
          :style="{ width: `${b.value}%` }"
        />
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/tokens' as *;

.bars {
  display: flex;
  flex-direction: column;
  gap: 9px;
}

.head {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  gap: 8px;
  font-size: 12.5px;
  font-weight: 700;
  color: var(--ink);
}

.label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.val {
  font-family: var(--font-num);
  font-weight: #{$numeral-weight};
  font-variant-numeric: var(--tnum);
}

.track {
  height: 12px;
  border: 2px solid var(--ink);
  border-radius: var(--r-pill);
  background: var(--paper);
  overflow: hidden;
}

.fill {
  display: block;
  height: 100%;
  // 短条也要看得见墨线末端
  min-width: 6px;
  transition: width 0.45s cubic-bezier(0.22, 0.61, 0.36, 1);
}

/* 数字用深一档同族色：原色在白卡上只有 2.3–3.5，达不到正文 AA */
.c-WARMTH {
  color: var(--dt-warmth);
}
.c-WIND,
.c-RAIN {
  color: var(--dt-wind);
}
.c-BREATHABILITY {
  color: var(--dt-breathability);
}
.c-SOLAR {
  color: var(--dt-solar);
}
.c-REMOVABLE {
  color: var(--dt-removable);
}

/* 条与标签点用原色（图形级对比，且旁边永远跟着数字与文字） */
.c-bg-WARMTH {
  background: var(--d-warmth);
}
.c-bg-WIND,
.c-bg-RAIN {
  background: var(--d-wind);
}
.c-bg-BREATHABILITY {
  background: var(--d-breathability);
}
.c-bg-SOLAR {
  background: var(--d-solar);
}
.c-bg-REMOVABLE {
  background: var(--d-removable);
}
</style>
