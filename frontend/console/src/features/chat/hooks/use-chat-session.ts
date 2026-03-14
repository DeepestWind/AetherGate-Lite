import { useCallback, useEffect, useMemo, useState } from 'react'
import { normalizeChatSession, normalizeChatSessions } from '@/features/chat/chat-adapters'
import {
  type ChatCallInfo,
  type ChatConfig,
  type ChatMessage,
  type ChatSession,
  defaultChatConfig
} from '@/features/chat/chat-types'
import {
  clearChatConversation,
  createChatConversation,
  deleteChatConversation,
  getChatConversation,
  listChatConversations,
  renameChatConversation,
  sendConversationMessage,
  updateChatConversationConfig
} from '@/shared/api/modules/chat'

type UseChatSessionResult = {
  activeSession: ChatSession | null
  activeSessionId: string | null
  clearChat: () => Promise<void>
  createSession: (config: ChatConfig) => Promise<void>
  deleteSession: (sessionId: string) => Promise<void>
  initializing: boolean
  lastCallInfo: ChatCallInfo | null
  messages: ChatMessage[]
  renameSession: (sessionId: string, title: string) => Promise<void>
  saveDraftConfig: (config: ChatConfig) => Promise<void>
  selectSession: (sessionId: string) => Promise<void>
  sendChat: (content: string, config: ChatConfig) => Promise<void>
  sessions: ChatSession[]
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

function getLastCallInfo(messages: ChatMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.callInfo) {
      return messages[index].callInfo
    }
  }

  return null
}

function mergeSessionState(
  currentSession: ChatSession | undefined,
  incoming: ChatSession
): ChatSession {
  const shouldPreserveMessages = !incoming.messagesLoaded && Boolean(currentSession?.messagesLoaded)
  const messages = shouldPreserveMessages ? (currentSession?.messages ?? []) : incoming.messages
  const messagesLoaded = shouldPreserveMessages
    ? (currentSession?.messagesLoaded ?? false)
    : incoming.messagesLoaded

  return {
    ...currentSession,
    ...incoming,
    messages,
    messagesLoaded,
    lastCallInfo: getLastCallInfo(messages)
  }
}

function upsertSessions(current: ChatSession[], incoming: ChatSession | ChatSession[]) {
  const incomingList = Array.isArray(incoming) ? incoming : [incoming]
  const next = [...current]

  for (const item of incomingList) {
    const index = next.findIndex((session) => session.id === item.id)
    if (index === -1) {
      next.push(item)
      continue
    }

    next[index] = mergeSessionState(next[index], item)
  }

  return next
}

export function useChatSession(enabled = true): UseChatSessionResult {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [initializing, setInitializing] = useState(true)
  const [sendingSessionId, setSendingSessionId] = useState<string | null>(null)

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? null,
    [activeSessionId, sessions]
  )

  const loadConversationDetail = useCallback(async (conversationId: string) => {
    const payload = await getChatConversation(conversationId)
    const detail = normalizeChatSession(payload)
    setSessions((current) => upsertSessions(current, detail))
    return detail
  }, [])

  useEffect(() => {
    if (!enabled) {
      setSessions([])
      setActiveSessionId(null)
      setInitializing(false)
      return
    }

    let cancelled = false

    async function hydrate() {
      setInitializing(true)

      try {
        const payload = await listChatConversations()
        if (cancelled) {
          return
        }

        const listed = normalizeChatSessions(payload)
        if (listed.length === 0) {
          const created = normalizeChatSession(await createChatConversation(defaultChatConfig))
          if (cancelled) {
            return
          }
          setSessions([created])
          setActiveSessionId(created.id)
          return
        }

        setSessions(listed)
        setActiveSessionId(listed[0]?.id ?? null)
        await loadConversationDetail(listed[0]?.id ?? '')
      } catch {
        if (cancelled) {
          return
        }

        setSessions([])
        setActiveSessionId(null)
      } finally {
        if (!cancelled) {
          setInitializing(false)
        }
      }
    }

    void hydrate()

    return () => {
      cancelled = true
    }
  }, [enabled, loadConversationDetail])

  async function createSession(config: ChatConfig) {
    const payload = await createChatConversation(config)
    const created = normalizeChatSession(payload)
    setSessions((current) => upsertSessions(current, created))
    setActiveSessionId(created.id)
  }

  async function selectSession(sessionId: string) {
    setActiveSessionId(sessionId)

    const target = sessions.find((session) => session.id === sessionId)
    if (!target?.messagesLoaded) {
      await loadConversationDetail(sessionId)
    }
  }

  async function deleteSession(sessionId: string) {
    await deleteChatConversation(sessionId)

    const remaining = sessions.filter((session) => session.id !== sessionId)
    setSessions(remaining)

    if (activeSessionId !== sessionId) {
      return
    }

    if (remaining[0]) {
      setActiveSessionId(remaining[0].id)
      if (!remaining[0].messagesLoaded) {
        await loadConversationDetail(remaining[0].id)
      }
      return
    }

    const created = normalizeChatSession(await createChatConversation(defaultChatConfig))
    setSessions([created])
    setActiveSessionId(created.id)
  }

  async function renameSession(sessionId: string, title: string) {
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      return
    }

    const previousTitle = sessions.find((session) => session.id === sessionId)?.title ?? ''
    setSessions((current) =>
      current.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              title: trimmedTitle
            }
          : session
      )
    )

    try {
      const payload = await renameChatConversation(sessionId, trimmedTitle)
      const updated = normalizeChatSession(payload)
      setSessions((current) => upsertSessions(current, updated))
    } catch (error) {
      setSessions((current) =>
        current.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                title: previousTitle
              }
            : session
        )
      )
      throw error
    }
  }

  async function clearChat() {
    if (!activeSessionId) {
      return
    }

    const payload = await clearChatConversation(activeSessionId)
    const cleared = normalizeChatSession(payload)
    setSessions((current) => upsertSessions(current, cleared))
  }

  async function saveDraftConfig(config: ChatConfig) {
    if (!activeSessionId) {
      return
    }

    setSessions((current) =>
      current.map((session) =>
        session.id === activeSessionId
          ? {
              ...session,
              draftConfig: config
            }
          : session
      )
    )

    const payload = await updateChatConversationConfig(activeSessionId, config)
    const updated = normalizeChatSession(payload)
    setSessions((current) => upsertSessions(current, updated))
  }

  async function sendChat(content: string, config: ChatConfig) {
    if (!activeSessionId || sendingSessionId) {
      return
    }

    const normalizedContent = content.trim()
    if (!normalizedContent) {
      return
    }

    const startedAt = Date.now()
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: normalizedContent,
      timestamp: startedAt,
      status: 'completed',
      callInfo: null
    }
    const assistantPlaceholder: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      timestamp: startedAt,
      status: 'pending',
      loading: true,
      callInfo: null
    }

    setSessions((current) =>
      current.map((session) =>
        session.id === activeSessionId
          ? {
              ...session,
              draftConfig: config,
              messagesLoaded: true,
              messages: [...session.messages, userMessage, assistantPlaceholder],
              messageCount: session.messageCount + 2,
              lastMessagePreview: normalizedContent,
              lastMessageRole: 'user',
              lastMessageAt: startedAt,
              updatedAt: startedAt
            }
          : session
      )
    )
    setSendingSessionId(activeSessionId)

    try {
      const payload = await sendConversationMessage(activeSessionId, {
        content: normalizedContent,
        draftConfig: config
      })
      const updated = normalizeChatSession(payload)
      setSessions((current) => upsertSessions(current, updated))
    } catch (error) {
      const detail = error instanceof Error ? error.message : '未知错误'
      const errorCallInfo = buildErrorCallInfo(config.strategy, Date.now() - startedAt)

      setSessions((current) =>
        current.map((session) =>
          session.id === activeSessionId
            ? {
                ...session,
                lastMessagePreview: `调用失败：${detail}`,
                lastMessageRole: 'assistant',
                lastMessageAt: Date.now(),
                updatedAt: Date.now(),
                messages: session.messages.map((message) =>
                  message.id === assistantPlaceholder.id
                    ? {
                        ...message,
                        content: `调用失败：${detail}`,
                        status: 'error',
                        loading: false,
                        errorMessage: detail,
                        callInfo: errorCallInfo
                      }
                    : message
                ),
                lastCallInfo: errorCallInfo
              }
            : session
        )
      )
    } finally {
      setSendingSessionId((current) => (current === activeSessionId ? null : current))
    }
  }

  return {
    activeSession,
    activeSessionId,
    clearChat,
    createSession,
    deleteSession,
    initializing,
    lastCallInfo: activeSession?.lastCallInfo ?? null,
    messages: activeSession?.messages ?? [],
    renameSession,
    saveDraftConfig,
    selectSession,
    sendChat,
    sessions,
    sending: sendingSessionId !== null
  }
}
