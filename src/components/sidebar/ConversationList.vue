<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import dayjs from 'dayjs'
import { useChatStore } from '@/stores/chat'
import Button from '@/components/common/Button.vue'
import Modal from '@/components/common/Modal.vue'

const router = useRouter()
const route = useRoute()
const chatStore = useChatStore()

// 右键菜单状态
const contextMenuVisible = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })
const contextMenuSessionId = ref<string | null>(null)

// 重命名模态框
const renameModalVisible = ref(false)
const renameInput = ref('')

// 当前活跃的会话ID（从路由获取）
const activeSessionId = computed(() => route.params.sessionId as string | undefined)

// 格式化时间
const formatTime = (timestamp: number) => {
  const now = dayjs()
  const date = dayjs(timestamp)
  if (date.isSame(now, 'day')) {
    return date.format('HH:mm')
  } else if (date.isSame(now.subtract(1, 'day'), 'day')) {
    return '昨天'
  } else if (date.isSame(now, 'week')) {
    return date.format('dddd')
  } else {
    return date.format('MM/DD')
  }
}

// 获取消息预览
const getMessagePreview = (session: any) => {
  const lastMessage = session.messages[session.messages.length - 1]
  if (!lastMessage) return '开始新对话'
  const content = lastMessage.content.replace(/[#*`_~\[\]]/g, '').slice(0, 40)
  return content + (lastMessage.content.length > 40 ? '...' : '')
}

// 新建对话
const handleNewChat = () => {
  const session = chatStore.createSession()
  router.push(`/chat/${session.id}`)
}

// 选择会话
const handleSelectSession = (sessionId: string) => {
  chatStore.selectSession(sessionId)
  router.push(`/chat/${sessionId}`)
}

// 显示右键菜单
const handleContextMenu = (e: MouseEvent, sessionId: string) => {
  e.preventDefault()
  e.stopPropagation()
  contextMenuSessionId.value = sessionId
  contextMenuPosition.value = { x: e.clientX, y: e.clientY }
  contextMenuVisible.value = true
}

// 关闭右键菜单
const closeContextMenu = () => {
  contextMenuVisible.value = false
  contextMenuSessionId.value = null
}

// 重命名会话
const handleRename = () => {
  if (contextMenuSessionId.value) {
    const session = chatStore.sessions.find(s => s.id === contextMenuSessionId.value)
    if (session) {
      renameInput.value = session.title
      renameModalVisible.value = true
    }
  }
  closeContextMenu()
}

// 确认重命名
const confirmRename = () => {
  if (contextMenuSessionId.value && renameInput.value.trim()) {
    chatStore.renameSession(contextMenuSessionId.value, renameInput.value.trim())
  }
  renameModalVisible.value = false
  renameInput.value = ''
}

// 删除会话
const handleDelete = () => {
  if (contextMenuSessionId.value) {
    chatStore.deleteSession(contextMenuSessionId.value)
    // 如果删除后还有会话，跳转到第一个
    if (chatStore.sessions.length > 0) {
      router.push(`/chat/${chatStore.sessions[0].id}`)
    } else {
      router.push('/chat')
    }
  }
  closeContextMenu()
}

// 导航到不同页面
const navigateTo = (path: string) => {
  router.push(path)
}

// 判断当前路由
const isActive = (path: string) => {
  return route.path.startsWith(path)
}
</script>

<template>
  <div class="flex flex-col h-full" @click="closeContextMenu">
    <!-- 新建对话按钮 -->
    <div class="p-3">
      <Button variant="secondary" class="w-full" @click="handleNewChat">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
        新建对话
      </Button>
    </div>

    <!-- 对话列表 -->
    <div class="flex-1 overflow-y-auto custom-scrollbar px-2">
      <div
        v-for="session in chatStore.sessions"
        :key="session.id"
        class="group relative px-3 py-2.5 mb-1 rounded-lg cursor-pointer transition-colors"
        :class="activeSessionId === session.id ? 'bg-dark-700' : 'hover:bg-dark-800'"
        @click="handleSelectSession(session.id)"
        @contextmenu="handleContextMenu($event, session.id)"
      >
        <!-- 会话标题 -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2 flex-1 min-w-0">
            <svg class="w-4 h-4 text-dark-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
            </svg>
            <span class="text-sm text-dark-200 truncate">{{ session.title }}</span>
          </div>
          <span class="text-xs text-dark-500 flex-shrink-0 ml-2">{{ formatTime(session.updatedAt) }}</span>
        </div>

        <!-- 消息预览 -->
        <p class="text-xs text-dark-500 mt-1 ml-6 truncate">{{ getMessagePreview(session) }}</p>
      </div>
    </div>

    <!-- 底部导航 -->
    <div class="border-t border-dark-800 p-2">
      <nav class="space-y-1">
        <button
          class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors"
          :class="isActive('/chat') ? 'bg-dark-700 text-dark-100' : 'text-dark-400 hover:bg-dark-800 hover:text-dark-200'"
          @click="navigateTo('/chat')"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          聊天
        </button>

        <button
          class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors"
          :class="isActive('/stats') ? 'bg-dark-700 text-dark-100' : 'text-dark-400 hover:bg-dark-800 hover:text-dark-200'"
          @click="navigateTo('/stats')"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          统计
        </button>

        <button
          class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors"
          :class="isActive('/skills') ? 'bg-dark-700 text-dark-100' : 'text-dark-400 hover:bg-dark-800 hover:text-dark-200'"
          @click="navigateTo('/skills')"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          技能
        </button>

        <button
          class="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors"
          :class="isActive('/settings') ? 'bg-dark-700 text-dark-100' : 'text-dark-400 hover:bg-dark-800 hover:text-dark-200'"
          @click="navigateTo('/settings')"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          设置
        </button>
      </nav>
    </div>

    <!-- 右键菜单 -->
    <Teleport to="body">
      <div
        v-if="contextMenuVisible"
        class="fixed z-50 bg-dark-800 border border-dark-700 rounded-lg shadow-xl py-1 min-w-[140px] animate-fade-in"
        :style="{ left: contextMenuPosition.x + 'px', top: contextMenuPosition.y + 'px' }"
      >
        <button
          class="w-full flex items-center gap-2 px-3 py-2 text-sm text-dark-200 hover:bg-dark-700"
          @click="handleRename"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          重命名
        </button>
        <button
          class="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-400 hover:bg-dark-700"
          @click="handleDelete"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          删除
        </button>
      </div>
    </Teleport>

    <!-- 重命名模态框 -->
    <Modal v-model:show="renameModalVisible" title="重命名对话" width="360px">
      <input
        v-model="renameInput"
        type="text"
        class="w-full px-3 py-2 bg-dark-900 border border-dark-700 rounded-lg text-dark-100 placeholder-dark-500 focus:outline-none focus:border-primary-500"
        placeholder="输入新名称"
        @keydown.enter="confirmRename"
        autofocus
      />
      <template #footer>
        <Button variant="ghost" @click="renameModalVisible = false">取消</Button>
        <Button @click="confirmRename">确认</Button>
      </template>
    </Modal>
  </div>
</template>
