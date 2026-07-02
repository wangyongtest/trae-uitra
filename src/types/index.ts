export type MessageRole = 'user' | 'assistant' | 'system' | 'tool'
export type ToolCallStatus = 'pending' | 'running' | 'success' | 'error'

export interface ToolCall {
  id: string
  name: string
  arguments: string
  status: ToolCallStatus
  result?: string
  duration?: number
  startedAt?: number
  endedAt?: number
}

export interface TokenUsage {
  promptTokens: number
  completionTokens: number
  totalTokens: number
  cachedTokens?: number
}

export interface Message {
  id: string
  role: MessageRole
  content: string
  timestamp: number
  toolCalls?: ToolCall[]
  toolCallId?: string
  model?: string
  usage?: TokenUsage
  duration?: number
}

export interface ModelPricing {
  inputPricePerMillion: number
  outputPricePerMillion: number
  cacheHitPriceRatio: number
}

export interface ModelCapabilities {
  reasoning: boolean
  tools: boolean
  vision: boolean
}

export interface ModelInfo {
  id: string
  displayName: string
  provider: string
  providerModelId: string
  pricing: ModelPricing
  capabilities: ModelCapabilities
  supportsCache: boolean
}

export interface RoundStats {
  promptTokens: number
  hitTokens: number
}

export type CacheStatus = 'green' | 'yellow' | 'red'

export interface CacheStats {
  hitRate: number
  status: CacheStatus
  totalPrompt: number
  totalHit: number
  history: RoundStats[]
}

export interface BudgetAlert {
  threshold: number
  current: number
  triggered: boolean
}

export interface CostStats {
  totalCost: number
  todayCost: number
  costByModel: Record<string, number>
  budgetAlert: BudgetAlert
}

export interface ChatSession {
  id: string
  title: string
  messages: Message[]
  createdAt: number
  updatedAt: number
  modelId?: string
}

export interface APIKeys {
  deepseek?: string
  volcengine?: string
  [key: string]: string | undefined
}

export type Theme = 'dark' | 'light' | 'system'
export type Language = 'zh-CN' | 'en-US'

export interface Settings {
  apiKeys: APIKeys
  defaultModel: string
  theme: Theme
  budget: number
  fontSize: number
  language: Language
}

export type StreamChunkType = 'content' | 'tool_call' | 'usage' | 'finish' | 'error'

export interface StreamChunk {
  type: StreamChunkType
  content?: string
  toolCallIndex?: number
  toolCallID?: string
  toolCallName?: string
  toolCallArgs?: string
  promptTokens?: number
  completionTokens?: number
  cachedTokens?: number
  error?: string
  finishReason?: string
}
