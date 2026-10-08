<script setup lang="ts">
// 胶囊徽章：层号、概率、被强制抬升的需求维度。字体走数字栈，黑字或白字由底色决定
withDefaults(
  defineProps<{
    tone?: 'orange' | 'blue' | 'yellow' | 'pink' | 'mint' | 'ink' | 'plain'
    size?: 'sm' | 'md'
  }>(),
  { tone: 'ink', size: 'sm' },
)
</script>

<template>
  <span
    class="badge"
    :class="[`b-${tone}`, size]"
  ><slot /></span>
</template>

<style scoped lang="scss">
@use '@/styles/tokens' as *;

.badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-family: var(--font-num);
  font-weight: #{$numeral-weight};
  line-height: 1.4;
  padding: 2px 9px;
  border-radius: var(--r-pill);
  border: 2px solid var(--ink);
  color: var(--ink);
  background: var(--ink);
  white-space: nowrap;

  &.sm {
    font-size: 11px;
  }

  &.md {
    font-size: 13px;
    padding: 4px 12px;
  }
}

/* 彩底徽章一律墨字（白字压橘 2.84 / 粉 3.14 / 蓝 3.54，均不达正文 AA） */
.b-orange {
  background: var(--orange);
}

.b-blue {
  background: var(--blue);
}

.b-yellow {
  background: var(--yellow);
}

.b-pink {
  background: var(--pink);
}

.b-mint {
  background: var(--mint);
}

/* 唯一反相：墨底配黄字（安全预警的编号），21:1 */
.b-ink {
  background: var(--ink);
  color: var(--yellow);
}

/* 黑底卡里用白底黑字 */
.b-plain {
  background: #fff;
  color: var(--ink);
}
</style>
