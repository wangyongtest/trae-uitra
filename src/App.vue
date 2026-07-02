<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useChatStore } from '@/stores/chat'
import MainLayout from '@/components/layout/MainLayout.vue'
import Spinner from '@/components/common/Spinner.vue'

const router = useRouter()
const chatStore = useChatStore()

const kernelReady = ref(false)
const kernelError = ref<string | null>(null)
let offReady: (() => void) | null = null
let offError: (() => void) | null = null

const handleKeydown = (e: KeyboardEvent) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
    e.preventDefault()
    chatStore.createSession()
    router.push('/chat')
  }
  if ((e.ctrlKey || e.metaKey) && e.key === ',') {
    e.preventDefault()
    router.push('/settings')
  }
}

onMounted(() => {
  window.addEventListener('keydown', handleKeydown)

  const trae = (window as any).trae?.ultra
  if (trae?.system) {
    offReady = trae.system.onKernelReady(() => {
      kernelReady.value = true
      kernelError.value = null
    })
    offError = trae.system.onKernelError((err: any) => {
      kernelError.value = err?.message || 'Kernel连接失败'
    })
    trae.system.ping?.().then(() => {
      kernelReady.value = true
    }).catch(() => {})
  } else {
    kernelReady.value = true
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeydown)
  offReady?.()
  offError?.()
})
</script>

<template>
  <div v-if="!kernelReady" class="fixed inset-0 bg-dark-950 flex flex-col items-center justify-center">
    <div class="text-4xl font-bold text-primary-500 mb-6">TRAE Ultra</div>
    <Spinner size="lg" />
    <p class="mt-4 text-dark-400">正在启动Kernel...</p>
    <p v-if="kernelError" class="mt-2 text-red-400 text-sm">{{ kernelError }}</p>
    <p v-if="!kernelError && !window.trae" class="mt-2 text-dark-500 text-xs">开发模式：Kernel未连接，使用Mock数据</p>
  </div>
  <MainLayout v-else />
</template>
