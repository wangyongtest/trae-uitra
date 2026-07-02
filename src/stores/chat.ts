import { defineStore } from 'pinia'
import { ref, computed, watch } from 'vue'
import type { ChatSession, Message, StreamChunk } from '@/types'

// 本地存储键名
const STORAGE_KEY = 'trae-chat-sessions'

// 生成唯一ID
const generateId = () => Math.random().toString(36).substring(2, 15) + Date.now().toString(36)

export const useChatStore = defineStore('chat', () => {
  // ==========================================
  // State
  // ==========================================
  const sessions = ref<ChatSession[]>([])
  const activeSessionId = ref<string | null>(null)
  const currentStreamRequestId = ref<string | null>(null)
  const isStreaming = ref(false)

  // ==========================================
  // Getters
  // ==========================================
  const activeSession = computed(() => {
    return sessions.value.find(s => s.id === activeSessionId.value) || null
  })

  const messageCount = computed(() => {
    if (!activeSession.value) return 0
    return activeSession.value.messages.length
  })

  const tokenCount = computed(() => {
    if (!activeSession.value) return 0
    return activeSession.value.messages.reduce((total, msg) => {
      return total + (msg.usage?.totalTokens || 0)
    }, 0)
  })

  // ==========================================
  // 本地存储持久化
  // ==========================================
  const loadSessions = () => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        sessions.value = JSON.parse(saved)
      }
    } catch (e) {
      console.error('加载会话失败:', e)
      sessions.value = []
    }
  }

  const saveSessions = () => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions.value))
    } catch (e) {
      console.error('保存会话失败:', e)
    }
  }

  // 监听会话变化自动保存
  watch(sessions, saveSessions, { deep: true })

  // ==========================================
  // Actions
  // ==========================================

  /**
   * 创建新会话
   */
  const createSession = (): ChatSession => {
    const now = Date.now()
    const session: ChatSession = {
      id: generateId(),
      title: '新对话',
      messages: [],
      createdAt: now,
      updatedAt: now
    }
    sessions.value.unshift(session)
    activeSessionId.value = session.id
    return session
  }

  /**
   * 选择会话
   */
  const selectSession = (sessionId: string) => {
    const session = sessions.value.find(s => s.id === sessionId)
    if (session) {
      activeSessionId.value = sessionId
    }
  }

  /**
   * 删除会话
   */
  const deleteSession = (sessionId: string) => {
    const index = sessions.value.findIndex(s => s.id === sessionId)
    if (index !== -1) {
      sessions.value.splice(index, 1)
      // 如果删除的是当前活跃会话，切换到第一个或创建新会话
      if (activeSessionId.value === sessionId) {
        if (sessions.value.length > 0) {
          activeSessionId.value = sessions.value[0].id
        } else {
          createSession()
        }
      }
    }
  }

  /**
   * 重命名会话
   */
  const renameSession = (sessionId: string, title: string) => {
    const session = sessions.value.find(s => s.id === sessionId)
    if (session) {
      session.title = title
      session.updatedAt = Date.now()
    }
  }

  /**
   * 添加消息到当前会话
   */
  const addMessage = (message: Message) => {
    if (!activeSession.value) {
      createSession()
    }
    if (activeSession.value) {
      activeSession.value.messages.push(message)
      activeSession.value.updatedAt = Date.now()

      // 如果是第一条用户消息，自动生成标题
      if (message.role === 'user' && activeSession.value.title === '新对话') {
        activeSession.value.title = message.content.slice(0, 30) + (message.content.length > 30 ? '...' : '')
      }
    }
  }

  /**
   * 发送消息
   */
  const sendMessage = async (content: string, modelId: string) => {
    if (!content.trim() || isStreaming.value) return

    // 确保有活跃会话
    if (!activeSession.value) {
      createSession()
    }

    const session = activeSession.value!
    session.modelId = modelId

    // 添加用户消息
    const userMessage: Message = {
      id: generateId(),
      role: 'user',
      content: content.trim(),
      timestamp: Date.now()
    }
    addMessage(userMessage)

    // 创建空的助手消息用于流式更新
    const assistantMessage: Message = {
      id: generateId(),
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      toolCalls: [],
      model: modelId,
      usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0, cachedTokens: 0 }
    }
    addMessage(assistantMessage)

    // 开始流式请求
    isStreaming.value = true
    currentStreamRequestId.value = generateId()

    try {
      const trae = (window as any).trae?.ultra
      if (trae?.chat?.send) {
        const messagesForApi = session.messages.slice(0, -1).map((m: Message) => ({
          role: m.role,
          content: m.content,
          tool_call_id: m.toolCallId,
          tool_calls: m.toolCalls?.map(tc => ({
            id: tc.id,
            type: 'function',
            function: { name: tc.name, arguments: tc.arguments }
          }))
        }))
        currentStreamRequestId.value = await trae.chat.send({
          message: content.trim(),
          model: modelId,
          conversationId: session.id
        })
      } else {
        await simulateStreamResponse(assistantMessage.id)
      }
    } catch (error) {
      console.error('发送消息失败:', error)
      assistantMessage.content = '\n\n**错误**: ' + (error as Error).message
    } finally {
      isStreaming.value = false
      currentStreamRequestId.value = null
    }
  }

  /**
   * 开发模式模拟流式响应
   */
  const simulateStreamResponse = async (assistantMessageId: string) => {
    const session = activeSession.value
    if (!session) return

    const assistantMessage = session.messages.find(m => m.id === assistantMessageId)
    if (!assistantMessage) return

    const responses = [
      '你好！我是TRAE Ultra，一个AI原生工作空间助手。\n\n',
      '我具备以下能力：\n',
      '- **缓存优先架构**：显著降低Token消耗\n',
      '- **多模型支持**：DeepSeek、豆包等主流模型\n',
      '- **工具调用**：可以执行各种操作\n',
      '- **实时统计**：缓存命中率和费用监控\n\n',
      '有什么我可以帮助你的吗？'
    ]

    for (const chunk of responses) {
      await new Promise(resolve => setTimeout(resolve, 100))
      assistantMessage.content += chunk
    }
  }

  /**
   * 中止流式请求
   */
  const abortStream = () => {
    if (currentStreamRequestId.value) {
      const trae = (window as any).trae?.ultra
      if (trae?.chat?.abort) {
        trae.chat.abort(currentStreamRequestId.value)
      }
      isStreaming.value = false
      currentStreamRequestId.value = null
    }
  }

  /**
   * 处理流式响应块
   */
  const handleStreamChunk = (chunk: StreamChunk) => {
    const session = activeSession.value
    if (!session || !isStreaming.value) return

    const lastMessage = session.messages[session.messages.length - 1]
    if (!lastMessage || lastMessage.role !== 'assistant') return

    switch (chunk.type) {
      case 'content':
        if (chunk.content) {
          lastMessage.content += chunk.content
        }
        break

      case 'tool_call':
        if (!lastMessage.toolCalls) {
          lastMessage.toolCalls = []
        }
        if (chunk.toolCallIndex !== undefined) {
          const toolCall = lastMessage.toolCalls[chunk.toolCallIndex]
          if (!toolCall) {
            lastMessage.toolCalls[chunk.toolCallIndex] = {
              id: generateId(),
              name: chunk.toolCallName || '',
              arguments: chunk.toolCallArgs || '',
              status: 'running',
              startedAt: Date.now()
            }
          } else {
            if (chunk.toolCallArgs) {
              toolCall.arguments += chunk.toolCallArgs
            }
            if (chunk.toolCallName) {
              toolCall.name = chunk.toolCallName
            }
          }
        }
        break

      case 'usage':
        if (lastMessage.usage) {
          lastMessage.usage.promptTokens = chunk.promptTokens || 0
          lastMessage.usage.completionTokens = chunk.completionTokens || 0
          lastMessage.usage.totalTokens = (chunk.promptTokens || 0) + (chunk.completionTokens || 0)
          lastMessage.usage.cachedTokens = chunk.cachedTokens || 0
        }
        break

      case 'finish':
        lastMessage.duration = Date.now() - lastMessage.timestamp
        // 更新工具调用状态为成功
        if (lastMessage.toolCalls) {
          lastMessage.toolCalls.forEach(tc => {
            if (tc.status === 'running' || tc.status === 'pending') {
              tc.status = 'success'
              tc.endedAt = Date.now()
              tc.duration = tc.endedAt - (tc.startedAt || tc.endedAt)
            }
          })
        }
        break

      case 'error':
        lastMessage.content += `\n\n**错误**: ${chunk.error || '未知错误'}`
        break
    }

    session.updatedAt = Date.now()
  }

  /**
   * 添加工具调用结果
   */
  const addToolResult = (toolCallId: string, result: string, isError = false) => {
    const session = activeSession.value
    if (!session) return

    const lastMessage = session.messages[session.messages.length - 1]
    if (!lastMessage || !lastMessage.toolCalls) return

    const toolCall = lastMessage.toolCalls.find(tc => tc.id === toolCallId)
    if (toolCall) {
      toolCall.result = result
      toolCall.status = isError ? 'error' : 'success'
      toolCall.endedAt = Date.now()
      toolCall.duration = toolCall.endedAt - (toolCall.startedAt || toolCall.endedAt)
    }
  }

  // ==========================================
  // 初始化
  // ==========================================
  loadSessions()

  // 如果没有会话，创建一个默认会话
  if (sessions.value.length === 0) {
    createSession()
  } else if (!activeSessionId.value) {
    activeSessionId.value = sessions.value[0].id
  }

  // 监听流式响应事件
  if (typeof window !== 'undefined') {
    const trae = (window as any).trae?.ultra
    if (trae?.chat?.onChunk) {
      trae.chat.onChunk((data: any) => {
        if (data?.chunk) {
          handleStreamChunk(data.chunk as StreamChunk)
        }
      })
      trae.chat.onDone?.(() => {
        isStreaming.value = false
        const session = activeSession.value
        if (session) {
          const lastMsg = session.messages[session.messages.length - 1]
          if (lastMsg?.role === 'assistant') {
            lastMsg.duration = Date.now() - lastMsg.timestamp
          }
        }
      })
      trae.chat.onError?.((data: any) => {
        isStreaming.value = false
        const session = activeSession.value
        if (session) {
          const lastMsg = session.messages[session.messages.length - 1]
          if (lastMsg?.role === 'assistant') {
            lastMsg.content += `\n\n**错误**: ${data?.message || '未知错误'}`
          }
        }
      })
    }
  }

  return {
    // State
    sessions,
    activeSessionId,
    currentStreamRequestId,
    isStreaming,
    // Getters
    activeSession,
    messageCount,
    tokenCount,
    // Actions
    createSession,
    selectSession,
    deleteSession,
    renameSession,
    sendMessage,
    abortStream,
    handleStreamChunk,
    addToolResult,
    addMessage
  }
})
