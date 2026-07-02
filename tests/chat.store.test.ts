/**
 * 聊天状态管理单元测试
 * 使用Vitest + Pinia测试chat store的核心逻辑
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { useChatStore } from '@/stores/chat'
import type { Message, StreamChunk } from '@/types'

describe('Chat Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    localStorage.clear()
  })

  describe('createSession', () => {
    it('应该创建一个新的会话并设置为活跃会话', () => {
      const store = useChatStore()
      const sessionId = store.createSession()
      
      expect(sessionId).toBeDefined()
      expect(typeof sessionId).toBe('string')
      expect(sessionId.length).toBeGreaterThan(0)
      expect(store.activeSessionId).toBe(sessionId)
      expect(store.sessions.length).toBe(1)
    })

    it('新会话应该有正确的默认值', () => {
      const store = useChatStore()
      const sessionId = store.createSession()
      const session = store.sessions.find(s => s.id === sessionId)
      
      expect(session).toBeDefined()
      expect(session?.title).toMatch(/新对话/)
      expect(session?.messages).toEqual([])
      expect(session?.modelId).toBeDefined()
    })

    it('创建多个会话应该都保存在列表中', () => {
      const store = useChatStore()
      const id1 = store.createSession()
      const id2 = store.createSession()
      const id3 = store.createSession()
      
      expect(store.sessions.length).toBe(3)
      expect(store.activeSessionId).toBe(id3)
    })
  })

  describe('selectSession', () => {
    it('应该能切换到已存在的会话', () => {
      const store = useChatStore()
      const id1 = store.createSession()
      const id2 = store.createSession()
      
      store.selectSession(id1)
      expect(store.activeSessionId).toBe(id1)
      
      store.selectSession(id2)
      expect(store.activeSessionId).toBe(id2)
    })

    it('切换到不存在的会话不应该改变活跃ID', () => {
      const store = useChatStore()
      const id1 = store.createSession()
      
      store.selectSession('non-existent-id')
      expect(store.activeSessionId).toBe(id1)
    })
  })

  describe('deleteSession', () => {
    it('应该删除指定会话', () => {
      const store = useChatStore()
      const id1 = store.createSession()
      const id2 = store.createSession()
      
      store.deleteSession(id1)
      expect(store.sessions.length).toBe(1)
      expect(store.sessions[0].id).toBe(id2)
    })

    it('删除活跃会话后应该切换到另一个会话', () => {
      const store = useChatStore()
      const id1 = store.createSession()
      const id2 = store.createSession()
      
      store.deleteSession(id2)
      expect(store.activeSessionId).toBe(id1)
    })

    it('删除最后一个会话后应该创建新会话', () => {
      const store = useChatStore()
      const id1 = store.createSession()
      
      store.deleteSession(id1)
      expect(store.sessions.length).toBe(1)
      expect(store.activeSessionId).not.toBe(id1)
    })
  })

  describe('handleStreamChunk', () => {
    it('处理content chunk应该追加到最后一条assistant消息', () => {
      const store = useChatStore()
      store.createSession()
      
      const userMsg: Message = {
        id: 'msg-1',
        role: 'user',
        content: '你好',
        timestamp: Date.now()
      }
      
      const assistantMsg: Message = {
        id: 'msg-2',
        role: 'assistant',
        content: '',
        timestamp: Date.now()
      }
      
      store.activeSession!.messages = [userMsg, assistantMsg]
      
      const chunk: StreamChunk = {
        type: 'content',
        content: '你好！'
      }
      store.handleStreamChunk(chunk)
      
      expect(store.activeSession!.messages[1].content).toBe('你好！')
    })

    it('连续多个content chunk应该正确追加', () => {
      const store = useChatStore()
      store.createSession()
      
      const assistantMsg: Message = {
        id: 'msg-2',
        role: 'assistant',
        content: '',
        timestamp: Date.now()
      }
      store.activeSession!.messages = [
        { id: 'msg-1', role: 'user', content: 'Hi', timestamp: Date.now() },
        assistantMsg
      ]
      
      store.handleStreamChunk({ type: 'content', content: 'Hello' })
      store.handleStreamChunk({ type: 'content', content: ' World' })
      store.handleStreamChunk({ type: 'content', content: '!' })
      
      expect(store.activeSession!.messages[1].content).toBe('Hello World!')
    })

    it('处理finish chunk应该设置isStreaming为false', () => {
      const store = useChatStore()
      store.createSession()
      store.isStreaming = true
      
      store.handleStreamChunk({ type: 'finish', finishReason: 'stop' })
      expect(store.isStreaming).toBe(false)
    })

    it('处理error chunk应该设置isStreaming为false并记录错误', () => {
      const store = useChatStore()
      store.createSession()
      store.isStreaming = true
      
      store.handleStreamChunk({ type: 'error', error: 'API请求失败' })
      expect(store.isStreaming).toBe(false)
    })

    it('处理usage chunk应该更新消息的usage信息', () => {
      const store = useChatStore()
      store.createSession()
      
      const assistantMsg: Message = {
        id: 'msg-2',
        role: 'assistant',
        content: '回复',
        timestamp: Date.now()
      }
      store.activeSession!.messages = [
        { id: 'msg-1', role: 'user', content: '问', timestamp: Date.now() },
        assistantMsg
      ]
      
      store.handleStreamChunk({
        type: 'usage',
        promptTokens: 100,
        completionTokens: 50,
        cachedTokens: 80
      })
      
      const lastMsg = store.activeSession!.messages[1]
      expect(lastMsg.usage).toBeDefined()
      expect(lastMsg.usage?.promptTokens).toBe(100)
      expect(lastMsg.usage?.completionTokens).toBe(50)
    })
  })

  describe('renameSession', () => {
    it('应该能重命名会话', () => {
      const store = useChatStore()
      const id = store.createSession()
      
      store.renameSession(id, '我的新对话')
      const session = store.sessions.find(s => s.id === id)
      expect(session?.title).toBe('我的新对话')
    })
  })

  describe('messageCount getter', () => {
    it('应该返回所有会话的消息总数', () => {
      const store = useChatStore()
      const id = store.createSession()
      store.activeSession!.messages = [
        { id: '1', role: 'user', content: 'a', timestamp: Date.now() },
        { id: '2', role: 'assistant', content: 'b', timestamp: Date.now() },
        { id: '3', role: 'user', content: 'c', timestamp: Date.now() }
      ]
      
      expect(store.messageCount).toBe(3)
    })

    it('没有会话时应该返回0', () => {
      const store = useChatStore()
      expect(store.messageCount).toBe(0)
    })
  })
})
