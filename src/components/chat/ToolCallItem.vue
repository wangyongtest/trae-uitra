<script setup lang="ts">
import { ref, computed } from 'vue'
import type { ToolCall } from '@/types'
import Spinner from '@/components/common/Spinner.vue'

interface Props {
  toolCall: ToolCall
}

const props = defineProps<Props>()

// 是否展开
const expanded = ref(false)

// 状态图标
const statusConfig = computed(() => {
  switch (props.toolCall.status) {
    case 'pending':
    case 'running':
      return { color: 'text-yellow-500', bgColor: 'bg-yellow-500/10', label: '执行中' }
    case 'success':
      return { color: 'text-green-500', bgColor: 'bg-green-500/10', label: '成功' }
    case 'error':
      return { color: 'text-red-500', bgColor: 'bg-red-500/10', label: '失败' }
    default:
      return { color: 'text-dark-400', bgColor: 'bg-dark-700', label: '未知' }
  }
})

// 格式化JSON
const formatJSON = (str: string) => {
  try {
    const parsed = JSON.parse(str)
    return JSON.stringify(parsed, null, 2)
  } catch {
    return str
  }
}

// 格式化耗时
const formatDuration = (ms?: number) => {
  if (!ms) return ''
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(2)}s`
}

// 切换展开状态
const toggleExpanded = () => {
  expanded.value = !expanded.value
}
</script>

<template>
  <div class="my-2 rounded-lg border border-dark-700 bg-dark-800/50 overflow-hidden">
    <!-- 工具调用头部（可点击展开/折叠） -->
    <button
      class="w-full flex items-center gap-2 px-3 py-2 hover:bg-dark-700/50 transition-colors text-left"
      @click="toggleExpanded"
    >
      <!-- 状态图标 -->
      <div class="flex-shrink-0" :class="statusConfig.color">
        <Spinner v-if="toolCall.status === 'running' || toolCall.status === 'pending'" size="sm" />
        <svg v-else-if="toolCall.status === 'success'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
        </svg>
        <svg v-else-if="toolCall.status === 'error'" class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </div>

      <!-- 工具名称 -->
      <span class="text-sm font-medium text-dark-200 flex-1">{{ toolCall.name }}</span>

      <!-- 状态标签和耗时 -->
      <div class="flex items-center gap-2">
        <span
          class="text-xs px-2 py-0.5 rounded-full"
          :class="[statusConfig.color, statusConfig.bgColor]"
        >
          {{ statusConfig.label }}
        </span>
        <span v-if="toolCall.duration" class="text-xs text-dark-500">{{ formatDuration(toolCall.duration) }}</span>

        <!-- 展开/折叠箭头 -->
        <svg
          class="w-4 h-4 text-dark-400 transition-transform duration-200"
          :class="expanded ? 'rotate-180' : ''"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
        </svg>
      </div>
    </button>

    <!-- 展开内容 -->
    <div v-if="expanded" class="border-t border-dark-700">
      <!-- 参数 -->
      <div class="px-3 py-2">
        <div class="text-xs text-dark-500 mb-1">参数</div>
        <pre class="text-xs bg-dark-900 p-2 rounded overflow-x-auto custom-scrollbar"><code class="text-dark-300">{{ formatJSON(toolCall.arguments) }}</code></pre>
      </div>

      <!-- 结果 -->
      <div v-if="toolCall.result" class="px-3 py-2 border-t border-dark-700">
        <div class="text-xs text-dark-500 mb-1">结果</div>
        <pre class="text-xs bg-dark-900 p-2 rounded overflow-x-auto custom-scrollbar"><code class="text-dark-300">{{ formatJSON(toolCall.result) }}</code></pre>
      </div>
    </div>
  </div>
</template>
