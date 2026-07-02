<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useWindow } from '@/composables/useIPC'

const { minimize, maximize, close } = useWindow()

// 是否最大化状态
const isMaximized = ref(false)

// 窗口控制操作
const handleMinimize = () => minimize()
const handleMaximize = () => maximize()
const handleClose = () => close()

onMounted(() => {
  // 监听窗口状态变化（开发模式下不实际调用）
})
</script>

<template>
  <div class="h-10 flex items-center justify-between bg-dark-900 border-b border-dark-800 select-none titlebar-drag">
    <!-- 左侧Logo和应用名 -->
    <div class="flex items-center h-full px-4 titlebar-no-drag">
      <div class="flex items-center gap-2">
        <!-- Logo图标 -->
        <div class="w-6 h-6 rounded-lg bg-gradient-to-br from-primary-500 to-primary-700 flex items-center justify-center">
          <svg class="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <span class="text-sm font-semibold text-dark-100">TRAE Ultra</span>
      </div>
    </div>

    <!-- 中间拖拽区域 -->
    <div class="flex-1 h-full"></div>

    <!-- 右侧窗口控制按钮 -->
    <div class="flex items-center h-full titlebar-no-drag">
      <!-- 最小化 -->
      <button
        class="w-12 h-full flex items-center justify-center text-dark-400 hover:bg-dark-700 hover:text-dark-200 transition-colors"
        title="最小化"
        @click="handleMinimize"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20 12H4" />
        </svg>
      </button>

      <!-- 最大化/还原 -->
      <button
        class="w-12 h-full flex items-center justify-center text-dark-400 hover:bg-dark-700 hover:text-dark-200 transition-colors"
        :title="isMaximized ? '还原' : '最大化'"
        @click="handleMaximize"
      >
        <svg v-if="!isMaximized" class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <rect x="4" y="4" width="16" height="16" rx="1" stroke-width="2" />
        </svg>
        <svg v-else class="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 8h12V4H4v4zm0 0v12h12v-4M4 8l8 8" />
        </svg>
      </button>

      <!-- 关闭 -->
      <button
        class="w-12 h-full flex items-center justify-center text-dark-400 hover:bg-red-600 hover:text-white transition-colors"
        title="关闭"
        @click="handleClose"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>
  </div>
</template>
