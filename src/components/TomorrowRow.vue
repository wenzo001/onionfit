<script setup lang="ts">
// 明日一行（Q5）：只在真的有变化时出现，压成一行不占屏
import { computed } from 'vue'
import GarmentIcon from './GarmentIcon.vue'
import InkCard from './InkCard.vue'
import { tomorrowLine } from '@/presentation'
import type { OutfitRecommendation, WeatherDay } from '@/core/types'

const props = defineProps<{
  rec: OutfitRecommendation
  next: WeatherDay
}>()

const line = computed(() => tomorrowLine(props.rec, props.next))
</script>

<template>
  <InkCard
    v-if="line"
    class="tomorrow"
    tone="paper"
  >
    <div class="mark">
      明
    </div>
    <div class="copy">
      <b>{{ line.headline }}</b>
      <span>{{ line.detail }}</span>
    </div>
    <GarmentIcon
      icon="of-pro-coat"
      :size="40"
      role="PROTECTION"
      label="明日"
    />
  </InkCard>
</template>

<style scoped lang="scss">
@use '@/styles/tokens' as *;

.tomorrow {
  display: flex;
  align-items: center;
  gap: #{$sp * 1.5};
  padding: #{$sp} #{$sp * 1.5};
}

/* 「明」字胶囊与今天的层号同族，一眼分清是明天的事 */
.mark {
  flex: 0 0 auto;
  width: 34px;
  height: 34px;
  display: grid;
  place-items: center;
  border: 2px solid var(--ink);
  border-radius: var(--r-pill);
  background: var(--layer-insulation);
  font-weight: #{$title-weight};
  font-size: 14px;
  color: var(--ink);
}

.copy {
  flex: 1;
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
  font-size: 11.5px;
  color: rgba(0, 0, 0, 0.7);
}
</style>
