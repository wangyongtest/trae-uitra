<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useSettingsStore } from '@/stores/settings'
import Button from '@/components/common/Button.vue'
import Spinner from '@/components/common/Spinner.vue'

const settingsStore = useSettingsStore()

// 本地编辑状态
const formData = reactive({
  apiKeys: {
    deepseek: '',
    doubao: ''
  },
  defaultModel: 'deepseek-chat',
  dailyBudget: 1.0,
  fontSize: 14
})

// API Key可见性
const keyVisibility = reactive({
  deepseek: false,
  doubao: false
})

// 测试连接状态
const testingConnection = reactive({
  deepseek: false,
  doubao: false
})

const testResults = reactive<Record<string, { success: boolean; message?: string } | null>>({
  deepseek: null,
  doubao: null
})

// 保存状态
const saving = ref(false)
const saved = ref(false)

// 可用模型
const models = [
  { id: 'deepseek-chat', name: 'DeepSeek V3' },
  { id: 'doubao-pro', name: '豆包 Pro' }
]

// 版本号
const version = '0.1.0'

// 切换API Key可见性
const toggleKeyVisibility = (provider: 'deepseek' | 'doubao') => {
  keyVisibility[provider] = !keyVisibility[provider]
}

// 测试连接
const testConnection = async (provider: 'deepseek' | 'doubao') => {
  const apiKey = formData.apiKeys[provider]
  if (!apiKey) {
    testResults[provider] = { success: false, message: '请先输入API Key' }
    return
  }

  testingConnection[provider] = true
  testResults[provider] = null

  try {
    const trae = (window as any).trae?.ultra
    if (trae?.config?.testConnection) {
      testResults[provider] = await trae.config.testConnection(provider, apiKey)
    } else {
      // 开发模式模拟
      await new Promise(resolve => setTimeout(resolve, 1000))
      testResults[provider] = {
        success: apiKey.length > 10,
        message: apiKey.length > 10 ? '连接成功' : 'API Key格式不正确'
      }
    }
  } catch (error) {
    testResults[provider] = {
      success: false,
      message: (error as Error).message || '连接失败'
    }
  } finally {
    testingConnection[provider] = false
  }
}

// 保存设置
const saveSettings = async () => {
  saving.value = true
  saved.value = false

  try {
    // 更新store
    settingsStore.setAPIKey('deepseek', formData.apiKeys.deepseek)
    settingsStore.setAPIKey('doubao', formData.apiKeys.doubao)
    settingsStore.setDefaultModel(formData.defaultModel)
    settingsStore.setDailyBudget(formData.dailyBudget)
    settingsStore.setFontSize(formData.fontSize)

    // 调用IPC保存
    const trae = (window as any).trae?.ultra
    if (trae?.config?.saveSettings) {
      await trae.config.saveSettings(settingsStore.settings)
    }

    saved.value = true
    setTimeout(() => {
      saved.value = false
    }, 2000)
  } catch (error) {
    console.error('保存设置失败:', error)
  } finally {
    saving.value = false
  }
}

// 加载设置到表单
const loadFormData = () => {
  formData.apiKeys.deepseek = settingsStore.settings.apiKeys.deepseek || ''
  formData.apiKeys.doubao = settingsStore.settings.apiKeys.doubao || ''
  formData.defaultModel = settingsStore.settings.defaultModel
  formData.dailyBudget = settingsStore.settings.budget.daily
  formData.fontSize = settingsStore.settings.fontSize
}

onMounted(() => {
  loadFormData()
})
</script>

<template>
  <div class="h-full overflow-y-auto custom-scrollbar p-6">
    <div class="max-w-2xl mx-auto space-y-8">
      <!-- 页面标题 -->
      <div>
        <h1 class="text-2xl font-bold text-dark-100">设置</h1>
        <p class="text-dark-400 mt-1">配置API密钥、模型偏好和应用设置</p>
      </div>

      <!-- API Key配置 -->
      <section class="bg-dark-800 rounded-xl border border-dark-700 p-6">
        <h2 class="text-lg font-semibold text-dark-100 mb-4">API Key 配置</h2>

        <!-- DeepSeek -->
        <div class="mb-6">
          <label class="block text-sm font-medium text-dark-300 mb-2">DeepSeek API Key</label>
          <div class="flex gap-2">
            <div class="flex-1 relative">
              <input
                v-model="formData.apiKeys.deepseek"
                :type="keyVisibility.deepseek ? 'text' : 'password'"
                class="w-full px-3 py-2 pr-10 bg-dark-900 border border-dark-700 rounded-lg text-dark-100 placeholder-dark-500 focus:outline-none focus:border-primary-500"
                placeholder="sk-xxxxxxxxxxxxxxxx"
              />
              <button
                class="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-dark-400 hover:text-dark-200"
                @click="toggleKeyVisibility('deepseek')"
              >
                <svg v-if="!keyVisibility.deepseek" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              </button>
            </div>
            <Button
              variant="secondary"
              :loading="testingConnection.deepseek"
              :disabled="!formData.apiKeys.deepseek"
              @click="testConnection('deepseek')"
            >
              测试连接
            </Button>
          </div>
          <div v-if="testResults.deepseek" class="mt-2 text-sm" :class="testResults.deepseek.success ? 'text-green-400' : 'text-red-400'">
            {{ testResults.deepseek.message }}
          </div>
        </div>

        <!-- 豆包 -->
        <div>
          <label class="block text-sm font-medium text-dark-300 mb-2">豆包 API Key</label>
          <div class="flex gap-2">
            <div class="flex-1 relative">
              <input
                v-model="formData.apiKeys.doubao"
                :type="keyVisibility.doubao ? 'text' : 'password'"
                class="w-full px-3 py-2 pr-10 bg-dark-900 border border-dark-700 rounded-lg text-dark-100 placeholder-dark-500 focus:outline-none focus:border-primary-500"
                placeholder="xxxxxxxxxxxxxxxx"
              />
              <button
                class="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-dark-400 hover:text-dark-200"
                @click="toggleKeyVisibility('doubao')"
              >
                <svg v-if="!keyVisibility.doubao" class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                <svg v-else class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                </svg>
              </button>
            </div>
            <Button
              variant="secondary"
              :loading="testingConnection.doubao"
              :disabled="!formData.apiKeys.doubao"
              @click="testConnection('doubao')"
            >
              测试连接
            </Button>
          </div>
          <div v-if="testResults.doubao" class="mt-2 text-sm" :class="testResults.doubao.success ? 'text-green-400' : 'text-red-400'">
            {{ testResults.doubao.message }}
          </div>
        </div>
      </section>

      <!-- 模型设置 -->
      <section class="bg-dark-800 rounded-xl border border-dark-700 p-6">
        <h2 class="text-lg font-semibold text-dark-100 mb-4">模型设置</h2>

        <div class="mb-6">
          <label class="block text-sm font-medium text-dark-300 mb-2">默认模型</label>
          <select
            v-model="formData.defaultModel"
            class="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-dark-100 focus:outline-none focus:border-primary-500 cursor-pointer"
          >
            <option v-for="model in models" :key="model.id" :value="model.id">
              {{ model.name }}
            </option>
          </select>
        </div>

        <div>
          <label class="block text-sm font-medium text-dark-300 mb-2">
            日预算 (美元)
          </label>
          <div class="flex items-center gap-3">
            <span class="text-dark-400">$</span>
            <input
              v-model.number="formData.dailyBudget"
              type="number"
              min="0"
              step="0.1"
              class="w-32 px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-dark-100 focus:outline-none focus:border-primary-500"
            />
            <span class="text-sm text-dark-500">每天最多消耗金额</span>
          </div>
        </div>
      </section>

      <!-- 外观设置 -->
      <section class="bg-dark-800 rounded-xl border border-dark-700 p-6">
        <h2 class="text-lg font-semibold text-dark-100 mb-4">外观设置</h2>

        <div>
          <label class="block text-sm font-medium text-dark-300 mb-2">
            字体大小: {{ formData.fontSize }}px
          </label>
          <input
            v-model.number="formData.fontSize"
            type="range"
            min="12"
            max="20"
            step="1"
            class="w-full h-2 bg-dark-700 rounded-lg appearance-none cursor-pointer accent-primary-500"
          />
          <div class="flex justify-between text-xs text-dark-500 mt-1">
            <span>12px</span>
            <span>16px</span>
            <span>20px</span>
          </div>
        </div>
      </section>

      <!-- 关于 -->
      <section class="bg-dark-800 rounded-xl border border-dark-700 p-6">
        <h2 class="text-lg font-semibold text-dark-100 mb-4">关于</h2>
        <div class="space-y-2 text-sm">
          <div class="flex justify-between">
            <span class="text-dark-400">版本</span>
            <span class="text-dark-200">v{{ version }}</span>
          </div>
          <div class="flex justify-between">
            <span class="text-dark-400">TRAE Ultra</span>
            <span class="text-dark-200">AI Native Workspace</span>
          </div>
        </div>
      </section>

      <!-- 保存按钮 -->
      <div class="flex justify-end gap-3">
        <Button variant="ghost" @click="loadFormData">重置</Button>
        <Button :loading="saving" @click="saveSettings">
          <svg v-if="saved" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          {{ saved ? '已保存' : '保存设置' }}
        </Button>
      </div>
    </div>
  </div>
</template>
