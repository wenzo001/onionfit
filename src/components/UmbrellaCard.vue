<script setup lang="ts">
// 带伞结论卡（组件 B）：三态只有一个会出现，概率与最险那段都摆出来
// 蓝 = 降水，橘 = 此刻的行动答案，薄荷 = 这条结论可信且不用带
import { computed } from 'vue'
import GarmentIcon from './GarmentIcon.vue'
import BadgePill from './BadgePill.vue'
import InkCard from './InkCard.vue'
import { UMBRELLA_ICON } from './garments'
import { umbrellaConfidence, umbrellaHeadline, umbrellaLegLabel, umbrellaReason } from '@/presentation'
import type { UmbrellaAssessment } from '@/core/types'

const props = defineProps<{
  umbrella: UmbrellaAssessment
  commute?: { out: string | null; home: string | null }
  /** 首屏「雨具两件事」用来标出这半边是「要带」；主屏不传 */
  label?: string
}>()

const emit = defineEmits<{ adjust: [] }>()

const tone = computed(() => {
  if (props.umbrella.verdict === 'SKIP') return 'card' as const
  return 'blue' as const
})

/** SKIP 用白卡：不用带不是行动，不该抢橘色 */
const badgeTone = computed(() => {
  const v = props.umbrella.verdict
  return v === 'BRING' ? ('yellow' as const) : v === 'RAINCOAT' ? ('orange' as const) : ('mint' as const)
})

const aria = computed(
  () => `带伞结论：${umbrellaHeadline(props.umbrella)}，通勤被淋概率 ${props.umbrella.probability}%`,
)
</script>

<template>
  <InkCard
    class="umbrella"
    :tone="tone"
    :class="{ skip: tone === 'card' }"
    role="group"
    :aria-label="aria"
  >
    <div class="main">
      <GarmentIcon
        :icon="UMBRELLA_ICON"
        :size="92"
        label="伞"
      />
      <div class="copy">
        <div class="title-row">
          <BadgePill
            v-if="label"
            tone="plain"
          >{{ label }}</BadgePill>
          <b>{{ umbrellaHeadline(umbrella) }}</b>
          <BadgePill :tone="badgeTone">{{ umbrella.probability }}%</BadgePill>
        </div>
        <div class="reason">{{ umbrellaReason(umbrella) }}</div>
        <div class="conf">{{ umbrellaConfidence(umbrella, commute) }}</div>
      </div>
    </div>

    <div
      v-if="umbrella.legs.length > 1"
      class="legs"
    >
      <div
        v-for="leg in umbrella.legs"
        :key="`${leg.phase}-${leg.start}`"
        class="leg"
      >
        <span class="leg-label">{{ umbrellaLegLabel(leg) }}</span>
        <span class="leg-track"><i :style="{ width: `${leg.probability}%` }" /></span>
        <span class="leg-val">{{ leg.probability }}%</span>
      </div>
    </div>

    <button
      v-if="umbrella.assumed"
      type="button"
      class="adjust"
      @click="emit('adjust')"
    >
      通勤时间是我估的，改成我的 →
    </button>
    <div
      v-else
      class="foot"
    >
      概率高于 {{ umbrella.threshold }}% 才让带
    </div>
  </InkCard>
</template>

<style scoped lang="scss">
@use '@/styles/tokens' as *;

.umbrella {
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

.reason {
  margin-top: 4px;
  font-size: 12px;
  line-height: 1.5;
  opacity: 0.92;
}

.conf {
  margin-top: 2px;
  font-family: var(--font-num);
  font-size: 11px;
  opacity: 0.78;
}

.skip {
  color: var(--ink-2);

  .reason {
    color: rgba(0, 0, 0, 0.78);
    opacity: 1;
  }

  .conf {
    color: rgba(0, 0, 0, 0.6);
    opacity: 1;
  }

  .legs {
    border-top-color: rgba(0, 0, 0, 0.18);
  }

  .leg-track {
    background: var(--paper);
  }

  .leg-label,
  .leg-val {
    color: rgba(0, 0, 0, 0.72);
  }

  .foot {
    color: rgba(0, 0, 0, 0.6);
  }
}

.legs {
  margin-top: #{$sp * 1.5};
  padding-top: #{$sp};
  border-top: 2px solid rgba(255, 255, 255, 0.32);
}

.leg {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.leg-label {
  flex: 0 0 74px;
  font-family: var(--font-num);
  font-size: 11.5px;
  font-variant-numeric: var(--tnum);
}

.leg-track {
  flex: 1;
  height: 8px;
  border: 2px solid var(--ink);
  border-radius: var(--r-pill);
  background: rgba(255, 255, 255, 0.28);
  overflow: hidden;
}

.leg-track i {
  display: block;
  height: 100%;
  background: var(--yellow);
  transition: width 0.45s cubic-bezier(0.22, 0.61, 0.36, 1);
}

.skip .leg-track i {
  background: var(--mint);
}

.leg-val {
  flex: 0 0 34px;
  text-align: right;
  font-family: var(--font-num);
  font-size: 11.5px;
  font-variant-numeric: var(--tnum);
}

// 可点行按 44pt 下限给足高度
.adjust {
  display: block;
  width: 100%;
  min-height: 44px;
  margin-top: #{$sp};
  padding: 0 #{$sp};
  border: 2px solid var(--ink);
  border-radius: var(--r);
  background: #fff;
  color: var(--ink);
  font-size: 12.5px;
  font-weight: 700;
  text-align: left;
}

.foot {
  margin-top: 6px;
  font-family: var(--font-num);
  font-size: 11px;
  opacity: 0.72;
}
</style>
