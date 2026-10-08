<script setup lang="ts">
// 首屏加载占位：与真实卡片同构的墨线骨架（无缓存时）
</script>

<template>
  <div class="screen">
    <div class="sk sk-hero" />
    <div class="sk sk-card" />
    <div class="sk sk-card short" />
  </div>
</template>

<style scoped lang="scss">
@use '@/styles/tokens' as *;

.sk {
  border: var(--sw) solid var(--ink);
  border-radius: var(--r);
  background:
    linear-gradient(100deg, var(--card) 40%, var(--paper) 50%, var(--card) 60%);
  background-size: 200% 100%;
  animation: shimmer 1.3s linear infinite;
}

.sk-hero {
  min-height: 168px;
}

.sk-card {
  min-height: 208px;

  &.short {
    min-height: 118px;
  }
}

@keyframes shimmer {
  to {
    background-position: -200% 0;
  }
}
</style>
