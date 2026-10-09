<script setup lang="ts">
// 要穿结论卡（雨具两件事的左半边）：点名的件来自引擎实际推荐，不写死「雨衣」
// 蓝 = 需要防水外层（降水语义），白 = 不用特意穿不是行动，不抢蓝底
import { computed } from 'vue'
import GarmentIcon from './GarmentIcon.vue'
import BadgePill from './BadgePill.vue'
import InkCard from './InkCard.vue'
import { RAINCOAT_ICON, iconForItem } from './garments'
import { rainWearLine } from '@/presentation'
import type { OutfitRecommendation } from '@/core/types'

const props = defineProps<{ rec: OutfitRecommendation }>()

const line = computed(() => rainWearLine(props.rec))
const tone = computed(() => (props.rec.rainPlan.wearShell ? ('blue' as const) : ('card' as const)))
const icon = computed(() =>
  line.value.piece ? iconForItem(line.value.piece.id, 'PROTECTION') : RAINCOAT_ICON,
)
const aria = computed(() => `要穿结论：${line.value.headline}，${line.value.detail}`)
</script>

<template>
  <InkCard
    class="wear"
    :tone="tone"
    :class="{ skip: tone === 'card' }"
    role="group"
    :aria-label="aria"
  >
    <div class="main">
      <GarmentIcon
        :icon="icon"
        :size="92"
        role="PROTECTION"
        label="防水外层"
      />
      <div class="copy">
        <div class="title-row">
          <BadgePill tone="plain">要穿</BadgePill>
          <b>{{ line.headline }}</b>
        </div>
        <div class="detail">{{ line.detail }}</div>
      </div>
    </div>
  </InkCard>
</template>

<style scoped lang="scss">
@use '@/styles/tokens' as *;

.wear {
  padding: #{$sp * 1.5};
}

.main {
  display: flex;
  align-items: center;
  gap: #{$sp * 1.75};
}

.copy {
  flex: 1;
  min-width: 0;
}

.title-row {
  display: flex;
  align-items: center;
  gap: #{$sp};
  flex-wrap: wrap;
}

.title-row b {
  font-size: 20px;
  font-weight: #{$title-weight};
  letter-spacing: -0.01em;
}

.detail {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.5;
  opacity: 0.92;
}

.skip {
  color: var(--ink-2);

  .detail {
    color: rgba(0, 0, 0, 0.78);
    opacity: 1;
  }
}
</style>
