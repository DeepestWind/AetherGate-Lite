import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  getActiveChatBranch,
  normalizeChatSession,
  normalizeChatSessions,
  normalizeChatStreamEvent,
  resolveChatSessionGraph
} from '@/features/chat/chat-adapters'
import {
  type ChatBranch,
  type ChatCallInfo,
  type ChatConfig,
  type ChatMessage,
  type ChatSession,
  type ChatStreamEvent,
  defaultChatConfig
} from '@/features/chat/chat-types'
import {
  activateConversationBranch,
  createChatConversation,
  createConversationBranch,
  deleteChatConversation,
  getChatConversation,
  listChatConversations,
  renameChatConversation,
  selectConversationMessage,
  stopConversationMessageGeneration,
  streamConversationMessage,
  streamConversationMessageWithEdits,
  streamEditConversationMessageInBranch,
  streamRegenerateConversationMessage,
  updateChatConversationConfig,
  updateConversationMessagePin
} from '@/shared/api/modules/chat'

type UseChatSessionResult = {
  activeSession: ChatSession | null
  activeSessionId: string | null
  commitMessageEdit: (
    messageId: string,
    content: string,
    config: ChatConfig
  ) => Promise<'buffered' | 'branch_assistant' | 'branch_user'>
  createSession: (config: ChatConfig) => Promise<void>
  deleteSession: (sessionId: string) => Promise<void>
  initializing: boolean
  lastCallInfo: ChatCallInfo | null
  messages: ChatMessage[]
  pendingEditCount: number
  pendingEdits: Record<string, string>
  clearPendingEdit: (messageId: string) => void
  createBranch: (baseMessageId: string, name?: string) => Promise<void>
  regenerateAssistantMessage: (messageId: string, config: ChatConfig) => Promise<void>
  renameSession: (sessionId: string, title: string) => Promise<void>
  saveDraftConfig: (config: ChatConfig) => Promise<void>
  selectAssistantMessage: (messageId: string) => Promise<void>
  selectBranch: (branchId: string) => Promise<void>
  selectSession: (sessionId: string) => Promise<void>
  setPendingEdit: (messageId: string, content: string) => void
  sendChat: (content: string, config: ChatConfig) => Promise<void>
  stopChat: () => Promise<void>
  sessions: ChatSession[]
  sending: boolean
  toggleMessagePin: (messageId: string, pinned: boolean) => Promise<void>
}

type PendingEditsBySession = Record<string, Record<string, string>>
type AssistantPreviewSelectionsBySession = Record<string, Record<string, Record<string, string>>>
type ActiveStreamState = {
  assistantMessageId: string | null
  controller: AbortController
  sessionId: string
  stopRequested: boolean
  tempAssistantMessageId: string | null
  tempUserMessageId: string | null
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

function buildSessionGraph(
  session: Omit<ChatSession, 'activeBranch' | 'lastCallInfo' | 'messages'> & {
    messages?: ChatMessage[]
  }
) {
  return resolveChatSessionGraph({
    ...session,
    messagesSource: session.messagesSource ?? 'graph'
  })
}

function mergeSessionState(
  currentSession: ChatSession | undefined,
  incoming: ChatSession
): ChatSession {
  if (
    currentSession?.messagesLoaded &&
    incoming.messagesLoaded &&
    incoming.messageCount < currentSession.messageCount
  ) {
    return currentSession
  }

  const shouldPreserveGraph = !incoming.messagesLoaded && Boolean(currentSession?.messagesLoaded)
  const messagesLoaded = shouldPreserveGraph
    ? (currentSession?.messagesLoaded ?? false)
    : incoming.messagesLoaded
  const activeBranchId = shouldPreserveGraph
    ? (currentSession?.activeBranchId ?? incoming.activeBranchId)
    : incoming.activeBranchId
  const branches = shouldPreserveGraph ? (currentSession?.branches ?? []) : incoming.branches
  const messageNodes = shouldPreserveGraph
    ? (currentSession?.messageNodes ?? {})
    : incoming.messageNodes
  const messagesSource = shouldPreserveGraph
    ? (currentSession?.messagesSource ?? 'graph')
    : (incoming.messagesSource ?? 'graph')

  return buildSessionGraph({
    ...currentSession,
    ...incoming,
    activeBranchId,
    branches,
    messageNodes,
    messagesSource,
    messagesLoaded,
    messages: shouldPreserveGraph ? (currentSession?.messages ?? []) : incoming.messages
  })
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

function getSessionPendingEdits(
  pendingEditsBySession: PendingEditsBySession,
  sessionId: string | null
) {
  if (!sessionId) {
    return {}
  }

  return pendingEditsBySession[sessionId] ?? {}
}

function getBranchAssistantPreviewSelections(
  previewsBySession: AssistantPreviewSelectionsBySession,
  sessionId: string | null,
  branchId: string | null
) {
  if (!sessionId || !branchId) {
    return {}
  }

  return previewsBySession[sessionId]?.[branchId] ?? {}
}

function applyAssistantVariantPreviews(
  messages: ChatMessage[],
  messageNodes: Record<string, ChatMessage>,
  previewSelections: Record<string, string>,
  activeHeadMessageId: string | null
) {
  return messages.map((message) => {
    if (message.role !== 'assistant' || !message.parentId || message.id === activeHeadMessageId) {
      return message
    }

    const previewMessageId = previewSelections[message.parentId]
    if (!previewMessageId || previewMessageId === message.id) {
      return message
    }

    const previewMessage = messageNodes[previewMessageId]
    if (
      !previewMessage ||
      previewMessage.role !== 'assistant' ||
      previewMessage.parentId !== message.parentId
    ) {
      return message
    }

    return previewMessage
  })
}

function getActivePathAssistantMessageIdForParent(session: ChatSession, parentId: string) {
  return (
    session.messages.find(
      (message) => message.role === 'assistant' && message.parentId === parentId
    )?.id ?? null
  )
}

function isLeafAssistantGroup(session: ChatSession, messageId: string) {
  const targetMessage = session.messageNodes[messageId]
  if (!targetMessage || targetMessage.role !== 'assistant' || !targetMessage.parentId) {
    return false
  }

  const headMessageId = session.activeBranch?.headMessageId
  if (!headMessageId) {
    return false
  }

  const headMessage = session.messageNodes[headMessageId]
  return headMessage?.role === 'assistant' && headMessage.parentId === targetMessage.parentId
}

function findLatestAssistantSibling(messageNodes: Record<string, ChatMessage>, parentId: string) {
  const siblings = Object.values(messageNodes).filter(
    (message) => message.role === 'assistant' && message.parentId === parentId && !message.archived
  )
  if (siblings.length === 0) {
    return null
  }

  return (
    [...siblings].sort((left, right) => {
      if (left.timestamp !== right.timestamp) {
        return right.timestamp - left.timestamp
      }
      return right.id.localeCompare(left.id)
    })[0] ?? null
  )
}

function hasVisibleChildMessage(messageNodes: Record<string, ChatMessage>, messageId: string) {
  return Object.values(messageNodes).some(
    (message) => message.parentId === messageId && !message.archived
  )
}

function applyPendingEditsToMessages(
  messages: ChatMessage[],
  pendingEdits: Record<string, string>
): ChatMessage[] {
  return messages.map((message) => {
    const pendingContent = pendingEdits[message.id]
    if (pendingContent === undefined) {
      if (!message.pendingEdit && message.originalContent === undefined) {
        return message
      }

      return {
        ...message,
        pendingEdit: false,
        originalContent: null
      }
    }

    return {
      ...message,
      content: pendingContent,
      pendingEdit: true,
      originalContent: message.content
    }
  })
}

function buildModifiedNodesPayload(pendingEdits: Record<string, string>) {
  return Object.entries(pendingEdits).map(([id, content]) => ({
    id,
    content
  }))
}

function setBranchAssistantPreviewSelection(
  current: AssistantPreviewSelectionsBySession,
  sessionId: string,
  branchId: string,
  parentId: string,
  messageId: string | null
) {
  const currentSessionSelections = current[sessionId] ?? {}
  const currentBranchSelections = currentSessionSelections[branchId] ?? {}

  if (messageId === null) {
    if (!(parentId in currentBranchSelections)) {
      return current
    }

    const nextBranchSelections = { ...currentBranchSelections }
    delete nextBranchSelections[parentId]

    if (Object.keys(nextBranchSelections).length === 0) {
      const nextSessionSelections = { ...currentSessionSelections }
      delete nextSessionSelections[branchId]

      if (Object.keys(nextSessionSelections).length === 0) {
        const next = { ...current }
        delete next[sessionId]
        return next
      }

      return {
        ...current,
        [sessionId]: nextSessionSelections
      }
    }

    return {
      ...current,
      [sessionId]: {
        ...currentSessionSelections,
        [branchId]: nextBranchSelections
      }
    }
  }

  return {
    ...current,
    [sessionId]: {
      ...currentSessionSelections,
      [branchId]: {
        ...currentBranchSelections,
        [parentId]: messageId
      }
    }
  }
}

export function useChatSession(enabled = true): UseChatSessionResult {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [initializing, setInitializing] = useState(true)
  const [assistantPreviewSelectionsBySession, setAssistantPreviewSelectionsBySession] =
    useState<AssistantPreviewSelectionsBySession>({})
  const [pendingEditsBySession, setPendingEditsBySession] = useState<PendingEditsBySession>({})
  const [sendingSessionId, setSendingSessionId] = useState<string | null>(null)
  const activeStreamRef = useRef<ActiveStreamState | null>(null)

  const activeSession = useMemo(
    () => sessions.find((session) => session.id === activeSessionId) ?? null,
    [activeSessionId, sessions]
  )
  const pendingEdits = useMemo(
    () => getSessionPendingEdits(pendingEditsBySession, activeSessionId),
    [activeSessionId, pendingEditsBySession]
  )
  const assistantPreviewSelections = useMemo(
    () =>
      getBranchAssistantPreviewSelections(
        assistantPreviewSelectionsBySession,
        activeSessionId,
        activeSession?.activeBranchId ?? null
      ),
    [activeSession?.activeBranchId, activeSessionId, assistantPreviewSelectionsBySession]
  )
  const previewedMessages = useMemo(
    () =>
      applyAssistantVariantPreviews(
        activeSession?.messages ?? [],
        activeSession?.messageNodes ?? {},
        assistantPreviewSelections,
        activeSession?.activeBranch?.headMessageId ?? null
      ),
    [
      activeSession?.activeBranch?.headMessageId,
      activeSession?.messageNodes,
      activeSession?.messages,
      assistantPreviewSelections
    ]
  )
  const messages = useMemo(
    () => applyPendingEditsToMessages(previewedMessages, pendingEdits),
    [pendingEdits, previewedMessages]
  )

  const loadConversationDetail = useCallback(async (conversationId: string) => {
    const payload = await getChatConversation(conversationId)
    const detail = normalizeChatSession(payload)
    setSessions((current) => upsertSessions(current, detail))
    return detail
  }, [])

  async function runStreamingRequest({
    request,
    sessionId,
    startedAt,
    strategy,
    tempAssistantMessageId = null,
    tempUserMessageId = null
  }: {
    request: (options: { onEvent: (event: unknown) => void; signal: AbortSignal }) => Promise<void>
    sessionId: string
    startedAt: number
    strategy: ChatConfig['strategy']
    tempAssistantMessageId?: string | null
    tempUserMessageId?: string | null
  }): Promise<ChatSession | null> {
    const controller = new AbortController()
    let finalSession: ChatSession | null = null
    activeStreamRef.current = {
      assistantMessageId: null,
      controller,
      sessionId,
      stopRequested: false,
      tempAssistantMessageId,
      tempUserMessageId
    }
    setSendingSessionId(sessionId)

    try {
      await request({
        signal: controller.signal,
        onEvent: (rawEvent) => {
          const event = normalizeChatStreamEvent(rawEvent)
          if (!event) {
            return
          }

          if (event.kind === 'message.created') {
            if (activeStreamRef.current?.controller === controller) {
              activeStreamRef.current = {
                ...activeStreamRef.current,
                assistantMessageId: event.assistantMessageId
              }
            }
            setSessions((current) =>
              current.map((session) =>
                session.id === sessionId
                  ? applyStreamCreated(session, event, tempUserMessageId, tempAssistantMessageId)
                  : session
              )
            )
            return
          }

          if (event.kind === 'message.delta') {
            setSessions((current) =>
              current.map((session) =>
                session.id === sessionId
                  ? applyStreamDelta(session, event.assistantMessageId, event.content)
                  : session
              )
            )
            return
          }

          if (
            event.kind === 'message.completed' ||
            event.kind === 'message.error' ||
            event.kind === 'message.stopped'
          ) {
            if (event.conversation) {
              const updated = normalizeChatSession(event.conversation)
              finalSession = updated
              setSessions((current) => upsertSessions(current, updated))
            }
          }
        }
      })
    } catch (error) {
      const detail = error instanceof Error ? error.message : '未知错误'
      const errorCallInfo = buildErrorCallInfo(strategy, Date.now() - startedAt)

      if (tempAssistantMessageId) {
        setSessions((current) =>
          current.map((session) =>
            session.id === sessionId
              ? applyOptimisticError(session, tempAssistantMessageId, detail, errorCallInfo)
              : session
          )
        )
      }
      throw error
    } finally {
      if (activeStreamRef.current?.controller === controller) {
        activeStreamRef.current = null
      }
      setSendingSessionId((current) => (current === sessionId ? null : current))
    }

    return finalSession
  }

  useEffect(() => {
    if (!enabled) {
      setSessions([])
      setActiveSessionId(null)
      setAssistantPreviewSelectionsBySession({})
      setPendingEditsBySession({})
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
    setAssistantPreviewSelectionsBySession((current) => {
      if (!(sessionId in current)) {
        return current
      }

      const next = { ...current }
      delete next[sessionId]
      return next
    })
    setPendingEditsBySession((current) => {
      if (!(sessionId in current)) {
        return current
      }

      const next = { ...current }
      delete next[sessionId]
      return next
    })

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

  function setPendingEdit(messageId: string, content: string) {
    if (!activeSessionId || !activeSession) {
      return
    }

    const originalContent =
      activeSession.messageNodes[messageId]?.content ??
      activeSession.messages.find((message) => message.id === messageId)?.content

    if (originalContent === undefined) {
      return
    }

    setPendingEditsBySession((current) => {
      const currentSessionEdits = current[activeSessionId] ?? {}
      if (content === originalContent) {
        if (!(messageId in currentSessionEdits)) {
          return current
        }

        const nextSessionEdits = { ...currentSessionEdits }
        delete nextSessionEdits[messageId]

        if (Object.keys(nextSessionEdits).length === 0) {
          const next = { ...current }
          delete next[activeSessionId]
          return next
        }

        return {
          ...current,
          [activeSessionId]: nextSessionEdits
        }
      }

      return {
        ...current,
        [activeSessionId]: {
          ...currentSessionEdits,
          [messageId]: content
        }
      }
    })
  }

  async function commitMessageEdit(messageId: string, content: string, config: ChatConfig) {
    if (!activeSessionId || !activeSession) {
      return 'buffered' as const
    }

    const targetMessage =
      activeSession.messageNodes[messageId] ??
      activeSession.messages.find((message) => message.id === messageId)
    const normalizedContent = content.trim()

    if (!targetMessage || !normalizedContent) {
      return 'buffered' as const
    }

    if (normalizedContent === targetMessage.content) {
      clearPendingEdit(messageId)
      return 'buffered' as const
    }

    if (!hasVisibleChildMessage(activeSession.messageNodes, messageId)) {
      setPendingEdit(messageId, normalizedContent)
      return 'buffered' as const
    }

    if (sendingSessionId) {
      return targetMessage.role === 'user' ? 'branch_user' : 'branch_assistant'
    }

    const streamedSession = await runStreamingRequest({
      sessionId: activeSessionId,
      startedAt: Date.now(),
      strategy: config.strategy,
      request: ({ onEvent, signal }) =>
        streamEditConversationMessageInBranch(
          activeSessionId,
          messageId,
          {
            content: normalizedContent,
            draftConfig: config
          },
          { onEvent, signal }
        )
    })
    if (!streamedSession) {
      const updated = await loadConversationDetail(activeSessionId)
      setSessions((current) => upsertSessions(current, updated))
    }
    setPendingEditsBySession((current) => {
      const currentSessionEdits = current[activeSessionId]
      if (!currentSessionEdits || !(messageId in currentSessionEdits)) {
        return current
      }

      const nextSessionEdits = { ...currentSessionEdits }
      delete nextSessionEdits[messageId]

      if (Object.keys(nextSessionEdits).length === 0) {
        const next = { ...current }
        delete next[activeSessionId]
        return next
      }

      return {
        ...current,
        [activeSessionId]: nextSessionEdits
      }
    })
    return targetMessage.role === 'user' ? 'branch_user' : 'branch_assistant'
  }

  function clearPendingEdit(messageId: string) {
    if (!activeSessionId) {
      return
    }

    setPendingEditsBySession((current) => {
      const currentSessionEdits = current[activeSessionId]
      if (!currentSessionEdits || !(messageId in currentSessionEdits)) {
        return current
      }

      const nextSessionEdits = { ...currentSessionEdits }
      delete nextSessionEdits[messageId]

      if (Object.keys(nextSessionEdits).length === 0) {
        const next = { ...current }
        delete next[activeSessionId]
        return next
      }

      return {
        ...current,
        [activeSessionId]: nextSessionEdits
      }
    })
  }

  async function createBranch(baseMessageId: string, name?: string) {
    if (!activeSessionId || sendingSessionId) {
      return
    }

    const payload = await createConversationBranch(activeSessionId, {
      baseMessageId,
      name
    })
    const updated = normalizeChatSession(payload)
    setSessions((current) => upsertSessions(current, updated))
  }

  async function selectBranch(branchId: string) {
    if (!activeSessionId || sendingSessionId) {
      return
    }

    const payload = await activateConversationBranch(activeSessionId, branchId)
    const updated = normalizeChatSession(payload)
    setSessions((current) => upsertSessions(current, updated))
  }

  async function toggleMessagePin(messageId: string, pinned: boolean) {
    if (!activeSessionId || sendingSessionId) {
      return
    }

    const payload = await updateConversationMessagePin(activeSessionId, messageId, pinned)
    const updated = normalizeChatSession(payload)
    setSessions((current) => upsertSessions(current, updated))
  }

  async function stopChat() {
    const activeStream = activeStreamRef.current
    if (!activeStream?.assistantMessageId) {
      return
    }

    activeStreamRef.current = {
      ...activeStream,
      stopRequested: true
    }
    await stopConversationMessageGeneration(activeStream.sessionId, activeStream.assistantMessageId)
  }

  async function regenerateAssistantMessage(messageId: string, config: ChatConfig) {
    if (!activeSessionId || sendingSessionId || !activeSession) {
      return
    }

    const targetMessage = activeSession.messageNodes[messageId]
    if (!targetMessage || targetMessage.role !== 'assistant' || !targetMessage.parentId) {
      return
    }

    const parentId = targetMessage.parentId
    const activeBranchId = activeSession.activeBranchId
    const leafAssistantGroup = isLeafAssistantGroup(activeSession, messageId)
    const modifiedNodes = buildModifiedNodesPayload(pendingEdits)

    const streamedSession = await runStreamingRequest({
      sessionId: activeSessionId,
      startedAt: Date.now(),
      strategy: config.strategy,
      request: ({ onEvent, signal }) =>
        streamRegenerateConversationMessage(
          activeSessionId,
          messageId,
          {
            draftConfig: config,
            modifiedNodes
          },
          { onEvent, signal }
        )
    })
    const refreshed = streamedSession ?? (await loadConversationDetail(activeSessionId))
    if (!leafAssistantGroup && activeBranchId) {
      const newestSibling = findLatestAssistantSibling(refreshed.messageNodes, parentId)
      if (newestSibling) {
        setAssistantPreviewSelectionsBySession((current) =>
          setBranchAssistantPreviewSelection(
            current,
            activeSessionId,
            activeBranchId,
            parentId,
            newestSibling.id
          )
        )
      }
    }
    if (modifiedNodes.length > 0) {
      setPendingEditsBySession((current) => {
        if (!(activeSessionId in current)) {
          return current
        }

        const next = { ...current }
        delete next[activeSessionId]
        return next
      })
    }
  }

  async function selectAssistantMessage(messageId: string) {
    if (!activeSessionId || !activeSession) {
      return
    }

    const targetMessage = activeSession.messageNodes[messageId]
    if (!targetMessage || targetMessage.role !== 'assistant' || !targetMessage.parentId) {
      return
    }

    const parentId = targetMessage.parentId
    const activeBranchId = activeSession.activeBranchId
    if (!activeBranchId) {
      return
    }

    if (!isLeafAssistantGroup(activeSession, messageId)) {
      const activePathMessageId = getActivePathAssistantMessageIdForParent(activeSession, parentId)
      setAssistantPreviewSelectionsBySession((current) =>
        setBranchAssistantPreviewSelection(
          current,
          activeSessionId,
          activeBranchId,
          parentId,
          activePathMessageId === messageId ? null : messageId
        )
      )
      return
    }

    const payload = await selectConversationMessage(activeSessionId, messageId)
    const updated = normalizeChatSession(payload)
    setSessions((current) => upsertSessions(current, updated))
    setAssistantPreviewSelectionsBySession((current) =>
      setBranchAssistantPreviewSelection(current, activeSessionId, activeBranchId, parentId, null)
    )
  }

  async function sendChat(content: string, config: ChatConfig) {
    if (!activeSessionId || sendingSessionId) {
      return
    }

    const normalizedContent = content.trim()
    if (!normalizedContent) {
      return
    }
    const modifiedNodes = buildModifiedNodesPayload(pendingEdits)

    const startedAt = Date.now()
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: normalizedContent,
      timestamp: startedAt,
      status: 'completed',
      parentId: null,
      modifiedFrom: null,
      pinned: false,
      archived: false,
      stale: false,
      callInfo: null
    }
    const assistantPlaceholder: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'assistant',
      content: '',
      timestamp: startedAt,
      status: 'pending',
      loading: true,
      parentId: userMessage.id,
      modifiedFrom: null,
      pinned: false,
      archived: false,
      stale: false,
      callInfo: null
    }

    setSessions((current) =>
      current.map((session) =>
        session.id === activeSessionId
          ? appendOptimisticMessages(session, config, userMessage, assistantPlaceholder, startedAt)
          : session
      )
    )

    try {
      const streamedSession = await runStreamingRequest({
        sessionId: activeSessionId,
        startedAt,
        strategy: config.strategy,
        tempAssistantMessageId: assistantPlaceholder.id,
        tempUserMessageId: userMessage.id,
        request: ({ onEvent, signal }) =>
          modifiedNodes.length > 0
            ? streamConversationMessageWithEdits(
                activeSessionId,
                {
                  content: normalizedContent,
                  draftConfig: config,
                  modifiedNodes
                },
                { onEvent, signal }
              )
            : streamConversationMessage(
                activeSessionId,
                {
                  content: normalizedContent,
                  draftConfig: config
                },
                { onEvent, signal }
              )
      })
      const updated = streamedSession ?? (await loadConversationDetail(activeSessionId))
      if (modifiedNodes.length > 0) {
        setPendingEditsBySession((current) => {
          if (!(activeSessionId in current)) {
            return current
          }

          const next = { ...current }
          delete next[activeSessionId]
          return next
        })
      }
      setSessions((current) => upsertSessions(current, updated))
    } catch {
      // `runStreamingRequest` already projects an optimistic error when applicable.
    }
  }

  return {
    activeSession,
    activeSessionId,
    clearPendingEdit,
    commitMessageEdit,
    createBranch,
    createSession,
    deleteSession,
    initializing,
    lastCallInfo: activeSession?.lastCallInfo ?? null,
    messages,
    pendingEditCount: Object.keys(pendingEdits).length,
    pendingEdits,
    regenerateAssistantMessage,
    renameSession,
    saveDraftConfig,
    selectAssistantMessage,
    selectBranch,
    selectSession,
    setPendingEdit,
    sendChat,
    stopChat,
    sessions,
    sending: sendingSessionId !== null,
    toggleMessagePin
  }
}

function ensureActiveBranch(session: ChatSession): ChatBranch {
  const activeBranch = getActiveChatBranch(session.branches, session.activeBranchId)
  if (activeBranch) {
    return activeBranch
  }

  return {
    id: `branch-${session.id}`,
    name: 'main',
    headMessageId: null,
    baseMessageId: null
  }
}

function appendOptimisticMessages(
  session: ChatSession,
  config: ChatConfig,
  userMessage: ChatMessage,
  assistantPlaceholder: ChatMessage,
  startedAt: number
) {
  const activeBranch = ensureActiveBranch(session)
  const userNode = {
    kind: 'node' as const,
    ...userMessage,
    parentId: activeBranch.headMessageId
  }
  const assistantNode = {
    kind: 'node' as const,
    ...assistantPlaceholder,
    parentId: userNode.id
  }
  const nextBranches = (session.branches.length > 0 ? session.branches : [activeBranch]).map(
    (branch) =>
      branch.id === activeBranch.id
        ? {
            ...branch,
            baseMessageId: branch.baseMessageId ?? userNode.id,
            headMessageId: assistantPlaceholder.id
          }
        : branch
  )
  const nextMessageNodes = {
    ...session.messageNodes,
    [userNode.id]: userNode,
    [assistantPlaceholder.id]: assistantNode
  }
  const nextMessages =
    session.messagesSource === 'server'
      ? [...session.messages, userNode, assistantNode]
      : session.messages

  return buildSessionGraph({
    ...session,
    activeBranchId: activeBranch.id,
    branches: nextBranches,
    draftConfig: config,
    messageNodes: nextMessageNodes,
    messages: nextMessages,
    messagesLoaded: true,
    messageCount: session.messageCount + 2,
    lastMessagePreview: normalizedContentPreview(userNode.content),
    lastMessageRole: 'user',
    lastMessageAt: startedAt,
    updatedAt: startedAt
  })
}

function applyOptimisticError(
  session: ChatSession,
  assistantMessageId: string,
  detail: string,
  errorCallInfo: ChatCallInfo
) {
  const failedAt = Date.now()
  const assistantMessage = session.messageNodes[assistantMessageId]
  if (!assistantMessage) {
    return session
  }
  const nextAssistantMessage = {
    ...assistantMessage,
    content: `调用失败：${detail}`,
    status: 'error' as const,
    loading: false,
    errorMessage: detail,
    callInfo: errorCallInfo,
    timestamp: failedAt
  }
  const nextMessages =
    session.messagesSource === 'server'
      ? session.messages.map((message) =>
          message.id === assistantMessageId ? nextAssistantMessage : message
        )
      : session.messages

  return buildSessionGraph({
    ...session,
    messageNodes: {
      ...session.messageNodes,
      [assistantMessageId]: nextAssistantMessage
    },
    messages: nextMessages,
    lastMessagePreview: `调用失败：${detail}`,
    lastMessageRole: 'assistant',
    lastMessageAt: failedAt,
    updatedAt: failedAt
  })
}

function applyStreamCreated(
  session: ChatSession,
  event: Extract<ChatStreamEvent, { kind: 'message.created' }>,
  tempUserMessageId: string | null,
  tempAssistantMessageId: string | null
) {
  const nextMessageNodes = { ...session.messageNodes }
  let nextMessages = session.messages
  const activeBranch = ensureActiveBranch(session)

  if (
    tempUserMessageId &&
    tempAssistantMessageId &&
    nextMessageNodes[tempUserMessageId] &&
    nextMessageNodes[tempAssistantMessageId]
  ) {
    const userNode = nextMessageNodes[tempUserMessageId]
    const assistantNode = nextMessageNodes[tempAssistantMessageId]
    delete nextMessageNodes[tempUserMessageId]
    delete nextMessageNodes[tempAssistantMessageId]
    nextMessageNodes[event.userMessageId ?? event.assistantMessageId] = {
      ...userNode,
      id: event.userMessageId ?? userNode.id
    }
    nextMessageNodes[event.assistantMessageId] = {
      ...assistantNode,
      id: event.assistantMessageId,
      parentId: event.userMessageId ?? assistantNode.parentId
    }
    if (session.messagesSource === 'server') {
      nextMessages = session.messages.map((message) => {
        if (message.id === tempUserMessageId) {
          return {
            ...message,
            id: event.userMessageId ?? message.id,
            sourceNodeId: event.userMessageId ?? message.sourceNodeId ?? null
          }
        }
        if (message.id === tempAssistantMessageId) {
          return {
            ...message,
            id: event.assistantMessageId,
            parentId: event.userMessageId ?? message.parentId,
            sourceNodeId: event.assistantMessageId
          }
        }
        return message
      })
    }
  } else if (!nextMessageNodes[event.assistantMessageId]) {
    const parentId = event.userMessageId
    if (!parentId || !nextMessageNodes[parentId]) {
      return session
    }
    nextMessageNodes[event.assistantMessageId] = {
      id: event.assistantMessageId,
      kind: 'node',
      role: 'assistant',
      content: '',
      status: 'pending',
      timestamp: Date.now(),
      parentId,
      sourceNodeId: null,
      modifiedFrom: null,
      pinned: false,
      archived: false,
      stale: false,
      errorMessage: null,
      callInfo: null,
      loading: true
    }
    if (session.messagesSource === 'server') {
      nextMessages = [...session.messages, nextMessageNodes[event.assistantMessageId]]
    }
  }

  const targetBranchId = event.branchId ?? activeBranch.id
  const sourceBranches = session.branches.length > 0 ? session.branches : [activeBranch]
  let matchedBranch = false
  const nextBranches = sourceBranches.map((branch) => {
    if (branch.id !== targetBranchId && branch.id !== activeBranch.id) {
      return branch
    }

    matchedBranch = true
    return {
      ...branch,
      id: targetBranchId,
      headMessageId: event.assistantMessageId
    }
  })

  if (!matchedBranch) {
    nextBranches.push({
      id: targetBranchId,
      name: activeBranch.name,
      baseMessageId: activeBranch.baseMessageId,
      headMessageId: event.assistantMessageId
    })
  }

  return buildSessionGraph({
    ...session,
    activeBranchId: targetBranchId,
    branches: nextBranches,
    messageNodes: nextMessageNodes,
    messages: nextMessages,
    messagesLoaded: true
  })
}

function applyStreamDelta(session: ChatSession, assistantMessageId: string, content: string) {
  const assistantMessage = session.messageNodes[assistantMessageId]
  if (!assistantMessage) {
    return session
  }
  const nextAssistantMessage = {
    ...assistantMessage,
    content,
    loading: false,
    status: 'pending' as const,
    timestamp: Date.now()
  }
  const nextMessages =
    session.messagesSource === 'server'
      ? session.messages.map((message) =>
          message.id === assistantMessageId ? nextAssistantMessage : message
        )
      : session.messages

  return buildSessionGraph({
    ...session,
    messageNodes: {
      ...session.messageNodes,
      [assistantMessageId]: nextAssistantMessage
    },
    messages: nextMessages,
    lastMessagePreview: normalizedContentPreview(content || session.lastMessagePreview || ''),
    lastMessageRole: 'assistant',
    updatedAt: Date.now()
  })
}

function normalizedContentPreview(content: string) {
  const normalized = content.trim().replace(/\s+/g, ' ')
  if (normalized.length <= 120) {
    return normalized
  }

  return `${normalized.slice(0, 120)}…`
}
