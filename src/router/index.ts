import { createRouter, createWebHashHistory, RouteRecordRaw } from 'vue-router'

// 路由配置
const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/chat'
  },
  {
    path: '/chat/:sessionId?',
    name: 'Chat',
    component: () => import('@/components/chat/ChatView.vue'),
    meta: { title: '聊天' }
  },
  {
    path: '/stats',
    name: 'Stats',
    component: () => import('@/components/stats/StatsView.vue'),
    meta: { title: '统计' }
  },
  {
    path: '/settings',
    name: 'Settings',
    component: () => import('@/components/settings/SettingsView.vue'),
    meta: { title: '设置' }
  },
  {
    path: '/skills',
    name: 'Skills',
    component: () => import('@/components/skills/SkillsView.vue'),
    meta: { title: '技能' }
  }
]

const router = createRouter({
  history: createWebHashHistory(),
  routes
})

// 路由守卫：更新页面标题
router.beforeEach((to, _from, next) => {
  const title = to.meta.title as string
  if (title) {
    document.title = `${title} - TRAE Ultra`
  }
  next()
})

export default router
