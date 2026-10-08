<script setup lang="ts">
// 层卡（01 的主角）：Q2「此刻穿几层」占最大字号，Q1「结构」收进同一张卡的层列表
// 带着备用的行排在正穿层之上 —— 它本来就是外层，看得见但不抢当下
import { computed } from 'vue'
import InkCard from './InkCard.vue'
import LayerRow from './LayerRow.vue'
import { orderLayers, whyFootnote } from '@/presentation'
import type { OutfitRecommendation } from '@/core/types'

const props = defineProps<{
  rec: OutfitRecommendation
  /** 图标版主屏（屏 10）：纯图形零文字 */
  graphic?: boolean
}>()

const layers = computed(() => orderLayers(props.rec.nowOutfit.layers))
const now = computed(() => {
  const d = new Date()
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
})
</script>

<template>
  <InkCard class="layer-card">
    <div
      v-if="!graphic"
      class="head"
    >
      <h1 class="headline">
        此刻穿<span class="num">{{ rec.wornNowCount }}</span>层
      </h1>
      <span class="now">现在 {{ now }}</span>
    </div>

    <div class="rows">
      <template v-if="!graphic">
        <LayerRow
          v-for="l in layers"
          :key="l.role + l.items.map((i) => i.id).join('-')"
          :layer="l"
          :timeline="rec.timeline"
        />
      </template>
      <!-- 图标版：只留图形与状态点，零文字 -->
      <div
        v-else
        class="glyph-only"
      >
        <LayerRow
          v-for="l in layers"
          :key="`g-${l.role}`"
          :layer="l"
          :timeline="rec.timeline"
          graphic
        />
      </div>
    </div>

    <RouterLink
      v-if="!graphic"
      class="foot"
      :to="{ name: 'onion' }"
    >
      {{ whyFootnote(layers.length) }}
      <span aria-hidden="true">→</span>
    </RouterLink>
  </InkCard>
</template>

<style scoped lang="scss">
@use '@/styles/tokens' as *;

.layer-card {
  padding: #{$sp * 1.5};
}

.head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: #{$sp};
  margin-bottom: #{$sp * 1.5};
}

/* 全屏最大字号：早上只有 30 秒，答案必须先被看到 */
.headline {
  font-size: 22px;
  font-weight: #{$title-weight};
  line-height: 1.1;
  color: var(--ink);
  letter-spacing: -0.01em;
}

.headline .num {
  font-family: var(--font-num);
  font-weight: #{$numeral-weight};
  font-size: 56px;
  font-variant-numeric: var(--tnum);
  color: var(--orange);
  margin: 0 4px;
  line-height: 0.85;
}

.now {
  flex: 0 0 auto;
  font-family: var(--font-num);
  font-size: 11.5px;
  font-weight: #{$numeral-weight};
  color: var(--pink);
}

.rows {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.foot {
  display: grid;
  place-items: center;
  min-height: 44px;
  margin-top: #{$sp * 1.5};
  border-top: 2px solid rgba(0, 0, 0, 0.14);
  padding-top: #{$sp};
  font-size: 12.5px;
  font-weight: 800;
  color: var(--ink);
  text-decoration: none;

  &:active {
    color: var(--orange);
  }
}
</style>
