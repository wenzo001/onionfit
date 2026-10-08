<script setup lang="ts">
// 安全预警（组件 E）：全稿唯一用黑底白字的卡，出现在最顶部
// 它是提醒不是建议，并显式列出被强制抬升的需求维度
import { computed } from 'vue'
import InkCard from './InkCard.vue'
import BadgePill from './BadgePill.vue'
import { safetyAlert } from '@/presentation'
import type { RecommendationFacts, SafetyReport } from '@/core/types'

const props = defineProps<{
  safety: SafetyReport
  facts: RecommendationFacts
}>()

const alert = computed(() => safetyAlert(props.safety, props.facts))
const danger = computed(() => props.safety.level === 'DANGER')
</script>

<template>
  <InkCard
    v-if="alert"
    class="safety"
    :tone="danger ? 'ink' : 'paper'"
    role="alert"
  >
    <div class="head">
      <span
        class="mark"
        :class="{ soft: !danger }"
        aria-hidden="true"
      >!</span>
      <b>{{ alert.title }}</b>
    </div>
    <p class="body">{{ alert.body }}</p>
    <div
      v-if="alert.chips.length"
      class="chips"
    >
      <BadgePill
        v-for="c in alert.chips"
        :key="c"
        :tone="danger ? 'plain' : 'pink'"
      >{{ c }}</BadgePill>
    </div>
  </InkCard>
</template>

<style scoped lang="scss">
@use '@/styles/tokens' as *;

.safety {
  padding: #{$sp * 1.5};
}

.head {
  display: flex;
  align-items: center;
  gap: 10px;
}

/* 粉色感叹号 = 被强制抬升的那一族语义 */
.mark {
  flex: 0 0 auto;
  width: 26px;
  height: 26px;
  display: grid;
  place-items: center;
  border: 2px solid var(--ink);
  border-radius: 50%;
  background: var(--pink);
  color: var(--ink);
  font-family: var(--font-num);
  font-weight: #{$numeral-weight};
  font-size: 15px;
}

.mark.soft {
  background: var(--pink);
}

.head b {
  font-size: 15px;
  font-weight: #{$title-weight};
}

.body {
  margin: #{$sp} 0 0;
  font-size: 13px;
  font-weight: 700;
  line-height: 1.55;
}

.chips {
  display: flex;
  gap: 6px;
  flex-wrap: wrap;
  margin-top: #{$sp};
}
</style>
