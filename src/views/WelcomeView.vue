<script setup lang="ts">
// 首次引导（屏 06）：零索取 —— 先按默认值给一份结论，再只追问影响最大的两项
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import GarmentIcon from '@/components/GarmentIcon.vue'
import InkCard from '@/components/InkCard.vue'
import BadgePill from '@/components/BadgePill.vue'
import SectionTitle from '@/components/SectionTitle.vue'
import SegmentedPicker from '@/components/SegmentedPicker.vue'
import TimePicker from '@/components/TimePicker.vue'
import { MASCOT_ICON } from '@/components/garments'
import { usePlan } from '@/composables/usePlan'
import { useSettingsStore } from '@/stores/settings'
import { SELECTABLE_ACTIVITIES } from '@/core/engine/activity'
import { ONBOARD, layerTitle, orderLayers, umbrellaHeadline } from '@/presentation'

const router = useRouter()
const { weather, settings, recommendation } = usePlan()
const store = useSettingsStore()

weather.bootstrap()

const rec = computed(() => recommendation.value)
/** 预览块要一个"有结论"的窄化凭据，没有数据时改出走法而不是空骨架 */
const data = computed(() => (rec.value ? { rec: rec.value } : null))
const names = computed(() =>
  rec.value ? orderLayers(rec.value.dayOutfit.layers).map((l) => layerTitle(l)).join(' · ') : '',
)

function enter() {
  store.completeOnboarding()
  router.replace({ name: 'day' })
}
</script>

<template>
  <div class="page">
    <div class="screen">
      <section class="col col-wide">
        <InkCard
          class="greet"
          tone="paper"
        >
          <GarmentIcon
            :icon="MASCOT_ICON"
            :size="112"
            label="洋葱君"
          />
          <div class="say">
            <b>{{ ONBOARD.greeting }}</b>
            <p>{{ ONBOARD.lede }}</p>
          </div>
        </InkCard>
      </section>

      <section
        v-if="data"
        class="col"
      >
        <SectionTitle
          title="按默认值算出来的今天"
          sub="还没改任何设置"
        />
        <InkCard class="preview">
          <div class="p-head">
            <h1 class="headline">
              此刻穿<span class="num">{{ data.rec.wornNowCount }}</span>层
            </h1>
            <BadgePill tone="yellow">默认值</BadgePill>
          </div>
          <p class="names">{{ names }}</p>
          <p class="umb">
            {{ umbrellaHeadline(data.rec.umbrella) }} ·
            <b class="num">{{ data.rec.umbrella.probability }}%</b>
          </p>
        </InkCard>
      </section>

      <!-- 连不上也不编一份预览出来：直说，并给一条出路 -->
      <section
        v-else
        class="col"
      >
        <InkCard
          tone="paper"
          class="preview"
        >
          <b class="nodata">还没拿到{{ weather.city.name }}的天气</b>
          <p class="names">
            没数据就不给结论。可以先选个城市，或者先进去看今天的状态条怎么说。
          </p>
          <button
            type="button"
            class="go"
            @click="router.push({ name: 'city' })"
          >
            手动选城市 →
          </button>
        </InkCard>
      </section>

      <section class="col">
        <SectionTitle
          :title="ONBOARD.askTitle"
          sub="其余三项放「我的」里"
        />
        <InkCard class="ask">
          <div class="q">
            {{ ONBOARD.askActivity }}
            <span class="hint">影响最大</span>
          </div>
          <SegmentedPicker
            scrollable
            :options="SELECTABLE_ACTIVITIES"
            :model-value="settings.activity"
            @update:model-value="settings.set('activity', $event)"
          />
        </InkCard>

        <InkCard class="ask">
          <div class="q">
            {{ ONBOARD.askSchedule }}
            <span class="hint">带伞结论差很多</span>
          </div>
          <div class="pair">
            <TimePicker
              :model-value="settings.outTime"
              placeholder="出门"
              @update:model-value="settings.set('outTime', $event)"
            />
            <span class="sep">→</span>
            <TimePicker
              :model-value="settings.homeTime"
              placeholder="回家"
              @update:model-value="settings.set('homeTime', $event)"
            />
          </div>
        </InkCard>

        <p class="tip">{{ ONBOARD.tip }}</p>

        <button
          type="button"
          class="go"
          @click="enter"
        >
          {{ ONBOARD.cta }}
        </button>
      </section>
    </div>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/tokens' as *;

.col {
  display: flex;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
}

.col-wide {
  grid-column: 1 / -1;
}

.greet {
  display: flex;
  align-items: center;
  gap: #{$sp * 1.5};
  padding: #{$sp * 1.5};
}

.say {
  min-width: 0;
}

.say b {
  display: block;
  font-size: 18px;
  font-weight: #{$title-weight};
  color: var(--ink);
}

.say p {
  margin-top: 4px;
  font-size: 12.5px;
  color: rgba(0, 0, 0, 0.76);
}

.preview {
  padding: #{$sp * 1.5};
}

.nodata {
  display: block;
  font-size: 15px;
  font-weight: #{$title-weight};
  color: var(--ink);
}

.p-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: #{$sp};
}

.headline {
  font-size: 20px;
  font-weight: #{$title-weight};
  color: var(--ink);
}

.headline .num {
  font-family: var(--font-num);
  font-weight: #{$numeral-weight};
  font-size: 48px;
  color: var(--orange);
  margin: 0 4px;
}

.names {
  margin-top: 8px;
  font-size: 12.5px;
  line-height: 1.6;
  color: rgba(0, 0, 0, 0.78);
}

.umb {
  margin-top: 4px;
  font-size: 13px;
  font-weight: 700;
  color: var(--blue);
}

.umb .num {
  font-weight: #{$numeral-weight};
}

.ask {
  padding: #{$sp * 1.5};
}

.q {
  margin-bottom: 10px;
  font-size: 14px;
  font-weight: #{$title-weight};
  color: var(--ink);
}

.hint {
  margin-left: 6px;
  font-size: 11.5px;
  font-weight: 400;
  color: rgba(0, 0, 0, 0.6);
}

.pair {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.sep {
  font-family: var(--font-num);
  color: rgba(0, 0, 0, 0.5);
}

.tip {
  font-size: 11.5px;
  line-height: 1.6;
  color: #{$warn};
  font-weight: 700;
}

.go {
  min-height: 48px;
  border: var(--sw) solid var(--ink);
  border-radius: var(--r-pill);
  background: var(--orange);
  color: var(--ink);
  font-size: 15px;
  font-weight: #{$title-weight};
  box-shadow: var(--shadow);
}
</style>
