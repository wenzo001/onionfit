<script setup lang="ts">
// 体检分（deck 13 下半）：推荐分 + 8 个分项明细 + 安全等级独立线
// 分项数字原样来自引擎 scoreBreakdown；安全提示与推荐分分开，不互相冒充
import { computed } from 'vue'
import InkCard from './InkCard.vue'
import { scoreDetail, scoreGrade, scoreRows, scoreSafetyNote } from '@/presentation'
import type { OutfitRecommendation } from '@/core/types'

const props = defineProps<{ rec: OutfitRecommendation }>()

const grade = computed(() => scoreGrade(props.rec.dayScore))
const detail = computed(() => scoreDetail(props.rec.dayOutfit, props.rec.thermal.requiredMaxClo))
const rows = computed(() => scoreRows(props.rec))
const note = computed(() => scoreSafetyNote(props.rec))
</script>

<template>
  <InkCard class="checkup">
    <div class="head">
      <div class="score-box">
        <div class="score num">{{ Math.round(rec.dayScore) }}</div>
        <span class="score-cap">推荐分</span>
      </div>
      <div class="copy">
        <b>{{ grade }}</b>
        <span>{{ detail }}</span>
      </div>
    </div>

    <div class="board">
      <div class="board-head">
        <b>这套好在哪</b>
        <span class="num">满分 100</span>
      </div>
      <div
        v-for="row in rows"
        :key="row.label"
        class="b-row"
      >
        <span class="b-label">{{ row.label }}</span>
        <span class="b-value num">{{ row.value }}</span>
      </div>
    </div>

    <div class="safety">
      <b>{{ note.levelLine }}</b>
      <span>{{ note.line }}</span>
      <span class="rule">{{ note.rule }}</span>
    </div>
  </InkCard>
</template>

<style scoped lang="scss">
@use '@/styles/tokens' as *;

.checkup {
  display: flex;
  flex-direction: column;
  gap: #{$sp * 1.5};
  padding: #{$sp * 1.5};
}

.head {
  display: flex;
  align-items: center;
  gap: #{$sp * 1.5};
}

.score-box {
  flex: 0 0 auto;
  text-align: center;
}

.score {
  min-width: 62px;
  font-size: 30px;
  font-weight: #{$numeral-weight};
  color: var(--ink);
  padding: 2px #{$sp};
  border: 2px solid var(--ink);
  border-radius: var(--r);
  background: var(--mint);
}

.score-cap {
  display: block;
  margin-top: 4px;
  font-size: 11px;
  color: rgba(0, 0, 0, 0.6);
}

.copy {
  min-width: 0;
}

.copy b {
  display: block;
  font-size: 14px;
  font-weight: #{$title-weight};
  color: var(--ink);
}

.copy span {
  display: block;
  margin-top: 2px;
  font-family: var(--font-num);
  font-size: 11.5px;
  line-height: 1.5;
  color: rgba(0, 0, 0, 0.72);
}

.board {
  border-top: 2px dashed rgba(0, 0, 0, 0.25);
  padding-top: #{$sp * 1.25};
}

.board-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 6px;
}

.board-head b {
  font-size: 13px;
  font-weight: #{$title-weight};
  color: var(--ink);
}

.board-head span {
  font-size: 11px;
  color: rgba(0, 0, 0, 0.6);
}

.b-row {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: #{$sp};
  padding: 3px 0;
}

.b-label {
  font-size: 12.5px;
  color: var(--ink);
}

.b-value {
  font-size: 12.5px;
  font-weight: #{$numeral-weight};
  color: var(--ink);
  white-space: nowrap;
}

.safety {
  border-top: 2px solid var(--ink);
  padding-top: #{$sp};
}

.safety b {
  display: block;
  font-size: 13px;
  font-weight: #{$title-weight};
  color: var(--ink);
}

.safety span {
  display: block;
  margin-top: 3px;
  font-size: 12px;
  line-height: 1.6;
  color: rgba(0, 0, 0, 0.78);
}

.safety .rule {
  font-size: 11.5px;
  color: rgba(0, 0, 0, 0.6);
}
</style>
