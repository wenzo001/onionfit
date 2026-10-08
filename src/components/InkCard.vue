<script setup lang="ts">
// 墨线卡：一切承载结论的容器。白底 + 3px 纯黑描边 + 8px 圆角 + 4px 硬阴影（绝不用模糊投影）
// tone 只表达"这条结论属于哪一类"，与颜色语义表一一对应
withDefaults(
  defineProps<{
    tone?: 'card' | 'paper' | 'orange' | 'blue' | 'yellow' | 'pink' | 'mint' | 'ink'
    /** 去阴影（列表内嵌套用，避免影子叠影子） */
    flat?: boolean
    /** 桌面端强调卡 */
    large?: boolean
    /** 虚线边框 = 带着备用 / 未生效 */
    dashed?: boolean
    padded?: boolean
  }>(),
  {
    tone: 'card',
    flat: false,
    large: false,
    dashed: false,
    padded: true,
  },
)
</script>

<template>
  <div
    class="ink-card"
    :class="[
      `t-${tone}`,
      { flat, large, dashed, padded },
    ]"
  >
    <slot />
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/tokens' as *;

.ink-card {
  background: var(--card);
  color: var(--ink-2);
  border: var(--sw) solid var(--ink);
  border-radius: var(--r);
  box-shadow: var(--shadow);
}

.ink-card.flat {
  box-shadow: none;
}

.ink-card.large {
  box-shadow: var(--shadow-lg);
}

.ink-card.dashed {
  border-style: dashed;
}

.ink-card.padded {
  padding: #{$sp * 2};
}

// tone → 底与字色
// 除纯黑底外，彩底一律墨字：白字压橘/蓝/粉只有 2.8–3.5，达不到正文 AA；墨字为 5.4–7.5
.t-paper {
  background: var(--paper);
}

.t-orange {
  background: var(--orange);
  color: var(--ink);
}

.t-blue {
  background: var(--blue);
  color: var(--ink);
}

.t-yellow {
  background: var(--yellow);
  color: var(--ink);
}

.t-pink {
  background: var(--pink);
  color: var(--ink);
}

.t-mint {
  background: var(--mint);
  color: var(--ink);
}

.t-ink {
  background: var(--ink);
  color: #fff;
}
</style>
