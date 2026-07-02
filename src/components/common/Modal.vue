<script setup lang="ts">
import { watch, onMounted, onUnmounted } from 'vue'
import Button from './Button.vue'

interface Props {
  show: boolean
  title?: string
  width?: string
  closable?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  width: '480px',
  closable: true
})

const emit = defineEmits<{
  close: []
  'update:show': [value: boolean]
}>()

// 关闭模态框
const handleClose = () => {
  if (props.closable) {
    emit('update:show', false)
    emit('close')
  }
}

// 点击遮罩关闭
const handleOverlayClick = (e: MouseEvent) => {
  if (e.target === e.currentTarget) {
    handleClose()
  }
}

// ESC键关闭
const handleKeydown = (e: KeyboardEvent) => {
  if (e.key === 'Escape' && props.show && props.closable) {
    handleClose()
  }
}

// 禁止背景滚动
watch(() => props.show, (show) => {
  if (show) {
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = ''
  }
})

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="show"
        class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        @click="handleOverlayClick"
      >
        <div
          class="bg-dark-800 rounded-xl shadow-2xl border border-dark-700 flex flex-col max-h-[90vh] animate-slide-up"
          :style="{ width }"
        >
          <!-- 头部 -->
          <div class="flex items-center justify-between px-5 py-4 border-b border-dark-700">
            <slot name="header">
              <h3 class="text-lg font-semibold text-dark-100">{{ title }}</h3>
            </slot>
            <button
              v-if="closable"
              class="p-1 rounded-lg hover:bg-dark-700 text-dark-400 hover:text-dark-200 transition-colors titlebar-no-drag"
              @click="handleClose"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- 内容 -->
          <div class="px-5 py-4 overflow-y-auto custom-scrollbar flex-1">
            <slot />
          </div>

          <!-- 底部 -->
          <div v-if="$slots.footer" class="px-5 py-4 border-t border-dark-700 flex justify-end gap-3">
            <slot name="footer" />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
