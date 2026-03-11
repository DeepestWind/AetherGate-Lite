export type ChatStrategy = 'balanced' | 'cheapest' | 'quality'

export type ChatConfig = {
  model: string
  promptId: string
  strategy: ChatStrategy
  temperature: number
  variables: Record<string, string>
}

export type ChatMessage = {
  callInfo: ChatCallInfo | null
  content: string
  id: string
  loading?: boolean
  role: 'assistant' | 'user'
  timestamp: number
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
  role: 'assistant' | 'user'
}

export type PromptTemplate = {
  description: string
  id: string
  isActive: boolean
  name: string
  promptId: string
  variables: string[]
}
