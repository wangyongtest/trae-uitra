<script setup lang="ts">
import { computed, onMounted, onUnmounted } from 'vue'
import { useStatsStore } from '@/stores/stats'
import { useConfig } from '@/composables/useIPC'

const statsStore = useStatsStore()
const { models } = useConfig()

// 连接状态（开发模式默认已连接）
const isConnected = computed(() => true)

// 缓存状态颜色
const cacheStatusColor = computed(() => {
  const status = statsStore.cacheStats.status
  if (status === 'green') return 'bg-green-500'
  if (status === 'yellow') return 'bg-yellow-500'
  return 'bg-red-500'
})

// 缓存命中率百分比
const cacheHitPercent = computed(() => {
  return (statsStore.cacheStats.hitRate * 100).toFixed(1)
})

// 当前模型
const currentModel = computed(() => {
  return 'DeepSeek V3'
})

// 格式化费用
const formatCost = (cost: number) => {
  return '$' + cost.toFixed(4)
}

onMounted(() => {
  // 启动自动刷新统计数据
  statsStore.startAutoRefresh(5000)
})

onUnmounted(() => {
  statsStore.stopAutoRefresh()
})
</script>

<template>
  <div class="h-7 bg-dark-900 border-t border-dark-800 flex items-center justify-between px-3 text-xs text-dark-400 select-none">
    <!-- 左侧：模型选择和连接状态 -->
    <div class="flex items-center gap-4">
      <!-- 当前模型 -->
      <button class="flex items-center gap-1.5 hover:text-dark-200 transition-colors">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
        <span>{{ currentModel }}</span>
        <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <!-- 连接状态 -->
      <div class="flex items-center gap-1.5">
        <span
          class="w-2 h-2 rounded-full"
          :class="isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'"
        ></span>
        <span>{{ isConnected ? 'Kernel已连接' : 'Kernel未连接' }}</span>
      </div>
    </div>

    <!-- 中间：缓存命中率 -->
    <div class="flex items-center gap-2">
      <span class="w-2 h-2 rounded-full" :class="cacheStatusColor"></span>
      <span>Cache Hit: {{ cacheHitPercent }}%</span>
    </div>

    <!-- 右侧：费用和速度 -->
    <div class="flex items-center gap-4">
      <!-- Token速度（流式时显示） -->
      <div class="flex items-center gap-1.5">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
        <span>-- Token/s</span>
      </div>

      <!-- 今日费用 -->
      <div class="flex items-center gap-1.5">
        <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <span>{{ formatCost(statsStore.costStats.todayCost) }}</span>
      </div>
    </div>
  </div>
</template>
