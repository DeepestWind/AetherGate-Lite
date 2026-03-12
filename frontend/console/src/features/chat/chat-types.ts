export type ChatStrategy = 'balanced' | 'cheapest' | 'quality'
export type ChatRole = 'assistant' | 'system' | 'tool' | 'user'
export type ChatMessageStatus = 'completed' | 'error' | 'pending'

export type ChatConfig = {
  model: string
  promptId: string
  strategy: ChatStrategy
  temperature: number
  variables: Record<string, string>
}

export const defaultChatConfig: ChatConfig = {
  strategy: 'balanced',
  model: '',
  promptId: '',
  temperature: 0,
  variables: {}
}

export type ChatMessage = {
  callInfo: ChatCallInfo | null
  content: string
  errorMessage?: string | null
  id: string
  loading?: boolean
  role: ChatRole
  status: ChatMessageStatus
  timestamp: number
}

export type ChatSession = {
  createdAt: number
  draftConfig: ChatConfig
  loading?: boolean
  id: string
  lastCallInfo: ChatCallInfo | null
  lastMessageAt: number | null
  lastMessagePreview: string | null
  lastMessageRole: ChatRole | null
  messageCount: number
  messages: ChatMessage[]
  messagesLoaded: boolean
  title: string
  updatedAt: number
}

export type ChatCallInfo = {
  cacheHit: boolean
  completionTokens: number
  costUsd: number
  endpointId: string
  fallbackCount: number
  latencyMs: number
  model: string
  promptTokens: number
  provider: string
  requestId: string
  routeReason: string
  status: 'error' | 'fallback' | 'success'
  strategy: ChatStrategy
  totalTokens: number
}

export type ChatHistoryMessage = {
  content: string
  role: Extract<ChatRole, 'assistant' | 'user'>
}

export type PromptTemplate = {
  description: string
  id: string
  isActive: boolean
  name: string
  promptId: string
  variables: string[]
}
