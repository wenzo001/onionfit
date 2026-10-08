import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import UnoCSS from 'unocss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(() => ({
  // 部署 base 可注入：GitHub Pages 子路径部署时 CI 传 VITE_BASE=/OnionFit/，
  // 本地 dev / 自托管默认根路径
  base: process.env.VITE_BASE ?? '/',
  plugins: [
    vue(),
    UnoCSS(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: '洋葱穿搭 OnionFit',
        short_name: 'OnionFit',
        description: '按天气告诉你今天怎么穿、穿几层、什么时候脱',
        lang: 'zh-CN',
        display: 'standalone',
        orientation: 'portrait',
        // 纸底奶油色 + 墨线，与设计令牌的 --paper / --ink 一致
        theme_color: '#FFF5E1',
        background_color: '#FFF5E1',
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: true,
    port: 5173,
  },
  build: {
    target: 'es2022',
  },
}))