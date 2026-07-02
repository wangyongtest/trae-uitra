import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { CacheStats, CostStats } from '@/types'

export const useStatsStore = defineStore('stats', () => {
  // ==========================================
  // State
  // ==========================================
  const cacheStats = ref<CacheStats>({
    hitRate: 0,
    status: 'green',
    totalPrompt: 0,
    totalHit: 0,
    history: []
  })

  const costStats = ref<CostStats>({
    totalCost: 0,
    todayCost: 0,
    costByModel: {},
    budgetAlert: {
      dailyBudget: 1.0,
      todayUsed: 0,
      threshold: 0.8,
      triggered: false
    }
  })

  const isLoading = ref(false)
  let autoRefreshTimer: number | null = null

  // ==========================================
  // Actions
  // ==========================================

  /**
   * 刷新缓存统计数据
   */
  const refreshCacheStats = async () => {
    try {
      const trae = (window as any).trae?.ultra
      if (trae?.stats?.getCacheStats) {
        cacheStats.value = await trae.stats.getCacheStats()
      } else {
        // 开发模式：模拟数据
        cacheStats.value = generateMockCacheStats()
      }
    } catch (error) {
      console.error('获取缓存统计失败:', error)
    }
  }

  /**
   * 刷新费用统计数据
   */
  const refreshCostStats = async () => {
    try {
      const trae = (window as any).trae?.ultra
      if (trae?.stats?.getCostStats) {
        costStats.value = await trae.stats.getCostStats()
      } else {
        // 开发模式：模拟数据
        costStats.value = generateMockCostStats()
      }
    } catch (error) {
      console.error('获取费用统计失败:', error)
    }
  }

  /**
   * 刷新所有统计数据
   */
  const refreshAll = async () => {
    isLoading.value = true
    try {
      await Promise.all([refreshCacheStats(), refreshCostStats()])
    } finally {
      isLoading.value = false
    }
  }

  /**
   * 开始自动刷新
   */
  const startAutoRefresh = (interval = 5000) => {
    stopAutoRefresh()
    refreshAll()
    autoRefreshTimer = window.setInterval(refreshAll, interval)
  }

  /**
   * 停止自动刷新
   */
  const stopAutoRefresh = () => {
    if (autoRefreshTimer !== null) {
      clearInterval(autoRefreshTimer)
      autoRefreshTimer = null
    }
  }

  /**
   * 开发模式：生成模拟缓存统计
   */
  const generateMockCacheStats = (): CacheStats => {
    const now = Date.now()
    const history = Array.from({ length: 50 }, (_, i) => {
      const hitRate = 0.6 + Math.random() * 0.35
      const promptTokens = Math.floor(500 + Math.random() * 2000)
      const cachedTokens = Math.floor(promptTokens * hitRate)
      return {
        timestamp: now - (49 - i) * 60000,
        promptTokens,
        completionTokens: Math.floor(200 + Math.random() * 800),
        cachedTokens,
        hitRate,
        cost: Math.random() * 0.02,
        modelId: 'deepseek-chat'
      }
    })

    const totalPrompt = history.reduce((sum, h) => sum + h.promptTokens, 0)
    const totalHit = history.reduce((sum, h) => sum + h.cachedTokens, 0)
    const hitRate = totalPrompt > 0 ? totalHit / totalPrompt : 0

    let status: 'green' | 'yellow' | 'red' = 'green'
    if (hitRate < 0.5) status = 'red'
    else if (hitRate < 0.7) status = 'yellow'

    return {
      hitRate,
      status,
      totalPrompt,
      totalHit,
      history
    }
  }

  /**
   * 开发模式：生成模拟费用统计
   */
  const generateMockCostStats = (): CostStats => {
    const costByModel = {
      'deepseek-chat': 0.1234 + Math.random() * 0.1,
      'doubao-pro': 0.0567 + Math.random() * 0.05
    }
    const todayCost = Object.values(costByModel).reduce((a, b) => a + b, 0)
    const totalCost = todayCost + 1.2345 + Math.random() * 2

    return {
      totalCost,
      todayCost,
      costByModel,
      budgetAlert: {
        dailyBudget: 1.0,
        todayUsed: todayCost,
        threshold: 0.8,
        triggered: todayCost > 0.8
      }
    }
  }

  return {
    // State
    cacheStats,
    costStats,
    isLoading,
    // Actions
    refreshCacheStats,
    refreshCostStats,
    refreshAll,
    startAutoRefresh,
    stopAutoRefresh
  }
})
