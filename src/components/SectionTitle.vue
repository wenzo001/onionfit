<script setup lang="ts">
// 区块标题：一屏一段的锚点，副标题说明这段回答哪个问题
defineProps<{
  title: string
  sub?: string
}>()
</script>

<template>
  <h2 class="sec">
    <span class="t">{{ title }}</span>
    <span
      v-if="sub"
      class="s"
    >{{ sub }}</span>
  </h2>
</template>

<style scoped lang="scss">
@use '@/styles/tokens' as *;

.sec {
  display: flex;
  align-items: baseline;
  gap: #{$sp};
  flex-wrap: wrap;
  margin: 0 0 8px;
}

.t {
  font-size: 16px;
  font-weight: #{$title-weight};
  color: var(--ink);
}

.s {
  font-size: 11.5px;
  font-weight: 700;
  color: rgba(0, 0, 0, 0.6);
}
</style>
