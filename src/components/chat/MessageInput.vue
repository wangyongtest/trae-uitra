<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue'

interface Props {
  modelValue: string
  disabled?: boolean
  isStreaming?: boolean
  placeholder?: string
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  isStreaming: false,
  placeholder: '输入消息... (Enter发送, Shift+Enter换行)'
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  send: []
  abort: []
}>()

const textareaRef = ref<HTMLTextAreaElement | null>(null)

// 内部值
const inputValue = computed({
  get: () => props.modelValue,
  set: (val: string) => emit('update:modelValue', val)
})

// 自动调整高度
const adjustHeight = () => {
  const textarea = textareaRef.value
  if (textarea) {
    textarea.style.height = 'auto'
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px'
  }
}

// 监听值变化调整高度
watch(inputValue, adjustHeight, { immediate: true })

// 键盘事件处理
const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    handleSend()
  }
  // Ctrl+L 清屏
  if ((e.ctrlKey || e.metaKey) && e.key === 'l') {
    e.preventDefault()
    inputValue.value = ''
  }
}

// 发送消息
const handleSend = () => {
  if (inputValue.value.trim() && !props.disabled && !props.isStreaming) {
    emit('send')
    // 发送后重置高度
    setTimeout(() => {
      if (textareaRef.value) {
        textareaRef.value.style.height = 'auto'
      }
    }, 0)
  }
}

// 停止生成
const handleAbort = () => {
  emit('abort')
}

// 聚焦输入框
const focus = () => {
  textareaRef.value?.focus()
}

onMounted(() => {
  adjustHeight()
})

defineExpose({ focus })
</script>

<template>
  <div class="border-t border-dark-800 bg-dark-900 p-4">
    <div class="max-w-4xl mx-auto">
      <!-- 输入框容器 -->
      <div
        class="relative flex items-end bg-dark-800 rounded-xl border border-dark-700 focus-within:border-primary-500 transition-colors"
      >
        <!-- 附件按钮（预留） -->
        <button
          class="p-3 text-dark-400 hover:text-dark-200 transition-colors flex-shrink-0"
          title="添加附件"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
          </svg>
        </button>

        <!-- 文本输入区 -->
        <textarea
          ref="textareaRef"
          v-model="inputValue"
          :disabled="disabled"
          :placeholder="placeholder"
          rows="1"
          class="flex-1 bg-transparent py-3 text-dark-100 placeholder-dark-500 resize-none focus:outline-none text-sm leading-6 max-h-[200px]"
          @keydown="handleKeydown"
        ></textarea>

        <!-- 发送/停止按钮 -->
        <div class="p-2 flex-shrink-0">
          <!-- 停止按钮（流式时显示） -->
          <button
            v-if="isStreaming"
            class="p-2 bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors"
            title="停止生成"
            @click="handleAbort"
          >
            <svg class="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
              <rect x="6" y="6" width="12" height="12" rx="1" />
            </svg>
          </button>

          <!-- 发送按钮 -->
          <button
            v-else
            class="p-2 rounded-lg transition-colors"
            :class="inputValue.trim() && !disabled
              ? 'bg-primary-600 hover:bg-primary-500 text-white'
              : 'bg-dark-700 text-dark-500 cursor-not-allowed'"
            :disabled="!inputValue.trim() || disabled"
            title="发送"
            @click="handleSend"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>

      <!-- 输入状态提示 -->
      <div v-if="isStreaming" class="mt-2 flex items-center gap-2 text-xs text-dark-400">
        <span class="inline-block w-1.5 h-1.5 bg-primary-500 rounded-full animate-pulse"></span>
        正在思考...
      </div>

      <!-- 快捷键提示 -->
      <div v-else class="mt-2 text-xs text-dark-500 text-center">
        Enter 发送 · Shift+Enter 换行 · Ctrl+L 清空
      </div>
    </div>
  </div>
</template>
