<script setup lang="ts">
// 配饰条（60–64px 图标）：同一原因的配饰并成一行，清单不铺长
import { computed } from 'vue'
import GarmentIcon from './GarmentIcon.vue'
import InkCard from './InkCard.vue'
import { groupAccessories } from '@/presentation'
import type { OutfitRecommendation } from '@/core/types'

const props = defineProps<{ rec: OutfitRecommendation }>()

const items = computed(() => groupAccessories(props.rec.accessories, props.rec.facts))
</script>

<template>
  <div
    v-if="items.length"
    class="row"
  >
    <InkCard
      v-for="a in items"
      :key="a.title"
      flat
      class="cell"
    >
      <GarmentIcon
        :icon="a.icon"
        :size="60"
        :label="a.title"
      />
      <div class="copy">
        <b>{{ a.title }}</b>
        <span>{{ a.note }}</span>
      </div>
    </InkCard>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/tokens' as *;

.row {
  display: flex;
  gap: 10px;
  overflow-x: auto;
  padding-bottom: 2px;
}

.cell {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: #{$sp};
  padding: #{$sp} #{$sp * 1.25};
  border-radius: var(--r);
  background: var(--layer-accessory);
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
  font-size: 11px;
  color: rgba(0, 0, 0, 0.7);
}
</style>
