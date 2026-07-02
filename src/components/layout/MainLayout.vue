<script setup lang="ts">
import { ref } from 'vue'
import TitleBar from './TitleBar.vue'
import StatusBar from './StatusBar.vue'
import ConversationList from '@/components/sidebar/ConversationList.vue'

// 侧边栏折叠状态
const sidebarCollapsed = ref(false)

// 切换侧边栏
const toggleSidebar = () => {
  sidebarCollapsed.value = !sidebarCollapsed.value
}
</script>

<template>
  <div class="h-screen flex flex-col overflow-hidden bg-dark-950">
    <!-- 自定义标题栏 -->
    <TitleBar />

    <!-- 主内容区域：侧边栏 + 内容 -->
    <div class="flex-1 flex overflow-hidden">
      <!-- 左侧侧边栏 -->
      <aside
        class="flex flex-col bg-dark-900 border-r border-dark-800 transition-all duration-300 overflow-hidden"
        :class="sidebarCollapsed ? 'w-0' : 'w-[260px]'"
      >
        <ConversationList />
      </aside>

      <!-- 侧边栏折叠按钮 -->
      <button
        class="w-5 flex-shrink-0 flex items-center justify-center bg-dark-900 hover:bg-dark-800 border-r border-dark-800 text-dark-500 hover:text-dark-300 transition-colors"
        @click="toggleSidebar"
        :title="sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'"
      >
        <svg
          class="w-4 h-4 transition-transform duration-300"
          :class="sidebarCollapsed ? 'rotate-180' : ''"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7" />
        </svg>
      </button>

      <!-- 中间主内容区 -->
      <main class="flex-1 flex flex-col overflow-hidden bg-dark-950">
        <router-view v-slot="{ Component }">
          <transition name="fade" mode="out-in">
            <component :is="Component" class="flex-1 overflow-hidden" />
          </transition>
        </router-view>
      </main>
    </div>

    <!-- 底部状态栏 -->
    <StatusBar />
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
