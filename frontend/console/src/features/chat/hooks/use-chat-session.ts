import { useState } from 'react'
import { normalizeChatResponse } from '@/features/chat/chat-adapters'
import type {
  ChatCallInfo,
  ChatConfig,
  ChatHistoryMessage,
  ChatMessage
} from '@/features/chat/chat-types'
import { sendChatMessage } from '@/shared/api/modules/chat'

type UseChatSessionResult = {
  clearChat: () => void
  lastCallInfo: ChatCallInfo | null
  messages: ChatMessage[]
  sendChat: (content: string, config: ChatConfig) => Promise<void>
  sending: boolean
}

function buildErrorCallInfo(strategy: ChatConfig['strategy'], latencyMs: number): ChatCallInfo {
  return {
    requestId: '',
    provider: '',
    model: '',
    routeReason: '',
    cacheHit: false,
    endpointId: '',
    fallbackCount: 0,
    latencyMs,
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
    costUsd: 0,
    strategy,
    status: 'error'
  }
}

export function useChatSession(): UseChatSessionResult {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [chatHistory, setChatHistory] = useState<ChatHistoryMessage[]>([])
  const [sending, setSending] = useState(false)
  const [lastCallInfo, setLastCallInfo] = useState<ChatCallInfo | null>(null)

  async function sendChat(content: string, config: ChatConfig) {
    const normalizedContent = content.trim()
    if (!normalizedContent || sending) {
      return
    }

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: normalizedContent,
      timestamp: Date.now(),
      callInfo: null
    }

    const assistantMessageId = crypto.randomUUID()
    const assistantPlaceholder: ChatMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
      callInfo: null,
      loading: true
    }

    const nextHistory = [
      ...chatHistory,
      { role: 'user', content: normalizedContent }
    ] satisfies ChatHistoryMessage[]

    setMessages((current) => [...current, userMessage, assistantPlaceholder])
    setChatHistory(nextHistory)
    setSending(true)

    const startedAt = Date.now()

    try {
      const { data, headers } = await sendChatMessage({
        messages: nextHistory,
        temperature: config.temperature,
        strategy: config.strategy,
        model: config.model,
        promptId: config.promptId || undefined,
        promptVariables: Object.keys(config.variables).length ? config.variables : undefined
      })

      const normalized = normalizeChatResponse(
        data,
        headers,
        Date.now() - startedAt,
        config.strategy
      )

      setMessages((current) =>
        current.map((message) =>
          message.id === assistantMessageId
            ? {
                ...message,
                content: normalized.content,
                callInfo: normalized.callInfo,
                loading: false
              }
            : message
        )
      )
      setLastCallInfo(normalized.callInfo)
      setChatHistory((current) => [...current, { role: 'assistant', content: normalized.content }])
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误'
      const errorCallInfo = buildErrorCallInfo(config.strategy, Date.now() - startedAt)

      setMessages((current) =>
        current.map((item) =>
          item.id === assistantMessageId
            ? {
                ...item,
                content: `调用失败：${message}`,
                callInfo: errorCallInfo,
                loading: false
              }
            : item
        )
      )
      setLastCallInfo(errorCallInfo)
    } finally {
      setSending(false)
    }
  }

  function clearChat() {
    setMessages([])
    setChatHistory([])
    setLastCallInfo(null)
  }

  return {
    messages,
    sending,
    lastCallInfo,
    sendChat,
    clearChat
  }
}
