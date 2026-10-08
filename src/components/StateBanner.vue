<script setup lang="ts">
// 边界状态条：编号 + 标题 + 事实说明 + 可选动作
// 编号与设计交付包 §07 一一对应，界面与文档说的是同一件事
import InkCard from './InkCard.vue'
import BadgePill from './BadgePill.vue'
import type { ActiveState } from '@/composables/useBoundaryStates'

defineProps<{
  state: ActiveState
}>()

const emit = defineEmits<{ cta: [action: NonNullable<ActiveState['ctaAction']>] }>()
</script>

<template>
  <InkCard
    class="state"
    :tone="state.tone"
    :class="`tone-${state.tone}`"
    role="status"
  >
    <div class="head">
      <BadgePill :tone="state.tone === 'ink' ? 'pink' : state.tone === 'card' ? 'ink' : 'yellow'">
        {{ state.id }}
      </BadgePill>
      <b>{{ state.title }}</b>
    </div>
    <p class="body">{{ state.body }}</p>
    <button
      v-if="state.cta && state.ctaAction"
      type="button"
      class="cta"
      @click="emit('cta', state.ctaAction!)"
    >
      {{ state.cta }}
    </button>
    <div
      v-else-if="state.cta"
      class="cta-text"
    >
      {{ state.cta }}
    </div>
    <div class="key">{{ state.key }}</div>
  </InkCard>
</template>

<style scoped lang="scss">
@use '@/styles/tokens' as *;

.state {
  padding: #{$sp * 1.5};
}

.head {
  display: flex;
  align-items: center;
  gap: #{$sp};
}

.head b {
  font-size: 14px;
  font-weight: #{$title-weight};
}

.body {
  margin-top: 6px;
  font-size: 12.5px;
  line-height: 1.6;
}

.cta {
  display: block;
  width: 100%;
  min-height: 44px;
  margin-top: #{$sp};
  padding: 0 #{$sp};
  border: 2px solid currentColor;
  border-radius: var(--r);
  background: transparent;
  font-size: 12.5px;
  font-weight: 800;
  text-align: left;
}

.cta-text {
  margin-top: 6px;
  font-size: 12.5px;
  font-weight: 800;
  text-decoration: underline;
}

.key {
  margin-top: 6px;
  font-family: var(--font-num);
  font-size: 10.5px;
  opacity: 0.55;
}

/* 白卡状态用墨色正文，彩底状态由 InkCard 决定字色 */
.tone-card,
.tone-paper {
  color: var(--ink-2);

  .head b {
    color: var(--ink);
  }
}
</style>
