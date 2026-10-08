<script setup lang="ts">
// 应用外壳：雪碧图挂一次 + 页面切换 + 导航
// 移动端 = 底部胶囊 Tab；桌面 ≥1180 = 左侧导航栏（屏 08 的第一栏）
import { useRoute } from 'vue-router'
import SpriteSheet from '@/components/SpriteSheet.vue'
import InkTabBar from '@/components/InkTabBar.vue'

const route = useRoute()

const NAV = [
  { name: 'day', label: '今天' },
  { name: 'timeline', label: '一天' },
  { name: 'umbrella', label: '带伞' },
  { name: 'me', label: '我的' },
] as const

/** 下钻屏（洋葱结构 / 图鉴 / 状态墙）高亮留在父入口 */
function isActive(name: string): boolean {
  const cur = route.name as string | undefined
  if (cur === name) return true
  if (name === 'day') return cur === 'onion' || cur === 'welcome'
  if (name === 'me') return cur === 'gallery' || cur === 'states' || cur === 'iconDay'
  return false
}
</script>

<template>
  <SpriteSheet />
  <div class="shell">
    <nav
      class="rail"
      aria-label="主导航"
    >
      <div class="brand">
        洋葱穿搭
        <span class="sub num">OnionFit</span>
      </div>
      <RouterLink
        v-for="t in NAV"
        :key="t.name"
        class="rail-link"
        :class="{ on: isActive(t.name) }"
        :to="{ name: t.name }"
      >
        {{ t.label }}
      </RouterLink>
    </nav>

    <main class="stage">
      <RouterView v-slot="{ Component }">
        <Transition
          name="page"
          mode="out-in"
        >
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>
  </div>

  <InkTabBar class="tabbar-mobile" />
</template>

<style scoped lang="scss">
@use '@/styles/tokens' as *;

.shell {
  display: grid;
  grid-template-columns: 1fr;
  min-height: 100vh;
  background: var(--paper);
}

/* 移动端用底部 Tab，导航栏不出现 */
.rail {
  display: none;
}

.stage {
  min-width: 0;
}

.tabbar-mobile {
  display: block;
}

.page-enter-active,
.page-leave-active {
  transition:
    opacity 0.18s ease,
    transform 0.18s ease;
}

.page-enter-from {
  opacity: 0;
  transform: translateY(8px);
}

.page-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}

@media (min-width: $bp-tablet) {
  .stage {
    max-width: 834px;
    margin: 0 auto;
    width: 100%;
  }
}

@media (min-width: $bp-desktop) {
  .shell {
    grid-template-columns: 208px 1fr;
    gap: #{$sp * 3};
    padding: #{$sp * 2} #{$sp * 3};
    align-items: start;
  }

  .stage {
    max-width: 1180px;
  }

  .tabbar-mobile {
    display: none;
  }

  .rail {
    display: flex;
    flex-direction: column;
    gap: 6px;
    position: sticky;
    top: #{$sp * 2};
    padding: #{$sp * 1.5};
    border: var(--sw) solid var(--ink);
    border-radius: var(--r);
    background: var(--card);
    box-shadow: var(--shadow);
  }

  .brand {
    font-size: 16px;
    font-weight: #{$title-weight};
    color: var(--ink);
    padding: 0 #{$sp} #{$sp};
    border-bottom: 2px solid rgba(0, 0, 0, 0.14);
    margin-bottom: #{$sp};
  }

  .brand .sub {
    display: block;
    font-size: 10.5px;
    letter-spacing: 0.14em;
    color: rgba(0, 0, 0, 0.5);
  }

  .rail-link {
    display: grid;
    place-items: center;
    min-height: 44px;
    border: 2px solid var(--ink);
    border-radius: var(--r-pill);
    font-size: 13px;
    font-weight: 800;
    color: var(--ink);
    text-decoration: none;
    background: var(--paper);

    &.on {
      background: var(--orange);
      color: #fff;
    }
  }
}

@media (prefers-reduced-motion: reduce) {
  .page-enter-active,
  .page-leave-active {
    transition: none;
  }
}
</style>
