export type ChatStrategy = 'balanced'
export type ChatRole = 'assistant' | 'summary' | 'system' | 'tool' | 'user'
export type ChatMessageStatus = 'completed' | 'error' | 'pending' | 'stopped'

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
  kind?: 'node' | 'summary'
  originalContent?: string | null
  parentId: string | null
  pendingEdit?: boolean
  modifiedFrom: string | null
  pinned: boolean
  archived: boolean
  stale: boolean
  role: ChatRole
  archivedNodeIds?: string[]
  sourceNodeId?: string | null
  status: ChatMessageStatus
  timestamp: number
}

export type ChatBranch = {
  id: string
  name: string
  headMessageId: string | null
  baseMessageId: string | null
}

export type ChatSession = {
  activeBranch: ChatBranch | null
  activeBranchId: string | null
  branches: ChatBranch[]
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
  messagesSource?: 'graph' | 'server'
  messageNodes: Record<string, ChatMessage>
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
  status: 'cancelled' | 'error' | 'fallback' | 'success'
  strategy: ChatStrategy
  totalTokens: number
}

export type ChatStreamMeta = {
  cacheHit: boolean
  endpointId: string
  fallbackCount: number
  model: string
  provider: string
  requestId: string
  routeReason: string
  strategy: ChatStrategy
}

export type ChatStreamEvent =
  | {
      kind: 'message.created'
      assistantMessageId: string
      branchId: string | null
      userMessageId: string | null
    }
  | {
      kind: 'message.meta'
      assistantMessageId: string
      meta: ChatStreamMeta
    }
  | {
      kind: 'message.delta'
      assistantMessageId: string
      content: string
      delta: string
    }
  | {
      kind: 'message.completed' | 'message.error' | 'message.stopped'
      assistantMessageId: string
      conversation?: unknown
      errorMessage?: string | null
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
