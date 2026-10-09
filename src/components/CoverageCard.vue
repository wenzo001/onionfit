<script setup lang="ts">
// 覆盖情况：衣物库够不够用、差多少、可以这样补、这套话能信几分（方案 §5.2 / deck 12）
// 四种状态只有一个会出现；不合格时不伪装成合格推荐
import { computed } from 'vue'
import InkCard from './InkCard.vue'
import { coverageCopy } from '@/presentation'
import type { OutfitRecommendation } from '@/core/types'

const props = defineProps<{ rec: OutfitRecommendation }>()

const c = computed(() => coverageCopy(props.rec))
</script>

<template>
  <InkCard
    class="coverage"
    :class="`s-${c.status}`"
    role="status"
  >
    <div class="head">
      <span
        class="icon num"
        :class="`t-${c.tone}`"
      >{{ c.icon }}</span>
      <div class="head-copy">
        <b>{{ c.title }}</b>
        <span>{{ c.line }}</span>
      </div>
    </div>

    <template v-if="c.rows">
      <div class="sec">差多少</div>
      <div class="rows">
        <div
          v-for="row in c.rows"
          :key="row.label"
          class="row"
        >
          <span class="lbl">{{ row.label }}</span>
          <span class="val num">{{ row.value }}</span>
          <span
            v-if="row.note"
            class="note"
          >{{ row.note }}</span>
        </div>
      </div>
      <p
        v-if="c.catalogLine"
        class="catalog"
      >{{ c.catalogLine }}</p>
    </template>

    <template v-if="c.fixes.length">
      <div class="sec">可以这样补</div>
      <div class="fixes">
        <div
          v-for="(f, i) in c.fixes"
          :key="f.title"
          class="fix"
        >
          <span class="n num">{{ i + 1 }}</span>
          <div class="fix-copy">
            <b>{{ f.title }}</b>
            <span>{{ f.note }}</span>
          </div>
        </div>
      </div>
    </template>

    <div class="trust">
      <div class="trust-head">
        <b>这套话能信几分</b>
        <span class="pct num">{{ c.trust.percent }}%</span>
      </div>
      <span class="factors">{{ c.trust.factors.join(' · ') }}</span>
    </div>

    <div class="scope">
      <span
        v-for="s in c.scope"
        :key="s"
      >{{ s }}</span>
    </div>
  </InkCard>
</template>

<style scoped lang="scss">
@use '@/styles/tokens' as *;

.coverage {
  padding: #{$sp * 1.5};
  color: var(--ink-2);
}

.head {
  display: flex;
  align-items: flex-start;
  gap: #{$sp * 1.25};
}

.icon {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border: 2px solid var(--ink);
  border-radius: var(--r);
  font-size: 19px;
  font-weight: #{$numeral-weight};
  color: var(--ink);
}

.t-pink {
  background: var(--pink);
}

.t-yellow {
  background: var(--yellow);
}

.t-mint {
  background: var(--mint);
}

.t-paper {
  background: var(--paper);
}

.head-copy b {
  display: block;
  font-size: 15px;
  font-weight: #{$title-weight};
  color: var(--ink);
}

.head-copy span {
  display: block;
  margin-top: 2px;
  font-size: 12.5px;
  line-height: 1.6;
}

.sec {
  margin-top: #{$sp * 1.5};
  padding-top: #{$sp};
  border-top: 2px dashed rgba(0, 0, 0, 0.3);
  font-size: 11.5px;
  font-weight: #{$title-weight};
  letter-spacing: 0.06em;
  color: var(--ink);
}

.rows {
  margin-top: 6px;
}

.row {
  display: flex;
  align-items: baseline;
  gap: #{$sp};
  padding: 3px 0;
}

.lbl {
  flex: 0 0 42px;
  font-size: 12px;
  font-weight: 700;
}

.val {
  font-size: 13px;
  font-weight: #{$numeral-weight};
  color: var(--ink);
}

.note {
  font-size: 11.5px;
  opacity: 0.72;
}

.catalog {
  margin-top: 6px;
  padding: 6px #{$sp};
  border-left: 4px solid var(--pink);
  border-radius: 4px;
  background: rgba(255, 77, 141, 0.14);
  font-size: 12px;
  line-height: 1.6;
}

.fixes {
  margin-top: 6px;
}

.fix {
  display: flex;
  align-items: flex-start;
  gap: #{$sp * 1.25};
  padding: 4px 0;
}

.n {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  margin-top: 1px;
  border: 2px solid var(--ink);
  border-radius: 50%;
  font-size: 11px;
  font-weight: #{$numeral-weight};
}

.fix-copy b {
  display: block;
  font-size: 12.5px;
  font-weight: #{$title-weight};
  color: var(--ink);
}

.fix-copy span {
  display: block;
  margin-top: 1px;
  font-size: 11.5px;
  line-height: 1.55;
  opacity: 0.78;
}

.trust {
  margin-top: #{$sp * 1.5};
  padding-top: #{$sp};
  border-top: 2px dashed rgba(0, 0, 0, 0.3);
}

.trust-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: #{$sp};
}

.trust-head b {
  font-size: 12.5px;
  font-weight: #{$title-weight};
  color: var(--ink);
}

.pct {
  font-size: 16px;
  font-weight: #{$numeral-weight};
  color: var(--ink);
}

.factors {
  display: block;
  margin-top: 2px;
  font-size: 11.5px;
  opacity: 0.78;
}

.scope {
  display: flex;
  flex-direction: column;
  gap: 1px;
  margin-top: 6px;
  font-size: 11px;
  opacity: 0.65;
}
</style>
