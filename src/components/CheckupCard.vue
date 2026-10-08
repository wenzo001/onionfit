<script setup lang="ts">
// 体检分：这套穿得合不合适，一个分数 + 一句结论 + 一行可核对的数字
import { computed } from 'vue'
import InkCard from './InkCard.vue'
import { scoreDetail, scoreGrade } from '@/presentation'
import type { OutfitRecommendation } from '@/core/types'

const props = defineProps<{ rec: OutfitRecommendation }>()

const grade = computed(() => scoreGrade(props.rec.dayScore))
const detail = computed(() => scoreDetail(props.rec.dayOutfit))
</script>

<template>
  <InkCard class="checkup">
    <div class="score num">{{ Math.round(rec.dayScore) }}</div>
    <div class="copy">
      <b>{{ grade }}</b>
      <span>{{ detail }}</span>
    </div>
  </InkCard>
</template>

<style scoped lang="scss">
@use '@/styles/tokens' as *;

.checkup {
  display: flex;
  align-items: center;
  gap: #{$sp * 1.5};
  padding: #{$sp} #{$sp * 1.5};
}

.score {
  flex: 0 0 auto;
  min-width: 62px;
  text-align: center;
  font-size: 30px;
  font-weight: #{$numeral-weight};
  color: var(--ink);
  padding: 2px #{$sp};
  border: 2px solid var(--ink);
  border-radius: var(--r);
  background: var(--mint);
}

.copy {
  min-width: 0;
}

.copy b {
  display: block;
  font-size: 14px;
  font-weight: #{$title-weight};
  color: var(--ink);
}

.copy span {
  display: block;
  margin-top: 2px;
  font-family: var(--font-num);
  font-size: 11.5px;
  line-height: 1.5;
  color: rgba(0, 0, 0, 0.72);
}
</style>
