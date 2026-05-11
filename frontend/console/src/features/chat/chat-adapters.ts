import {
  type ChatBranch,
  type ChatCallInfo,
  type ChatConfig,
  type ChatMessage,
  type ChatSession,
  type ChatStreamEvent,
  defaultChatConfig,
  type PromptTemplate,
  type TreeNode,
  type TreeNodeState
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
    provider: String(headers['x-branchat-provider'] ?? ''),
    model: String(readValue(response, ['model'], '')),
    routeReason: String(headers['x-branchat-route-reason'] ?? ''),
    cacheHit: String(headers['x-branchat-cache'] ?? '').toLowerCase() === 'hit',
    endpointId: String(headers['x-branchat-endpoint'] ?? ''),
    fallbackCount: toNumber(headers['x-branchat-fallbacks'], 0),
    latencyMs,
    promptTokens: toNumber(readValue(usage, ['promptTokens', 'prompt_tokens'], 0)),
    completionTokens: toNumber(readValue(usage, ['completionTokens', 'completion_tokens'], 0)),
    totalTokens: toNumber(readValue(usage, ['totalTokens', 'total_tokens'], 0)),
    costUsd: 0,
    strategy,
    status: toNumber(headers['x-branchat-fallbacks'], 0) > 0 ? 'fallback' : 'success'
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
  const content = String(readValue(row, ['content'], ''))
  const status = String(readValue(row, ['status'], 'completed')) as ChatMessage['status']

  return {
    id: String(readValue(row, ['id'], crypto.randomUUID())),
    kind: String(readValue(row, ['kind'], 'node')) as ChatMessage['kind'],
    role: String(readValue(row, ['role'], 'assistant')) as ChatMessage['role'],
    content,
    status,
    timestamp: toNumber(readValue(row, ['timestamp'], Date.now())),
    parentId:
      String(readValue(row, ['parentId', 'parent_id'], '')) || null,
    sourceNodeId:
      String(readValue(row, ['sourceNodeId', 'source_node_id'], '')) || null,
    modifiedFrom:
      String(readValue(row, ['modifiedFrom', 'modified_from'], '')) || null,
    pinned: Boolean(readValue(row, ['pinned'], false)),
    archived: Boolean(readValue(row, ['archived'], false)),
    stale: Boolean(readValue(row, ['stale'], false)),
    errorMessage: String(readValue(row, ['errorMessage', 'error_message'], '')) || null,
    callInfo: normalizeChatCallInfo(readValue(row, ['callInfo', 'call_info'], null)),
    loading: status === 'pending' && content.length === 0
  }
}

export function normalizeChatStreamEvent(payload: unknown): ChatStreamEvent | null {
  if (!isRecord(payload)) {
    return null
  }

  const kind = String(readValue(payload, ['kind', 'type'], ''))
  if (!kind) {
    return null
  }

  if (kind === 'message.created') {
    return {
      kind,
      assistantMessageId: String(readValue(payload, ['assistantMessageId'], '')),
      branchId: String(readValue(payload, ['branchId'], '')) || null,
      userMessageId: String(readValue(payload, ['userMessageId'], '')) || null
    }
  }

  if (kind === 'message.meta') {
    const meta = readValue(payload, ['meta'], {})
    if (!isRecord(meta)) {
      return null
    }
    return {
      kind,
      assistantMessageId: String(readValue(payload, ['assistantMessageId'], '')),
      meta: {
        requestId: String(readValue(meta, ['requestId', 'request_id'], '')),
        provider: String(readValue(meta, ['provider'], '')),
        model: String(readValue(meta, ['model'], '')),
        routeReason: String(readValue(meta, ['routeReason', 'route_reason'], '')),
        cacheHit: Boolean(readValue(meta, ['cacheHit', 'cache_hit'], false)),
        endpointId: String(readValue(meta, ['endpointId', 'endpoint_id'], '')),
        fallbackCount: toNumber(readValue(meta, ['fallbackCount', 'fallback_count'], 0)),
        strategy: String(readValue(meta, ['strategy'], defaultChatConfig.strategy)) as ChatConfig['strategy']
      }
    }
  }

  if (kind === 'message.delta') {
    return {
      kind,
      assistantMessageId: String(readValue(payload, ['assistantMessageId'], '')),
      content: String(readValue(payload, ['content'], '')),
      delta: String(readValue(payload, ['delta'], ''))
    }
  }

  if (kind === 'message.completed' || kind === 'message.error' || kind === 'message.stopped') {
    return {
      kind,
      assistantMessageId: String(readValue(payload, ['assistantMessageId'], '')),
      conversation: readValue(payload, ['conversation'], undefined),
      errorMessage: String(readValue(payload, ['errorMessage', 'error_message'], '')) || null
    }
  }

  return null
}

function normalizeVisibleChatMessage(
  payload: unknown,
  messageNodes: Record<string, ChatMessage>
): ChatMessage {
  const row = isRecord(payload) ? payload : {}
  const virtualId = String(readValue(row, ['virtualId', 'virtual_id', 'id'], crypto.randomUUID()))
  const kind = String(readValue(row, ['kind'], 'node')) as ChatMessage['kind']
  const sourceNodeId =
    String(readValue(row, ['sourceNodeId', 'source_node_id'], '')) || null
  const rawSourceNodeIds = row['source_node_ids'] ?? row['sourceNodeIds']
  const archivedNodeIds = Array.isArray(rawSourceNodeIds) ? (rawSourceNodeIds as string[]) : undefined

  if (kind === 'node' && sourceNodeId && messageNodes[sourceNodeId]) {
    const node = messageNodes[sourceNodeId]
    return {
      ...node,
      id: virtualId,
      kind: 'node',
      sourceNodeId,
      content: String(readValue(row, ['content'], node.content))
    }
  }

  return {
    id: virtualId,
    kind,
    role: String(readValue(row, ['role'], 'summary')) as ChatMessage['role'],
    content: String(readValue(row, ['content'], '')),
    status: 'completed',
    timestamp: toNumber(readValue(row, ['timestamp'], Date.now())),
    parentId: null,
    sourceNodeId,
    archivedNodeIds,
    modifiedFrom: null,
    pinned: false,
    archived: false,
    stale: false,
    errorMessage: null,
    callInfo: null,
    loading: false
  }
}

export function normalizeChatBranch(payload: unknown): ChatBranch {
  const row = isRecord(payload) ? payload : {}

  return {
    id: String(readValue(row, ['id'], crypto.randomUUID())),
    name: String(readValue(row, ['name'], 'main')),
    headMessageId: String(readValue(row, ['headMessageId', 'head_message_id'], '')) || null,
    baseMessageId: String(readValue(row, ['baseMessageId', 'base_message_id'], '')) || null
  }
}

export function getLastCallInfo(messages: ChatMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.callInfo) {
      return messages[index].callInfo
    }
  }

  return null
}

function normalizeMessageNodeMap(payload: unknown) {
  if (!isRecord(payload)) {
    return {}
  }

  return Object.fromEntries(
    Object.entries(payload).map(([messageId, value]) => {
      const normalized = normalizeChatMessage(
        isRecord(value)
          ? {
              ...value,
              id: readValue(value, ['id'], messageId)
            }
          : { id: messageId }
      )
      return [normalized.id, normalized]
    })
  ) as Record<string, ChatMessage>
}

function buildMessageNodeMap(messages: ChatMessage[]) {
  return Object.fromEntries(messages.map((message) => [message.id, message]))
}

export function getActiveChatBranch(
  branches: ChatBranch[],
  activeBranchId: string | null
): ChatBranch | null {
  if (activeBranchId) {
    const activeBranch = branches.find((branch) => branch.id === activeBranchId)
    if (activeBranch) {
      return activeBranch
    }
  }

  return branches[0] ?? null
}

export function flattenChatBranchMessages(
  messageNodes: Record<string, ChatMessage>,
  branches: ChatBranch[],
  activeBranchId: string | null,
  fallbackMessages: ChatMessage[] = []
) {
  const activeBranch = getActiveChatBranch(branches, activeBranchId)
  if (!activeBranch?.headMessageId) {
    return fallbackMessages
  }

  const messages: ChatMessage[] = []
  const visited = new Set<string>()
  let currentId: string | null = activeBranch.headMessageId

  while (currentId) {
    if (visited.has(currentId)) {
      break
    }

    const message: ChatMessage | undefined = messageNodes[currentId]
    if (!message) {
      break
    }

    if (!message.archived) {
      messages.push(message)
    }

    visited.add(currentId)
    currentId = message.parentId
  }

  if (messages.length === 0) {
    return fallbackMessages
  }

  return [...messages].reverse()
}

export function resolveChatSessionGraph(
  input: Omit<ChatSession, 'activeBranch' | 'lastCallInfo' | 'messages'> & {
    messages?: ChatMessage[]
  }
): ChatSession {
  const messages =
    input.messagesSource === 'server'
      ? input.messages ?? []
      : flattenChatBranchMessages(input.messageNodes, input.branches, input.activeBranchId, input.messages ?? [])
  const activeBranch = getActiveChatBranch(input.branches, input.activeBranchId)

  return {
    ...input,
    activeBranch,
    messages,
    lastCallInfo: getLastCallInfo(messages)
  }
}

export function normalizeChatSession(payload: unknown): ChatSession {
  const row = isRecord(payload) ? payload : {}
  const branches = Array.isArray(readValue(row, ['branches'], []))
    ? (readValue(row, ['branches'], []) as unknown[]).map(normalizeChatBranch)
    : []
  const messageNodes =
    Object.keys(normalizeMessageNodeMap(readValue(row, ['messageNodes', 'message_nodes'], {})))
      .length > 0
      ? normalizeMessageNodeMap(readValue(row, ['messageNodes', 'message_nodes'], {}))
      : buildMessageNodeMap(
          Array.isArray(readValue(row, ['messages'], []))
            ? (readValue(row, ['messages'], []) as unknown[]).map(normalizeChatMessage)
            : []
        )
  const hasVisibleMessages = Array.isArray(readValue(row, ['visibleMessages', 'visible_messages'], null))
  const visibleMessages = hasVisibleMessages
    ? (readValue(row, ['visibleMessages', 'visible_messages'], []) as unknown[]).map((item) =>
        normalizeVisibleChatMessage(item, messageNodes)
      )
    : []
  const fallbackMessages = Array.isArray(readValue(row, ['messages'], []))
    ? (readValue(row, ['messages'], []) as unknown[]).map(normalizeChatMessage)
    : []
  const activeBranchId =
    String(readValue(row, ['activeBranchId', 'active_branch_id'], '')) || null

  return resolveChatSessionGraph({
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
    activeBranchId,
    branches,
    messageCount: toNumber(
      readValue(row, ['messageCount', 'message_count'], fallbackMessages.length)
    ),
    createdAt: toNumber(readValue(row, ['createdAt', 'created_at'], Date.now())),
    updatedAt: toNumber(readValue(row, ['updatedAt', 'updated_at'], Date.now())),
    messagesSource: hasVisibleMessages ? 'server' : 'graph',
    messageNodes,
    messages: hasVisibleMessages ? visibleMessages : fallbackMessages,
    messagesLoaded:
      Array.isArray(readValue(row, ['messages'], null)) ||
      Array.isArray(readValue(row, ['visibleMessages', 'visible_messages'], null)) ||
      Array.isArray(readValue(row, ['branches'], null)) ||
      isRecord(readValue(row, ['messageNodes', 'message_nodes'], null))
  })
}

export function normalizeChatSessions(payload: unknown): ChatSession[] {
  const source = Array.isArray(payload) ? payload : []
  return source.map(normalizeChatSession)
}

type BuildTreeViewInput = {
  messageNodes: ChatMessage[] | Record<string, ChatMessage>
  visibleMessages: ChatMessage[]
  activeBranchHeadId: string | null
}

function truncatePreview(text: string, max: number): string {
  if (!text) return ''
  if (text.length <= max) return text
  return text.slice(0, max).trimEnd() + '…'
}

export function buildTreeView(input: BuildTreeViewInput): TreeNode[] {
  const { messageNodes, visibleMessages, activeBranchHeadId } = input
  const messageNodesArray = Array.isArray(messageNodes)
    ? messageNodes
    : Object.values(messageNodes)
  const byId = new Map(messageNodesArray.map((node) => [node.id, node]))

  // 1. Walk current branch path from head to root, collecting all node ids
  const currentPath = new Set<string>()
  let cursor: string | null = activeBranchHeadId
  while (cursor) {
    const node = byId.get(cursor)
    if (!node) break
    currentPath.add(node.id)
    cursor = node.parentId ?? null
  }

  // 2. Build map: parentId -> children[]
  const childrenByParent = new Map<string | null, ChatMessage[]>()
  for (const node of messageNodesArray) {
    const parent = node.parentId ?? null
    const list = childrenByParent.get(parent) ?? []
    list.push(node)
    childrenByParent.set(parent, list)
  }

  // 3. Classify each node's state; stale wins over current-path
  function classify(node: ChatMessage): TreeNodeState {
    if (node.stale) return 'stale'
    if (currentPath.has(node.id)) return 'current'
    return 'sibling'
  }

  // 4. Walk depth-first along current path; at each fork include direct siblings too.
  // Also include stale children of any current-path node (even if the path doesn't
  // continue through them) so they remain visible in the tree.
  const result: TreeNode[] = []
  function visit(parentId: string | null, depth: number) {
    const children = childrenByParent.get(parentId) ?? []
    const hasCurrentChild = children.some((c) => currentPath.has(c.id))
    for (const child of children) {
      const onCurrentPath = currentPath.has(child.id)
      // Include if: on the current path, a sibling at a fork, or a stale leaf
      // hanging off a current-path node (parentId is on currentPath)
      const parentOnCurrentPath = parentId !== null && currentPath.has(parentId)
      if (!onCurrentPath && !hasCurrentChild && !(child.stale && parentOnCurrentPath)) continue
      result.push({
        id: child.id,
        kind: 'node',
        role: child.role,
        parentId: child.parentId,
        state: classify(child),
        preview: truncatePreview(child.content, 40),
        depth
      })
      if (onCurrentPath) visit(child.id, depth + 1)
    }
  }
  visit(null, 0)

  // 5. Insert summary virtual nodes from visibleMessages
  for (let i = 0; i < visibleMessages.length; i++) {
    const visible = visibleMessages[i]
    if (visible.kind !== 'summary') continue

    // Find the sourceNodeId of the next non-summary visible message as the anchor
    let anchorNodeId: string | null = null
    for (let j = i + 1; j < visibleMessages.length; j++) {
      if (visibleMessages[j].kind !== 'summary') {
        anchorNodeId = visibleMessages[j].sourceNodeId ?? null
        break
      }
    }

    const anchorIndex = anchorNodeId
      ? result.findIndex((entry) => entry.id === anchorNodeId)
      : -1
    const insertAt = anchorIndex >= 0 ? anchorIndex : result.length

    result.splice(insertAt, 0, {
      id: visible.id,
      kind: 'summary',
      role: visible.role,
      parentId: null,
      state: 'current',
      preview: truncatePreview(visible.content ?? '', 40),
      depth: 0
    })
  }

  return result
}
