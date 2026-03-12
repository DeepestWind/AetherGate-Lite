import {
  type ChatCallInfo,
  type ChatConfig,
  type ChatMessage,
  type ChatSession,
  defaultChatConfig,
  type PromptTemplate
} from '@/features/chat/chat-types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readValue(
  source: Record<string, unknown> | null | undefined,
  keys: string[],
  fallback: unknown
) {
  for (const key of keys) {
    const value = source?.[key]
    if (value !== undefined && value !== null && value !== '') {
      return value
    }
  }

  return fallback
}

function toNumber(value: unknown, fallback = 0) {
  const next = Number(value)
  return Number.isFinite(next) ? next : fallback
}

export function normalizeAvailableModels(payload: unknown) {
  const source = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.data)
      ? payload.data
      : []

  return source
    .map((item) => {
      if (typeof item === 'string') {
        return item
      }

      if (isRecord(item)) {
        return String(readValue(item, ['id', 'model'], '')).trim()
      }

      return ''
    })
    .filter(Boolean)
}

function normalizePromptVariables(payload: unknown): string[] {
  if (!payload) {
    return []
  }

  let source = payload
  if (typeof source === 'string') {
    try {
      source = JSON.parse(source)
    } catch {
      return []
    }
  }

  if (Array.isArray(source)) {
    return source
      .map((item) => {
        if (typeof item === 'string') {
          return item
        }
        if (isRecord(item)) {
          return String(readValue(item, ['name', 'key', 'variable'], ''))
        }
        return ''
      })
      .filter(Boolean)
  }

  if (isRecord(source)) {
    return Object.keys(source)
  }

  return []
}

export function normalizePromptTemplates(payload: unknown): PromptTemplate[] {
  const source = Array.isArray(payload) ? payload : []

  return source
    .map((item, index) => {
      const row = isRecord(item) ? item : {}
      const promptId = String(readValue(row, ['promptId', 'prompt_id', 'id'], `prompt-${index}`))

      return {
        id: String(readValue(row, ['id'], promptId)),
        promptId,
        name: String(readValue(row, ['name'], promptId)),
        description: String(readValue(row, ['description'], '')),
        isActive: Boolean(readValue(row, ['isActive', 'is_active'], true)),
        variables: normalizePromptVariables(readValue(row, ['variables'], []))
      }
    })
    .filter((item) => item.isActive)
}

export function normalizeChatResponse(
  payload: unknown,
  headers: Record<string, unknown>,
  latencyMs: number,
  strategy: ChatConfig['strategy']
) {
  const response = isRecord(payload) ? payload : {}
  const choices = Array.isArray(response.choices) ? response.choices : []
  const firstChoice = isRecord(choices[0]) ? choices[0] : {}
  const message = isRecord(firstChoice.message) ? firstChoice.message : {}
  const usage = isRecord(response.usage) ? response.usage : {}

  const content = String(readValue(message, ['content'], ''))

  const callInfo: ChatCallInfo = {
    requestId: String(headers['x-request-id'] ?? ''),
    provider: String(headers['x-aethergate-provider'] ?? ''),
    model: String(readValue(response, ['model'], '')),
    routeReason: String(headers['x-aethergate-route-reason'] ?? ''),
    cacheHit: String(headers['x-aethergate-cache'] ?? '').toLowerCase() === 'hit',
    endpointId: String(headers['x-aethergate-endpoint'] ?? ''),
    fallbackCount: toNumber(headers['x-aethergate-fallbacks'], 0),
    latencyMs,
    promptTokens: toNumber(readValue(usage, ['promptTokens', 'prompt_tokens'], 0)),
    completionTokens: toNumber(readValue(usage, ['completionTokens', 'completion_tokens'], 0)),
    totalTokens: toNumber(readValue(usage, ['totalTokens', 'total_tokens'], 0)),
    costUsd: 0,
    strategy,
    status: toNumber(headers['x-aethergate-fallbacks'], 0) > 0 ? 'fallback' : 'success'
  }

  return {
    content,
    callInfo
  }
}

export function normalizeChatConfig(payload: unknown): ChatConfig {
  const row = isRecord(payload) ? payload : {}

  return {
    model: String(readValue(row, ['model'], defaultChatConfig.model)),
    promptId: String(readValue(row, ['promptId', 'prompt_id'], defaultChatConfig.promptId)),
    strategy: String(
      readValue(row, ['strategy'], defaultChatConfig.strategy)
    ) as ChatConfig['strategy'],
    temperature: toNumber(readValue(row, ['temperature'], defaultChatConfig.temperature)),
    variables: isRecord(readValue(row, ['variables'], {}))
      ? Object.fromEntries(
          Object.entries(readValue(row, ['variables'], {}) as Record<string, unknown>).map(
            ([key, value]) => [key, String(value ?? '')]
          )
        )
      : {}
  }
}

function normalizeChatCallInfo(payload: unknown): ChatCallInfo | null {
  if (!isRecord(payload)) {
    return null
  }

  return {
    requestId: String(readValue(payload, ['requestId', 'request_id'], '')),
    provider: String(readValue(payload, ['provider'], '')),
    model: String(readValue(payload, ['model'], '')),
    routeReason: String(readValue(payload, ['routeReason', 'route_reason'], '')),
    cacheHit: Boolean(readValue(payload, ['cacheHit', 'cache_hit'], false)),
    endpointId: String(readValue(payload, ['endpointId', 'endpoint_id'], '')),
    fallbackCount: toNumber(readValue(payload, ['fallbackCount', 'fallback_count'], 0)),
    latencyMs: toNumber(readValue(payload, ['latencyMs', 'latency_ms'], 0)),
    promptTokens: toNumber(readValue(payload, ['promptTokens', 'prompt_tokens'], 0)),
    completionTokens: toNumber(readValue(payload, ['completionTokens', 'completion_tokens'], 0)),
    totalTokens: toNumber(readValue(payload, ['totalTokens', 'total_tokens'], 0)),
    costUsd: toNumber(readValue(payload, ['costUsd', 'cost_usd'], 0)),
    strategy: String(
      readValue(payload, ['strategy'], defaultChatConfig.strategy)
    ) as ChatConfig['strategy'],
    status: String(readValue(payload, ['status'], 'success')) as ChatCallInfo['status']
  }
}

export function normalizeChatMessage(payload: unknown): ChatMessage {
  const row = isRecord(payload) ? payload : {}

  return {
    id: String(readValue(row, ['id'], crypto.randomUUID())),
    role: String(readValue(row, ['role'], 'assistant')) as ChatMessage['role'],
    content: String(readValue(row, ['content'], '')),
    status: String(readValue(row, ['status'], 'completed')) as ChatMessage['status'],
    timestamp: toNumber(readValue(row, ['timestamp'], Date.now())),
    errorMessage: String(readValue(row, ['errorMessage', 'error_message'], '')) || null,
    callInfo: normalizeChatCallInfo(readValue(row, ['callInfo', 'call_info'], null))
  }
}

function getLastCallInfo(messages: ChatMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.callInfo) {
      return messages[index].callInfo
    }
  }

  return null
}

export function normalizeChatSession(payload: unknown): ChatSession {
  const row = isRecord(payload) ? payload : {}
  const messages = Array.isArray(readValue(row, ['messages'], []))
    ? (readValue(row, ['messages'], []) as unknown[]).map(normalizeChatMessage)
    : []

  return {
    id: String(readValue(row, ['id'], crypto.randomUUID())),
    title: String(readValue(row, ['title'], '新对话')),
    draftConfig: normalizeChatConfig(
      readValue(row, ['draftConfig', 'draft_config'], defaultChatConfig)
    ),
    lastMessageAt:
      readValue(row, ['lastMessageAt', 'last_message_at'], null) === null
        ? null
        : toNumber(readValue(row, ['lastMessageAt', 'last_message_at'], 0)),
    lastMessagePreview:
      String(readValue(row, ['lastMessagePreview', 'last_message_preview'], '')) || null,
    lastMessageRole:
      (String(
        readValue(row, ['lastMessageRole', 'last_message_role'], '')
      ) as ChatSession['lastMessageRole']) || null,
    messageCount: toNumber(readValue(row, ['messageCount', 'message_count'], messages.length)),
    createdAt: toNumber(readValue(row, ['createdAt', 'created_at'], Date.now())),
    updatedAt: toNumber(readValue(row, ['updatedAt', 'updated_at'], Date.now())),
    messages,
    messagesLoaded: Array.isArray(readValue(row, ['messages'], null)),
    lastCallInfo: getLastCallInfo(messages)
  }
}

export function normalizeChatSessions(payload: unknown): ChatSession[] {
  const source = Array.isArray(payload) ? payload : []
  return source.map(normalizeChatSession)
}
