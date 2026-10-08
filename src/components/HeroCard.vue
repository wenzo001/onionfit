<script setup lang="ts">
// 主屏头卡（01 的第一块）：城市与时刻 + 大号气温 + 洋葱君气泡
// 洋葱君是产品人格的唯一具象，不承担信息职责 —— 拿掉它结论照样可读
import { computed } from 'vue'
import GarmentIcon from './GarmentIcon.vue'
import InkCard from './InkCard.vue'
import { MASCOT_ICON } from './garments'
import {
  cityLine,
  feelsLikeText,
  formatClock,
  humidityLine,
  mascotBubble,
  updatedLine,
  weatherDesc,
} from '@/presentation'
import { useNow } from '@/composables/useNow'
import type { OutfitRecommendation } from '@/core/types'

const props = defineProps<{
  rec: OutfitRecommendation
  city: { name: string; admin1?: string }
  /** 数据生成时刻（不是本机时间），界面所有「几点更新」都用它 */
  generatedAt: string
}>()

const emit = defineEmits<{ pickCity: [] }>()

const generated = computed(() => new Date(props.generatedAt))
const clock = useNow()
const now = computed(() => formatClock(clock.value))
</script>

<template>
  <InkCard class="hero">
    <div class="top">
      <button
        type="button"
        class="city"
        @click="emit('pickCity')"
      >
        {{ cityLine(props.city) }}
        <span class="caret" aria-hidden="true">▾</span>
      </button>
      <span class="stamp">{{ updatedLine(generated) }} · 现在 {{ now }}</span>
    </div>

    <div class="core">
      <div class="temp-col">
        <div class="temp num">{{ Math.round(rec.current.temperatureC) }}°</div>
        <div class="cond">
          {{ weatherDesc(rec.current.condition, rec.current.isDay) }}
        </div>
        <div class="meta">
          {{ feelsLikeText(rec.thermal.feelsLikeC, rec.current.temperatureC) }} ·
          {{ humidityLine(rec.current.humidityPercent) }}
        </div>
        <div
          v-if="rec.current.windSpeedMs >= 0"
          class="meta wind"
        >
          风 {{ (Math.round(rec.current.windSpeedMs * 10) / 10).toFixed(1) }} m/s
        </div>
      </div>
      <div class="mascot">
        <div
          class="bubble"
          aria-hidden="true"
        >
          {{ mascotBubble(rec) }}
        </div>
        <GarmentIcon
          :icon="MASCOT_ICON"
          :size="86"
          label="洋葱君"
        />
      </div>
    </div>
  </InkCard>
</template>

<style scoped lang="scss">
@use '@/styles/tokens' as *;

.hero {
  padding: #{$sp * 1.5};
}

.top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: #{$sp};
  min-height: 44px;
}

.city {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  min-height: 44px;
  padding: 0 #{$sp};
  border: 2px solid var(--ink);
  border-radius: var(--r-pill);
  font-size: 14px;
  font-weight: #{$title-weight};
  color: var(--ink);
  background: var(--card);
}

.caret {
  font-size: 11px;
  opacity: 0.6;
}

.stamp {
  font-family: var(--font-num);
  font-size: 11px;
  color: rgba(0, 0, 0, 0.62);
  text-align: right;
}

.core {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: #{$sp};
  margin-top: 2px;
}

.temp-col {
  min-width: 0;
}

/* 气温是背景信息，字号让位给「此刻穿几层」（信息优先级 1） */
.temp {
  font-size: 44px;
  font-weight: #{$numeral-weight};
  line-height: 1.05;
  color: var(--ink);
}

.cond {
  margin-top: 2px;
  font-size: 13.5px;
  font-weight: 700;
  color: var(--ink);
}

.meta {
  margin-top: 3px;
  font-size: 12px;
  color: rgba(0, 0, 0, 0.72);
}

.meta.wind {
  font-family: var(--font-num);
  color: var(--blue);
  font-weight: #{$numeral-weight};
}

.mascot {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.bubble {
  max-width: 132px;
  padding: 5px 9px;
  border: 2px solid var(--ink);
  border-radius: var(--r);
  background: var(--paper);
  font-size: 11.5px;
  font-weight: 700;
  line-height: 1.4;
  color: var(--ink);
}
</style>
