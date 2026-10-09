import { createRouter, createWebHistory } from 'vue-router'

// 屏幕清单（设计交付包 §06）：01 今日主屏 / 02 洋葱结构 / 03 伞&时间线 / 04 设置 /
// 05 状态墙 / 06 首次引导 / 09 服装图鉴 / 10 图标版主屏 —— 07、08 是断点形态，不是独立路由
//
// meta.kind 决定切换动画：tab = 底部四个主入口之间（原生 TabBar 是瞬间换内容，不做位移）；
// push = 下钻屏（像 iOS 从右侧推进来，返回时原路退回）。
const tab = { kind: 'tab' } as const
const push = { kind: 'push' } as const

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: { name: 'day' } },
    { path: '/day', name: 'day', meta: tab, component: () => import('@/views/DayView.vue') },
    { path: '/onion', name: 'onion', meta: push, component: () => import('@/views/OnionView.vue') },
    { path: '/timeline', name: 'timeline', meta: tab, component: () => import('@/views/TimelineView.vue') },
    { path: '/umbrella', name: 'umbrella', meta: tab, component: () => import('@/views/UmbrellaView.vue') },
    { path: '/me', name: 'me', meta: tab, component: () => import('@/views/MeView.vue') },
    { path: '/welcome', name: 'welcome', meta: push, component: () => import('@/views/WelcomeView.vue') },
    { path: '/states', name: 'states', meta: push, component: () => import('@/views/StatesView.vue') },
    { path: '/gallery', name: 'gallery', meta: push, component: () => import('@/views/GalleryView.vue') },
    { path: '/icons', name: 'iconDay', meta: push, component: () => import('@/views/IconDayView.vue') },
    { path: '/city', name: 'city', meta: push, component: () => import('@/views/CityPickerView.vue') },
  ],
  // 换页一律回到顶部，且**不记忆**滚动位置：SPA 同一个 document，浏览器不会自己归零，
  // 于是从「我的」滚到一半再进「换城市」会停在半截 —— 每屏都从第一条内容开始读。
  // savedPosition 在这里被刻意忽略（返回时也不恢复），与「滚动不该被记住」的口径一致。
  scrollBehavior: () => ({ left: 0, top: 0, behavior: 'instant' }),
})

export default router
