import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import type { Settings, APIKeys, Theme, Language } from '@/types'

// 本地存储键名
const STORAGE_KEY = 'trae-settings'

// 默认设置
const defaultSettings: Settings = {
  apiKeys: {},
  defaultModel: 'deepseek-chat',
  theme: 'dark',
  budget: {
    daily: 1.0,
    monthly: 20.0
  },
  fontSize: 14,
  language: 'zh-CN'
}

export const useSettingsStore = defineStore('settings', () => {
  // ==========================================
  // State
  // ==========================================
  const settings = ref<Settings>({ ...defaultSettings })

  // ==========================================
  // 本地存储持久化
  // ==========================================
  const loadSettings = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        settings.value = { ...defaultSettings, ...parsed }
      }
    } catch (e) {
      console.error('加载设置失败:', e)
      settings.value = { ...defaultSettings }
    }
  }

  const saveSettings = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings.value))
      // 应用设置
      applySettings()
    } catch (e) {
      console.error('保存设置失败:', e)
    }
  }

  // 监听设置变化自动保存
  watch(settings, saveSettings, { deep: true })

  // ==========================================
  // Actions
  // ==========================================

  /**
   * 应用设置到DOM
   */
  const applySettings = () => {
    // 应用主题
    const html = document.documentElement
    if (settings.value.theme === 'dark') {
      html.classList.add('dark')
    } else if (settings.value.theme === 'light') {
      html.classList.remove('dark')
    } else {
      // system
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        html.classList.add('dark')
      } else {
        html.classList.remove('dark')
      }
    }

    // 应用字体大小
    document.documentElement.style.fontSize = `${settings.value.fontSize}px`
  }

  /**
   * 设置API Key
   */
  const setAPIKey = (provider: string, key: string) => {
    settings.value.apiKeys[provider] = key
  }

  /**
   * 设置默认模型
   */
  const setDefaultModel = (modelId: string) => {
    settings.value.defaultModel = modelId
  }

  /**
   * 设置日预算
   */
  const setDailyBudget = (budget: number) => {
    settings.value.budget.daily = budget
  }

  /**
   * 设置月预算
   */
  const setMonthlyBudget = (budget: number) => {
    settings.value.budget.monthly = budget
  }

  /**
   * 设置主题
   */
  const setTheme = (theme: Theme) => {
    settings.value.theme = theme
  }

  /**
   * 设置字体大小
   */
  const setFontSize = (size: number) => {
    settings.value.fontSize = size
  }

  /**
   * 设置语言
   */
  const setLanguage = (language: Language) => {
    settings.value.language = language
  }

  /**
   * 重置设置为默认值
   */
  const resetSettings = () => {
    settings.value = { ...defaultSettings }
  }

  // ==========================================
  // 初始化
  // ==========================================
  loadSettings()
  applySettings()

  return {
    // State
    settings,
    // Actions
    loadSettings,
    saveSettings,
    setAPIKey,
    setDefaultModel,
    setDailyBudget,
    setMonthlyBudget,
    setTheme,
    setFontSize,
    setLanguage,
    resetSettings
  }
})
