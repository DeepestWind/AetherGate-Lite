import type { ChatCallInfo, ChatConfig, PromptTemplate } from '@/features/chat/chat-types'

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
