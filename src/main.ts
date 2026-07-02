import { createApp } from 'vue'
import { createPinia } from 'pinia'
import router from './router'
import App from './App.vue'
import './assets/styles/main.css'

// 创建Vue应用实例
const app = createApp(App)

// 注册Pinia状态管理
const pinia = createPinia()
app.use(pinia)

// 注册Vue Router
app.use(router)

// 挂载到#app
app.mount('#app')

// 暴露window.trae类型声明到全局
declare global {
  interface Window {
    trae: {
      ultra: import('./types').TraeUltraAPI
    }
  }
}
