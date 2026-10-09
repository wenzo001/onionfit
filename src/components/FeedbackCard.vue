<script setup lang="ts">
// 这套准吗（deck 15）：4 个胶囊点一下 → 引擎按反馈小步微调（有上限、可撤销）
// 「偏热 / 闷」一次点击同时记 HOT 与 STUFFY（同刻 = 一批），撤销按批整批撤回
import { computed } from 'vue'
import InkCard from './InkCard.vue'
import BadgePill from './BadgePill.vue'
import { usePlan } from '@/composables/usePlan'
import { applyFeedback, revokeLastFeedback } from '@/core/engine/prefs'
import {
  FEEDBACK_CHIPS,
  FEEDBACK_FOOTNOTE,
  HYSTERESIS,
  feedbackNote,
  hysteresisStateLine,
  lastFeedback,
} from '@/presentation'
import type { FeedbackKind } from '@/core/types'

const { recommendation, settings } = usePlan()

const last = computed(() => lastFeedback(settings.settings.feedbackHistory))
const note = computed(() => (last.value ? feedbackNote(last.value.kinds) : null))
const live = computed(() => (recommendation.value ? hysteresisStateLine(recommendation.value) : null))

function record(kinds: FeedbackKind[]) {
  const at = new Date().toISOString()
  let s = settings.settings
  for (const k of kinds) s = applyFeedback(s, k, at)
  settings.set('feedbackHistory', s.feedbackHistory)
}

function undo() {
  settings.set('feedbackHistory', revokeLastFeedback(settings.settings).feedbackHistory)
}
</script>

<template>
  <div class="fb">
    <div
      class="chips"
      role="group"
      aria-label="这套准吗"
    >
      <button
        v-for="c in FEEDBACK_CHIPS"
        :key="c.label"
        class="chip"
        type="button"
        @click="record(c.kinds)"
      >
        {{ c.label }}
      </button>
    </div>

    <template v-if="last && note">
      <div class="applied">
        <b class="done">「{{ last.label }}」已记下</b>
        <button
          class="undo"
          type="button"
          @click="undo"
        >
          撤销
        </button>
      </div>
      <p class="note">
        {{ note }}
      </p>
    </template>

    <div class="hyst">
      <b class="hyst-title">{{ HYSTERESIS.title }}</b>
      <p class="hyst-example">
        {{ HYSTERESIS.example }}
      </p>
      <p class="hyst-line">
        {{ HYSTERESIS.upgrade }}
      </p>
      <InkCard
        v-if="live"
        flat
        tone="mint"
        class="live"
      >
        {{ live }}
      </InkCard>
      <div class="urgent">
        <BadgePill tone="ink">!</BadgePill>
        <span>{{ HYSTERESIS.urgent }}</span>
      </div>
    </div>

    <p class="foot">
      {{ FEEDBACK_FOOTNOTE }}
    </p>
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/tokens' as *;

.fb {
  display: flex;
  flex-direction: column;
  gap: #{$sp * 1.25};
}

.chips {
  display: flex;
  gap: 6px;
}

.chip {
  flex: 1;
  min-height: 44px;
  padding: 6px 8px;
  border: 2px solid var(--ink);
  border-radius: var(--r-pill);
  background: var(--card);
  color: var(--ink);
  font-size: 13px;
  font-weight: 800;
  white-space: nowrap;
}

.chip:active {
  transform: translate(1px, 1px);
}

.applied {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: #{$sp};
}

.done {
  font-size: 13px;
  font-weight: #{$title-weight};
  color: var(--ink);
}

.undo {
  min-height: 44px;
  padding: 0 #{$sp * 1.25};
  border: 2px solid var(--ink);
  border-radius: var(--r-pill);
  background: var(--card);
  color: var(--ink);
  font-size: 12.5px;
  font-weight: 800;
}

.undo:active {
  transform: translate(1px, 1px);
}

.note {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.6;
  color: var(--ink);
}

.hyst {
  display: flex;
  flex-direction: column;
  gap: 5px;
  border-top: 2px dashed var(--ink);
  padding-top: #{$sp};
}

.hyst-title {
  font-size: 13.5px;
  font-weight: #{$title-weight};
  color: var(--ink);
}

.hyst-example,
.hyst-line {
  margin: 0;
  font-size: 12.5px;
  line-height: 1.6;
  color: var(--ink);
}

.live {
  padding: #{$sp * 0.75} #{$sp};
  font-size: 12.5px;
  line-height: 1.5;
}

.urgent {
  display: flex;
  align-items: flex-start;
  gap: 6px;
  font-size: 12.5px;
  line-height: 1.6;
  color: var(--ink);
}

.foot {
  margin: 0;
  font-size: 11.5px;
  line-height: 1.6;
  color: var(--ink);
}
</style>
