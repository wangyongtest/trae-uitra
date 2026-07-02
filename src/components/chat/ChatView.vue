<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { useChatStore } from '@/stores/chat'
import { useSettingsStore } from '@/stores/settings'
import MessageItem from './MessageItem.vue'
import MessageInput from './MessageInput.vue'
import Button from '@/components/common/Button.vue'

const route = useRoute()
const chatStore = useChatStore()
const settingsStore = useSettingsStore()

const messageInputRef = ref<InstanceType<typeof MessageInput> | null>(null)
const messagesContainerRef = ref<HTMLDivElement | null>(null)

// 输入内容
const inputValue = ref('')

// 当前选中的模型
const selectedModel = ref(settingsStore.settings.defaultModel)

// 可用模型列表
const models = [
  { id: 'deepseek-chat', name: 'DeepSeek V3' },
  { id: 'doubao-pro', name: '豆包 Pro' }
]

// 当前会话
const currentSession = computed(() => chatStore.activeSession)

// 消息列表
const messages = computed(() => currentSession.value?.messages || [])

// 是否显示空状态
const showEmptyState = computed(() => messages.value.length === 0 && !chatStore.isStreaming)

// 监听路由变化，切换会话
watch(() => route.params.sessionId, (sessionId) => {
  if (sessionId && typeof sessionId === 'string') {
    chatStore.selectSession(sessionId)
  } else if (chatStore.sessions.length > 0) {
    // 如果没有sessionId，选择第一个会话
    chatStore.selectSession(chatStore.sessions[0].id)
  } else {
    chatStore.createSession()
  }
}, { immediate: true })

// 滚动到底部
const scrollToBottom = async (smooth = true) => {
  await nextTick()
  const container = messagesContainerRef.value
  if (container) {
    container.scrollTo({
      top: container.scrollHeight,
      behavior: smooth ? 'smooth' : 'auto'
    })
  }
}

// 监听消息变化，自动滚动
watch(messages, () => {
  scrollToBottom()
}, { deep: true })

// 监听流式状态变化，聚焦输入框
watch(() => chatStore.isStreaming, (streaming) => {
  if (!streaming) {
    messageInputRef.value?.focus()
  }
})

// 发送消息
const handleSend = () => {
  if (!inputValue.value.trim()) return
  chatStore.sendMessage(inputValue.value, selectedModel.value)
  inputValue.value = ''
  scrollToBottom()
}

// 停止生成
const handleAbort = () => {
  chatStore.abortStream()
}

// 快速开始
const quickPrompts = [
  { title: '解释代码', desc: '帮我解释这段代码的工作原理', icon: '💻' },
  { title: '写文档', desc: '为我的项目生成README文档', icon: '📝' },
  { title: '调试问题', desc: '帮我排查和修复bug', icon: '🔍' },
  { title: '学习概念', desc: '解释一个技术概念', icon: '📚' }
]

const handleQuickPrompt = (prompt: string) => {
  inputValue.value = prompt
  handleSend()
}

onMounted(() => {
  scrollToBottom(false)
  messageInputRef.value?.focus()
})
</script>

<template>
  <div class="flex flex-col h-full">
    <!-- 工具栏 -->
    <div class="h-12 border-b border-dark-800 bg-dark-900/50 flex items-center justify-between px-4">
      <div class="flex items-center gap-3">
        <!-- 模型选择 -->
        <div class="relative">
          <select
            v-model="selectedModel"
            class="appearance-none bg-dark-800 border border-dark-700 text-dark-200 text-sm rounded-lg px-3 py-1.5 pr-8 focus:outline-none focus:border-primary-500 cursor-pointer"
          >
            <option v-for="model in models" :key="model.id" :value="model.id">
              {{ model.name }}
            </option>
          </select>
          <svg class="w-4 h-4 text-dark-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>

      <div class="flex items-center gap-2">
        <!-- 会话标题 -->
        <span class="text-sm text-dark-400">{{ currentSession?.title || '新对话' }}</span>
      </div>
    </div>

    <!-- 消息列表区域 -->
    <div ref="messagesContainerRef" class="flex-1 overflow-y-auto custom-scrollbar">
      <!-- 空状态 -->
      <div v-if="showEmptyState" class="h-full flex flex-col items-center justify-center px-4">
        <div class="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center mb-6">
          <svg class="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h1 class="text-2xl font-bold text-dark-100 mb-2">TRAE Ultra</h1>
        <p class="text-dark-400 mb-8 text-center max-w-md">
          AI原生工作空间，具备缓存优先架构，让你的每一次对话都更高效、更经济。
        </p>

        <!-- 快捷操作 -->
        <div class="grid grid-cols-2 gap-3 w-full max-w-lg">
          <button
            v-for="prompt in quickPrompts"
            :key="prompt.title"
            class="p-4 bg-dark-800 hover:bg-dark-700 rounded-xl text-left transition-colors border border-dark-700 hover:border-dark-600"
            @click="handleQuickPrompt(prompt.desc)"
          >
            <div class="text-xl mb-2">{{ prompt.icon }}</div>
            <div class="text-sm font-medium text-dark-200 mb-1">{{ prompt.title }}</div>
            <div class="text-xs text-dark-500">{{ prompt.desc }}</div>
          </button>
        </div>
      </div>

      <!-- 消息列表 -->
      <div v-else class="max-w-4xl mx-auto py-4">
        <MessageItem
          v-for="(message, index) in messages"
          :key="message.id"
          :message="message"
          :is-streaming="chatStore.isStreaming && index === messages.length - 1 && message.role === 'assistant'"
        />
      </div>
    </div>

    <!-- 输入框 -->
    <MessageInput
      ref="messageInputRef"
      v-model="inputValue"
      :is-streaming="chatStore.isStreaming"
      @send="handleSend"
      @abort="handleAbort"
    />
  </div>
</template>
