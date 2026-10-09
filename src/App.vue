<script setup lang="ts">
// 应用外壳：雪碧图挂一次 + 页面切换动画 + 导航
// 移动端 = 底部固定 Tab；桌面 ≥1180 = 左侧导航栏（屏 08 的第一栏）
import { computed, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import SpriteSheet from '@/components/SpriteSheet.vue'
import InkTabBar from '@/components/InkTabBar.vue'

const route = useRoute()
const router = useRouter()

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

// 切换动画按「导航类型」分三种，而不是一律淡入淡出：
// Tab 之间 = 瞬间换内容（iOS TabBar 就是这个手感，做位移动画反而像网页）；
// 进下钻屏 = 从右推进；返回 = 原路退回。
const transition = ref('')
let lastPos = Number((router.options.history.state as { position?: number }).position ?? 0)

// 下钻屏不显示底部 Tab（iOS 推进二级页时 TabBar 会一起退场），
// 于是那一屏也不需要为它留 padding-bottom
const isPush = computed(() => route.meta.kind === 'push')

watch(
  () => route.fullPath,
  (_to, from) => {
    // 首屏不做动画（from 为 undefined 时是初始导航）
    if (from === undefined) {
      lastPos = Number((router.options.history.state as { position?: number }).position ?? 0)
      return
    }
    const pos = Number((router.options.history.state as { position?: number }).position ?? 0)
    const back = pos < lastPos
    lastPos = pos
    const toTab = route.meta.kind === 'tab'
    const fromTab = router.resolve(from).meta.kind === 'tab'
    if (toTab && fromTab) transition.value = ''
    else transition.value = back ? 'screen-back' : 'screen-forward'
  },
)
</script>

<template>
  <SpriteSheet />
  <div
    class="shell"
    :class="{ 'no-tabbar': isPush }"
  >
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
        <Transition :name="transition">
          <component :is="Component" />
        </Transition>
      </RouterView>
    </main>
  </div>

  <InkTabBar
    v-if="!isPush"
    class="tabbar-mobile"
  />
</template>

<style scoped lang="scss">
@use '@/styles/tokens' as *;

.shell {
  display: grid;
  grid-template-columns: 1fr;
  // dvh：移动浏览器的地址栏收放会改视口高度，用 vh 会永远多出一截可滚的空白
  min-height: 100vh;
  min-height: 100dvh;
  // 状态栏/刘海留白交给每一屏自己的顶边处理（.screen / 选城页的 .topbar）：
  // 放在这里会让钉住的搜索栏与留白叠两次，或者钉住时反而压进状态栏
  // 底部 Tab 已固定，内容靠这条让开，最后一张卡不会被压住
  padding-bottom: calc(var(--tabbar-h) + #{$sp} + env(safe-area-inset-bottom, 0px));
  background: var(--paper);
}

.stage {
  min-width: 0;
  position: relative;
}

/* 没有底部 Tab 的屏：只留正常的安全区余量 */
.shell.no-tabbar {
  padding-bottom: calc(#{$sp * 4} + env(safe-area-inset-bottom, 0px));
}

/* 移动端用底部 Tab，导航栏不出现 */
.rail {
  display: none;
}

.tabbar-mobile {
  display: block;
}

/* ===== 下钻屏的推进 / 退回 ===== */
.screen-forward-enter-active,
.screen-forward-leave-active,
.screen-back-enter-active,
.screen-back-leave-active {
  transition:
    transform 0.26s cubic-bezier(0.32, 0.72, 0, 1),
    opacity 0.26s ease;
  will-change: transform;
}

/* 离开的那页移出文档流：否则它一撤，document 高度瞬间塌掉，
   浏览器会把滚动位置硬夹一下 —— 这就是「切换时滚动手感不对」的来源 */
.screen-forward-leave-active,
.screen-back-leave-active {
  position: absolute;
  inset: 0;
}

.screen-forward-enter-from {
  transform: translateX(100%);
}

.screen-forward-leave-to {
  transform: translateX(-18%);
  opacity: 0.45;
}

.screen-back-enter-from {
  transform: translateX(-18%);
  opacity: 0.45;
}

.screen-back-leave-to {
  transform: translateX(100%);
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
      // 白字压橘只有 2.84，墨字 7.46
      color: var(--ink);
    }
  }
}

@media (prefers-reduced-motion: reduce) {
  .screen-forward-enter-active,
  .screen-forward-leave-active,
  .screen-back-enter-active,
  .screen-back-leave-active {
    transition: opacity 0.12s ease;
    transform: none !important;
  }
}
</style>
