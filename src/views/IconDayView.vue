<script setup lang="ts">
// 图标版主屏（屏 10）：纯图形零文字 —— 验证「不用读字也能拿到结论」
// 状态仍由 通道一（填充）表达，层角色仍由 通道二（行底色）表达
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import GarmentIcon from '@/components/GarmentIcon.vue'
import InkCard from '@/components/InkCard.vue'
import LayerCard from '@/components/LayerCard.vue'
import PageSkeleton from '@/components/PageSkeleton.vue'
import { UMBRELLA_ICON } from '@/components/garments'
import { usePlan } from '@/composables/usePlan'

const router = useRouter()
const { recommendation } = usePlan()
const rec = computed(() => recommendation.value)

/** 结论色只保留三种状态：带 / 穿雨衣 / 不带 */
const umbrellaTone = computed(() => {
  const v = rec.value?.umbrella.verdict
  return v === 'SKIP' ? 'mint' : v === 'RAINCOAT' ? 'orange' : 'blue'
})
</script>

<template>
  <div class="page">
    <PageSkeleton v-if="!rec" />

    <div
      v-else
      class="screen"
    >
      <section class="col col-wide">
        <button
          type="button"
          class="back"
          aria-label="返回今天"
          @click="router.push({ name: 'day' })"
        >
          ‹
        </button>
      </section>

      <section class="col col-wide">
        <LayerCard
          :rec="rec"
          graphic
        />
      </section>

      <section class="col">
        <InkCard
          class="umb"
          :tone="umbrellaTone"
          role="img"
          aria-label="带伞结论"
        >
          <GarmentIcon
            :icon="UMBRELLA_ICON"
            :size="92"
            label="带伞结论"
          />
        </InkCard>
      </section>

      <section class="col">
        <InkCard
          tone="ink"
          class="safe"
          aria-label="安全等级"
        >
          <span
            class="bang"
            :class="{ soft: rec.safety.level === 'NORMAL' }"
          >!</span>
        </InkCard>
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

.back {
  width: 44px;
  height: 44px;
  border: var(--sw) solid var(--ink);
  border-radius: 50%;
  background: var(--card);
  box-shadow: var(--shadow);
  font-size: 22px;
  font-weight: 900;
  line-height: 1;
  color: var(--ink);
}

.umb,
.safe {
  display: grid;
  place-items: center;
  min-height: 128px;
}

.bang {
  width: 44px;
  height: 44px;
  display: grid;
  place-items: center;
  border: 2px solid var(--ink);
  border-radius: 50%;
  background: var(--pink);
  color: var(--ink);
  font-family: var(--font-num);
  font-weight: #{$numeral-weight};
  font-size: 20px;
}

/* 常态不需要预警：把它压成灰点，颜色只留给真的有事的时候 */
.bang.soft {
  background: transparent;
  border-style: dashed;
  color: rgba(255, 255, 255, 0.7);
}
</style>
