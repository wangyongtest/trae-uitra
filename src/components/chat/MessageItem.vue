<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Message } from '@/types'
import { useMarkdown } from '@/composables/useMarkdown'
import ToolCallItem from './ToolCallItem.vue'

interface Props {
  message: Message
  isStreaming?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isStreaming: false
})

const emit = defineEmits<{
  copy: []
  regenerate: []
}>()

const { render } = useMarkdown()

// 悬停状态
const isHovered = ref(false)

// 是否已复制
const copied = ref(false)

// 渲染后的HTML内容
const renderedContent = computed(() => render(props.message.content))

// 是否是用户消息
const isUser = computed(() => props.message.role === 'user')

// 格式化时间
const formatTime = (timestamp: number) => {
  return new Date(timestamp).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

// 格式化耗时
const formatDuration = (ms?: number) => {
  if (!ms) return ''
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

// 复制消息内容
const copyContent = async () => {
  try {
    await navigator.clipboard.writeText(props.message.content)
    copied.value = true
    setTimeout(() => {
      copied.value = false
    }, 2000)
    emit('copy')
  } catch (e) {
    console.error('复制失败:', e)
  }
}

// 重新生成
const handleRegenerate = () => {
  emit('regenerate')
}
</script>

<template>
  <div
    class="flex gap-3 px-4 py-4 animate-fade-in group"
    :class="isUser ? 'flex-row-reverse' : 'flex-row'"
    @mouseenter="isHovered = true"
    @mouseleave="isHovered = false"
  >
    <!-- 头像 -->
    <div class="flex-shrink-0">
      <div
        v-if="isUser"
        class="w-8 h-8 rounded-full bg-primary-600 flex items-center justify-center"
      >
        <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      </div>
      <div
        v-else
        class="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center"
      >
        <svg class="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
        </svg>
      </div>
    </div>

    <!-- 消息内容 -->
    <div class="flex-1 min-w-0 max-w-[80%]">
      <!-- 消息头部 -->
      <div
        class="flex items-center gap-2 mb-1"
        :class="isUser ? 'flex-row-reverse' : 'flex-row'"
      >
        <span class="text-sm font-medium text-dark-200">
          {{ isUser ? '你' : 'TRAE Ultra' }}
        </span>
        <span class="text-xs text-dark-500">{{ formatTime(message.timestamp) }}</span>
      </div>

      <!-- 消息气泡 -->
      <div
        class="rounded-2xl px-4 py-3 relative"
        :class="isUser ? 'bg-primary-600 text-white rounded-tr-sm' : 'bg-dark-800 text-dark-100 rounded-tl-sm'"
      >
        <!-- 工具调用列表 -->
        <div v-if="message.toolCalls && message.toolCalls.length > 0" class="mb-2">
          <ToolCallItem
            v-for="toolCall in message.toolCalls"
            :key="toolCall.id"
            :tool-call="toolCall"
          />
        </div>

        <!-- Markdown内容 -->
        <div
          v-if="message.content"
          class="prose prose-invert max-w-none"
          :class="isUser ? 'prose-pre:bg-primary-700 prose-code:text-primary-100' : ''"
          v-html="renderedContent"
        ></div>

        <!-- 流式加载指示器 -->
        <div v-if="isStreaming && !message.content && (!message.toolCalls || message.toolCalls.length === 0)" class="flex gap-1">
          <span class="w-2 h-2 bg-dark-400 rounded-full animate-bounce" style="animation-delay: 0ms"></span>
          <span class="w-2 h-2 bg-dark-400 rounded-full animate-bounce" style="animation-delay: 150ms"></span>
          <span class="w-2 h-2 bg-dark-400 rounded-full animate-bounce" style="animation-delay: 300ms"></span>
        </div>

        <!-- 操作按钮（悬停显示） -->
        <div
          v-if="!isStreaming"
          class="absolute -bottom-3 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1"
          :class="isUser ? 'left-2' : 'right-2'"
        >
          <!-- 复制按钮 -->
          <button
            class="p-1.5 bg-dark-700 hover:bg-dark-600 rounded-lg text-dark-400 hover:text-dark-200 transition-colors"
            :title="copied ? '已复制' : '复制'"
            @click="copyContent"
          >
            <svg v-if="!copied" class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
            <svg v-else class="w-3.5 h-3.5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
            </svg>
          </button>

          <!-- 重新生成按钮（仅助手消息） -->
          <button
            v-if="!isUser"
            class="p-1.5 bg-dark-700 hover:bg-dark-600 rounded-lg text-dark-400 hover:text-dark-200 transition-colors"
            title="重新生成"
            @click="handleRegenerate"
          >
            <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
        </div>
      </div>

      <!-- 消息元信息（Token计数、耗时） -->
      <div
        v-if="!isUser && (message.usage || message.duration)"
        class="flex items-center gap-3 mt-1.5 text-xs text-dark-500"
        :class="isUser ? 'flex-row-reverse' : 'flex-row'"
      >
        <span v-if="message.duration">{{ formatDuration(message.duration) }}</span>
        <span v-if="message.usage?.totalTokens">
          {{ message.usage.promptTokens }} in / {{ message.usage.completionTokens }} out
          <span v-if="message.usage.cachedTokens" class="text-green-500">
            ({{ message.usage.cachedTokens }} cached)
          </span>
        </span>
      </div>
    </div>
  </div>
</template>
