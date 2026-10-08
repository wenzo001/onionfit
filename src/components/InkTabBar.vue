<script setup lang="ts">
// 底部 Tab（组件 D）：胶囊容器 + 选中项=橘色胶囊
// 桌面端不用底 Tab，改左侧导航栏（Shell 按断点切换）
import { computed } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

const TABS = [
  { name: 'day', label: '今天' },
  { name: 'timeline', label: '一天' },
  { name: 'umbrella', label: '带伞' },
  { name: 'me', label: '我的' },
] as const

/** /onion 与 /welcome 是下钻屏，不属于四个主入口，高亮留在「今天」 */
const activeName = computed(() => {
  const n = route.name as string | undefined
  return TABS.some((t) => t.name === n) ? n : 'day'
})
</script>

<template>
  <nav
    class="tabbar"
    aria-label="主导航"
  >
    <div class="pill">
      <RouterLink
        v-for="t in TABS"
        :key="t.name"
        class="tab"
        :class="{ on: activeName === t.name }"
        :to="{ name: t.name }"
        :aria-current="activeName === t.name ? 'page' : undefined"
      >
        {{ t.label }}
      </RouterLink>
    </div>
  </nav>
</template>

<style scoped lang="scss">
@use '@/styles/tokens' as *;

.tabbar {
  position: sticky;
  bottom: 0;
  z-index: 30;
  padding: #{$sp} #{$page-pad} calc(#{$sp} + env(safe-area-inset-bottom, 0px));
  background: linear-gradient(to top, var(--paper) 62%, rgba(255, 245, 225, 0));
}

.pill {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  border: var(--sw) solid var(--ink);
  border-radius: var(--r-pill);
  padding: 5px;
  background: var(--card);
  box-shadow: var(--shadow);
}

.tab {
  flex: 1;
  display: grid;
  place-items: center;
  // 触摸目标高度下限 44pt
  min-height: 44px;
  font-size: 12.5px;
  font-weight: 800;
  color: rgba(0, 0, 0, 0.62);
  text-decoration: none;
  border-radius: var(--r-pill);
  transition:
    color 0.18s ease,
    background 0.18s ease;
}

.tab.on {
  background: var(--orange);
  // 白字压橘只有 2.84，墨字 7.46
  color: var(--ink);
}

.tab:not(.on):active {
  background: var(--paper);
  color: var(--ink);
}
</style>
