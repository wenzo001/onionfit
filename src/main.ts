import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import { registerSW } from 'virtual:pwa-register'
import 'virtual:uno.css'
import './styles/main.scss'

registerSW({
  immediate: true,
  onNeedRefresh() {
    // 简单提示刷新（后续在 UI 中优化）
    if (confirm('发现新版本，点确定刷新')) {
      window.location.reload()
    }
  },
  onOfflineReady() {
    console.info('[PWA] 应用已可离线使用')
  },
})

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
