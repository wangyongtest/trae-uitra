import { ref, onMounted, onUnmounted } from 'vue'
import type { ModelInfo, Settings, StreamChunk } from '@/types'

/**
 * IPC通信封装composable
 * 封装window.trae.ultra API为易用的composable
 * 所有方法在没有Electron环境（浏览器开发模式）时使用mock数据
 */

const getTrae = () => (window as any).trae?.ultra

export function useChat() {
  const ready = ref(false)
  const chunkCallbacks: Array<(data: { requestId: string; chunk: any }) => void> = []
  const doneCallbacks: Array<(data: { requestId: string }) => void> = []
  const errorCallbacks: Array<(data: { requestId: string; message: string }) => void> = []
  let unsubChunk: (() => void) | null = null
  let unsubDone: (() => void) | null = null
  let unsubError: (() => void) | null = null
  let unsubReady: (() => void) | null = null
  let unsubKernelErr: (() => void) | null = null

  const send = async (params: { message: string; model?: string; conversationId?: string }): Promise<string> => {
    const trae = getTrae()
    if (trae?.chat?.send) {
      return await trae.chat.send(params)
    }
    return 'mock-request-' + Date.now()
  }

  const abort = async (requestId: string) => {
    const trae = getTrae()
    if (trae?.chat?.abort) {
      await trae.chat.abort(requestId)
    }
  }

  const onChunk = (callback: (data: { requestId: string; chunk: StreamChunk }) => void) => {
    chunkCallbacks.push(callback)
    return () => {
      const i = chunkCallbacks.indexOf(callback)
      if (i > -1) chunkCallbacks.splice(i, 1)
    }
  }

  const onDone = (callback: (data: { requestId: string }) => void) => {
    doneCallbacks.push(callback)
    return () => {
      const i = doneCallbacks.indexOf(callback)
      if (i > -1) doneCallbacks.splice(i, 1)
    }
  }

  const onError = (callback: (data: { requestId: string; message: string }) => void) => {
    errorCallbacks.push(callback)
    return () => {
      const i = errorCallbacks.indexOf(callback)
      if (i > -1) errorCallbacks.splice(i, 1)
    }
  }

  onMounted(() => {
    const trae = getTrae()
    if (trae?.system) {
      unsubReady = trae.system.onKernelReady(() => { ready.value = true })
      unsubKernelErr = trae.system.onKernelError(() => { ready.value = false })
      trae.system.ping?.().then(() => { ready.value = true }).catch(() => {})
    } else {
      ready.value = true
    }

    if (trae?.chat) {
      unsubChunk = trae.chat.onChunk((data: any) => {
        chunkCallbacks.forEach(cb => cb(data))
      })
      unsubDone = trae.chat.onDone?.((data: any) => {
        doneCallbacks.forEach(cb => cb(data))
      })
      unsubError = trae.chat.onError?.((data: any) => {
        errorCallbacks.forEach(cb => cb(data))
      })
    }
  })

  onUnmounted(() => {
    unsubChunk?.()
    unsubDone?.()
    unsubError?.()
    unsubReady?.()
    unsubKernelErr?.()
  })

  return { send, abort, onChunk, onDone, onError, ready }
}

export function useStats() {
  const cacheStats = ref<any>({
    hitRate: 0.95, status: 'green', totalPrompt: 0, totalHit: 0, history: []
  })
  const costStats = ref<any>({
    totalCost: 0, todayCost: 0, costByModel: {}, budgetAlert: { threshold: 1.0, current: 0, triggered: false }
  })
  const loading = ref(false)
  let refreshTimer: number | null = null

  const refreshCacheStats = async () => {
    const trae = getTrae()
    if (trae?.cache?.getStats) {
      cacheStats.value = await trae.cache.getStats()
    }
    return cacheStats.value
  }

  const refreshCostStats = async () => {
    const trae = getTrae()
    if (trae?.stats?.getCost) {
      costStats.value = await trae.stats.getCost()
    }
    return costStats.value
  }

  const refresh = async () => {
    loading.value = true
    try {
      await Promise.all([refreshCacheStats(), refreshCostStats()])
    } finally {
      loading.value = false
    }
  }

  const startAutoRefresh = (interval = 5000) => {
    stopAutoRefresh()
    refresh()
    refreshTimer = window.setInterval(refresh, interval)
  }

  const stopAutoRefresh = () => {
    if (refreshTimer) {
      clearInterval(refreshTimer)
      refreshTimer = null
    }
  }

  onMounted(() => { startAutoRefresh() })
  onUnmounted(() => { stopAutoRefresh() })

  return { cacheStats, costStats, loading, refresh, refreshCacheStats, refreshCostStats, startAutoRefresh, stopAutoRefresh }
}

export function useConfig() {
  const models = ref<ModelInfo[]>([])
  const settings = ref<Settings | null>(null)
  const loading = ref(false)

  const loadModels = async () => {
    const trae = getTrae()
    if (trae?.config?.getModels) {
      models.value = await trae.config.getModels()
    } else {
      models.value = [
        { id: 'deepseek-v4-flash', displayName: 'DeepSeek V4 Flash (高速经济)', provider: 'deepseek', providerModelId: 'deepseek-chat', pricing: { inputPricePerMillion: 0.1, outputPricePerMillion: 0.3, cacheHitPriceRatio: 0.1 }, capabilities: { reasoning: true, tools: true, vision: false }, supportsCache: true },
        { id: 'deepseek-v4-pro', displayName: 'DeepSeek V4 Pro (高性能)', provider: 'deepseek', providerModelId: 'deepseek-reasoner', pricing: { inputPricePerMillion: 2.0, outputPricePerMillion: 8.0, cacheHitPriceRatio: 0.1 }, capabilities: { reasoning: true, tools: true, vision: false }, supportsCache: true },
        { id: 'doubao-1.6-flash', displayName: '豆包1.6 Flash (视觉)', provider: 'volcengine', providerModelId: 'doubao-1.5-flash', pricing: { inputPricePerMillion: 0.08, outputPricePerMillion: 0.2, cacheHitPriceRatio: 0.1 }, capabilities: { reasoning: true, tools: true, vision: true }, supportsCache: true },
        { id: 'doubao-1.6', displayName: '豆包1.6 Pro (视觉)', provider: 'volcengine', providerModelId: 'doubao-1.5-pro', pricing: { inputPricePerMillion: 0.5, outputPricePerMillion: 2.0, cacheHitPriceRatio: 0.1 }, capabilities: { reasoning: true, tools: true, vision: true }, supportsCache: true }
      ] as ModelInfo[]
    }
    return models.value
  }

  const loadSettings = async () => {
    const trae = getTrae()
    if (trae?.config?.getSettings) {
      settings.value = await trae.config.getSettings()
    } else {
      const saved = localStorage.getItem('trae-ultra-settings')
      if (saved) {
        settings.value = JSON.parse(saved)
      } else {
        settings.value = { apiKeys: {}, defaultModel: 'deepseek-v4-flash', theme: 'dark', budget: 1.0, fontSize: 14, language: 'zh-CN' } as Settings
      }
    }
    return settings.value
  }

  const saveSettings = async (newSettings: Settings) => {
    const trae = getTrae()
    if (trae?.config?.saveSettings) {
      await trae.config.saveSettings(newSettings)
    }
    localStorage.setItem('trae-ultra-settings', JSON.stringify(newSettings))
    settings.value = newSettings
  }

  const testConnection = async (provider: string, apiKey: string) => {
    const trae = getTrae()
    if (trae?.provider?.testConnection) {
      return await trae.provider.testConnection(provider, apiKey)
    }
    await new Promise(r => setTimeout(r, 800))
    return { success: apiKey.length > 10, message: apiKey.length > 10 ? '连接成功（模拟）' : 'API Key格式不正确', latency: 120 }
  }

  onMounted(() => { loadModels(); loadSettings() })

  return { models, settings, loading, loadModels, loadSettings, saveSettings, testConnection }
}

export function useWindow() {
  const trae = getTrae()
  return {
    minimize: () => trae?.window?.minimize?.(),
    maximize: () => trae?.window?.maximize?.(),
    close: () => trae?.window?.close?.(),
    getState: () => trae?.window?.getState?.() || Promise.resolve({ isMaximized: false })
  }
}
