<script setup lang="ts">
// 为什么是这套（deck 13 上半）：每条理由都标出处 + 为什么不是那件厚的（引擎重算的反事实）
// 句子与数字全部来自 presentation（引擎结论的翻译层），组件不做任何判断
import { computed } from 'vue'
import InkCard from './InkCard.vue'
import BadgePill from './BadgePill.vue'
import { WHY_SOURCE_LABEL, thickAlternative, whyReasons, type WhySource } from '@/presentation'
import type { OutfitRecommendation, UserSettings } from '@/core/types'

const props = defineProps<{ rec: OutfitRecommendation; settings?: UserSettings }>()

const reasons = computed(() => whyReasons(props.rec, props.settings))
const alt = computed(() => thickAlternative(props.rec, props.settings))

const TONE: Record<WhySource, 'blue' | 'mint' | 'pink' | 'yellow' | 'plain'> = {
  weather: 'blue',
  profile: 'mint',
  safety: 'pink',
  style: 'yellow',
  fallback: 'plain',
}
</script>

<template>
  <div class="why-this">
    <div class="rows">
      <div
        v-for="(r, i) in reasons"
        :key="`${r.source}-${i}`"
        class="row"
      >
        <BadgePill :tone="TONE[r.source]">
          {{ WHY_SOURCE_LABEL[r.source] }}
        </BadgePill>
        <span class="text">{{ r.text }}</span>
      </div>
    </div>

    <template v-if="alt">
      <b class="alt-title">为什么不是那件厚的</b>
      <InkCard
        flat
        tone="pink"
        class="alt-card"
      >
        <b class="mark">✕</b>
        <div class="alt-copy">
          <b>{{ alt.rejected.name }} {{ alt.rejected.clo.toFixed(1) }} clo</b>
          <span>{{ alt.rejected.note }}</span>
        </div>
      </InkCard>
      <InkCard
        flat
        tone="mint"
        class="alt-card"
      >
        <b class="mark">✓</b>
        <div class="alt-copy">
          <b>{{ alt.chosen.names }} → 有效 {{ alt.chosen.clo.toFixed(1) }} clo</b>
          <span>{{ alt.chosen.note }}</span>
        </div>
      </InkCard>
    </template>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/tokens' as *;

.why-this {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.row {
  display: flex;
  align-items: flex-start;
  gap: #{$sp};
  border: var(--sw) solid var(--ink);
  border-radius: var(--r);
  padding: #{$sp} #{$sp * 1.25};
  background: var(--card);
}

.text {
  min-width: 0;
  font-size: 12.5px;
  line-height: 1.6;
  color: var(--ink);
}

.alt-title {
  margin-top: #{$sp};
  font-size: 13.5px;
  font-weight: #{$title-weight};
  color: var(--ink);
}

.alt-card {
  display: flex;
  align-items: flex-start;
  gap: #{$sp};
  padding: #{$sp} #{$sp * 1.25};
}

.mark {
  flex: 0 0 auto;
  font-family: var(--font-num);
  font-size: 15px;
  font-weight: #{$numeral-weight};
  color: var(--ink);
}

.alt-copy {
  min-width: 0;
}

.alt-copy b {
  display: block;
  font-size: 13px;
  font-weight: #{$title-weight};
  color: var(--ink);
}

.alt-copy span {
  display: block;
  margin-top: 2px;
  font-size: 12px;
  line-height: 1.55;
  color: var(--ink);
}
</style>
