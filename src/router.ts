import { createRouter, createWebHistory } from 'vue-router'

// 屏幕清单（设计交付包 §06）：01 今日主屏 / 02 洋葱结构 / 03 伞&时间线 / 04 设置 /
// 05 状态墙 / 06 首次引导 / 09 服装图鉴 / 10 图标版主屏 —— 07、08 是断点形态，不是独立路由
const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    { path: '/', redirect: { name: 'day' } },
    { path: '/day', name: 'day', component: () => import('@/views/DayView.vue') },
    { path: '/onion', name: 'onion', component: () => import('@/views/OnionView.vue') },
    { path: '/timeline', name: 'timeline', component: () => import('@/views/TimelineView.vue') },
    { path: '/umbrella', name: 'umbrella', component: () => import('@/views/UmbrellaView.vue') },
    { path: '/me', name: 'me', component: () => import('@/views/MeView.vue') },
    { path: '/welcome', name: 'welcome', component: () => import('@/views/WelcomeView.vue') },
    { path: '/states', name: 'states', component: () => import('@/views/StatesView.vue') },
    { path: '/gallery', name: 'gallery', component: () => import('@/views/GalleryView.vue') },
    { path: '/icons', name: 'iconDay', component: () => import('@/views/IconDayView.vue') },
    { path: '/city', name: 'city', component: () => import('@/views/CityPickerView.vue') },
  ],
})

export default router
