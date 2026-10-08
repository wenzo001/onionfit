<script setup lang="ts">
// 洋葱结构屏的两块解释卡：为什么带着此刻不穿的那件 + 每层为什么存在
// 每层的理由都可回溯到需求数字（noteCode 由槽位决策透传），界面不猜
import { computed } from 'vue'
import InkCard from './InkCard.vue'
import BadgePill from './BadgePill.vue'
import { ROLE_LABEL, designHourLine, layerReasons, carryExplainer } from '@/presentation'
import type { OutfitRecommendation } from '@/core/types'

const props = defineProps<{ rec: OutfitRecommendation }>()

const explainer = computed(() => carryExplainer(props.rec))
const reasons = computed(() => layerReasons(props.rec))
const hour = computed(() => designHourLine(props.rec))
</script>

<template>
  <div class="why">
    <InkCard
      v-if="explainer"
      tone="yellow"
      class="explain"
    >
      <b class="q">{{ explainer }}</b>
      <p class="a">{{ hour }}</p>
    </InkCard>

    <div class="reasons">
      <div
        v-for="r in reasons"
        :key="r.role"
        class="reason"
        :class="`role-${r.role}`"
      >
        <BadgePill
          :tone="r.role === 'BASE' ? 'mint' : r.role === 'INSULATION' ? 'yellow' : 'blue'"
        >
          {{ ROLE_LABEL[r.role] }}
        </BadgePill>
        <div class="copy">
          <b>{{ r.title }}</b>
          <span>{{ r.reason }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/tokens' as *;

.why {
  display: flex;
  flex-direction: column;
  gap: #{$sp * 1.5};
}

.explain {
  padding: #{$sp * 1.5};
}

.q {
  display: block;
  font-size: 15px;
  font-weight: #{$title-weight};
  color: var(--ink);
}

.a {
  margin-top: 6px;
  font-size: 12.5px;
  line-height: 1.6;
  color: rgba(0, 0, 0, 0.82);
}

.reasons {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.reason {
  display: flex;
  align-items: flex-start;
  gap: #{$sp};
  border: var(--sw) solid var(--ink);
  border-radius: var(--r);
  padding: #{$sp} #{$sp * 1.25};
  background: var(--card);
}

.role-PROTECTION {
  background: var(--layer-protection);
}

.role-INSULATION {
  background: var(--layer-insulation);
}

.copy {
  min-width: 0;
}

.copy b {
  display: block;
  font-size: 13.5px;
  font-weight: #{$title-weight};
  color: var(--ink);
}

.copy span {
  display: block;
  margin-top: 2px;
  font-size: 12px;
  line-height: 1.55;
  color: rgba(0, 0, 0, 0.78);
}
</style>
