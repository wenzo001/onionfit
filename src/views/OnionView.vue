<script setup lang="ts">
// 洋葱结构（屏 02）：Q1 穿衣结构 —— 为什么带这件 / 六维需求 / 每层为什么存在 / 体检分
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import InkCard from '@/components/InkCard.vue'
import SectionTitle from '@/components/SectionTitle.vue'
import DemandBars from '@/components/DemandBars.vue'
import WhyCard from '@/components/WhyCard.vue'
import WhyThisCard from '@/components/WhyThisCard.vue'
import CheckupCard from '@/components/CheckupCard.vue'
import CoverageCard from '@/components/CoverageCard.vue'
import LayerCard from '@/components/LayerCard.vue'
import StateBanner from '@/components/StateBanner.vue'
import PageSkeleton from '@/components/PageSkeleton.vue'
import { usePlan } from '@/composables/usePlan'
import { useBoundaryStates } from '@/composables/useBoundaryStates'

const router = useRouter()
const { weather, recommendation, settings } = usePlan()
const { activeStates } = useBoundaryStates(weather, recommendation)
const rec = computed(() => recommendation.value)
const states = computed(() => activeStates.value.filter((s) => s.scope !== 'timeline'))
</script>

<template>
  <div class="page">
    <div class="screen">
      <StateBanner
        v-for="s in states"
        :key="s.key"
        :state="s"
        @cta="router.push({ name: 'me' })"
      />

      <PageSkeleton v-if="!rec && !weather.error" />
      <template v-else-if="rec">
        <section class="col">
          <SectionTitle
            title="洋葱结构"
            sub="今天这套怎么来的 ↓"
          />
          <LayerCard :rec="rec" />
        </section>

      <section class="col">
        <SectionTitle
          title="六项需求"
          sub="满分 100"
        />
        <InkCard class="pad">
          <DemandBars
            :vector="rec.demand.vector"
            :facts="rec.facts"
            :safety="rec.safety"
          />
        </InkCard>
      </section>

      <section class="col">
        <SectionTitle
          title="每层为什么存在"
          sub="从上到下 = 从外到内"
        />
        <WhyCard :rec="rec" />
      </section>

      <section class="col">
        <SectionTitle
          title="为什么是这套"
          sub="每条理由都标出处"
        />
        <WhyThisCard
          :rec="rec"
          :settings="settings.settings"
        />
      </section>

      <section class="col">
        <SectionTitle
          title="体检分"
          sub="这套的匹配度"
        />
        <CheckupCard :rec="rec" />
      </section>

      <section class="col">
        <SectionTitle
          title="覆盖情况"
          sub="衣物库够不够用，明说"
        />
        <CoverageCard :rec="rec" />
      </section>
      </template>
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

.pad {
  padding: #{$sp * 1.5};
}
</style>
