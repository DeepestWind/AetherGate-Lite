import { apiClient } from '@/shared/api/client'
import { env } from '@/shared/config/env'
import { useSessionStore } from '@/shared/stores/use-session-store'

type SendChatPayload = {
  messages: Array<{ content: string; role: string }>
  model: string
  promptId?: string
  strategy?: string
  temperature?: number
  promptVariables?: Record<string, string>
}

type ChatConversationConfigPayload = {
  model: string
  promptId: string
  strategy: string
  temperature: number
  variables: Record<string, string>
}

type ChatConversationMessageEditPayload = {
  content: string
  id: string
}

type StreamOptions = {
  onEvent: (event: unknown) => void
  signal?: AbortSignal
}

function buildApiUrl(path: string) {
  const baseUrl = env.apiBaseUrl.trim()
  if (!baseUrl) {
    return path
  }

  return `${baseUrl.replace(/\/$/, '')}${path}`
}

function parseSseBlock(block: string) {
  const normalizedBlock = block.replace(/\r\n/g, '\n')
  const lines = normalizedBlock.split('\n')
  let eventName = ''
  const dataLines: string[] = []

  for (const line of lines) {
    if (line.startsWith('event:')) {
      eventName = line.slice(6).trim()
      continue
    }
    if (line.startsWith('data:')) {
      dataLines.push(line.slice(5).trim())
    }
  }

  if (!eventName || dataLines.length === 0) {
    return null
  }

  const rawData = dataLines.join('\n')
  return {
    eventName,
    payload: JSON.parse(rawData)
  }
}

async function streamChatRequest(path: string, body: unknown, options: StreamOptions) {
  const token = useSessionStore.getState().token.trim()
  const response = await fetch(buildApiUrl(path), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body),
    signal: options.signal
  })

  if (!response.ok) {
    throw new Error((await response.text()) || '请求失败，请稍后重试')
  }

  if (!response.body) {
    throw new Error('流式响应不可用')
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { value, done } = await reader.read()
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done }).replace(/\r\n/g, '\n')

    let boundaryIndex = buffer.indexOf('\n\n')
    while (boundaryIndex !== -1) {
      const block = buffer.slice(0, boundaryIndex)
      buffer = buffer.slice(boundaryIndex + 2)
      const parsed = parseSseBlock(block)
      if (parsed) {
        options.onEvent({
          kind: parsed.eventName,
          ...parsed.payload
        })
      }
      boundaryIndex = buffer.indexOf('\n\n')
    }

    if (done) {
      const tail = buffer.trim()
      if (tail) {
        const parsed = parseSseBlock(tail)
        if (parsed) {
          options.onEvent({
            kind: parsed.eventName,
            ...parsed.payload
          })
        }
      }
      break
    }
  }
}

export async function sendChatMessage(payload: SendChatPayload) {
  const response = await apiClient.post<unknown>('/v1/chat/completions', {
    messages: payload.messages,
    temperature: payload.temperature ?? 0,
    strategy: payload.strategy,
    model: payload.model,
    prompt_id: payload.promptId,
    prompt_variables: payload.promptVariables
  })

  return {
    data: response.data,
    headers: response.headers
  }
}

export async function getAvailableModels() {
  const response = await apiClient.get<unknown>('/v1/models')
  return response.data
}

export async function listChatConversations() {
  const response = await apiClient.get<unknown>('/api/chat/conversations')
  return response.data
}

export async function createChatConversation(draftConfig: ChatConversationConfigPayload) {
  const response = await apiClient.post<unknown>('/api/chat/conversations', {
    draft_config: {
      model: draftConfig.model,
      prompt_id: draftConfig.promptId,
      strategy: draftConfig.strategy,
      temperature: draftConfig.temperature,
      variables: draftConfig.variables
    }
  })
  return response.data
}

export async function getChatConversation(conversationId: string) {
  const response = await apiClient.get<unknown>(`/api/chat/conversations/${conversationId}`)
  return response.data
}

export async function updateChatConversationConfig(
  conversationId: string,
  draftConfig: ChatConversationConfigPayload
) {
  const response = await apiClient.put<unknown>(
    `/api/chat/conversations/${conversationId}/config`,
    {
      draft_config: {
        model: draftConfig.model,
        prompt_id: draftConfig.promptId,
        strategy: draftConfig.strategy,
        temperature: draftConfig.temperature,
        variables: draftConfig.variables
      }
    }
  )
  return response.data
}

export async function renameChatConversation(conversationId: string, title: string) {
  const response = await apiClient.patch<unknown>(`/api/chat/conversations/${conversationId}`, {
    title
  })
  return response.data
}

export async function deleteChatConversation(conversationId: string) {
  await apiClient.delete(`/api/chat/conversations/${conversationId}`)
}

export async function sendConversationMessage(
  conversationId: string,
  payload: { content: string; draftConfig: ChatConversationConfigPayload }
) {
  const response = await apiClient.post<unknown>(
    `/api/chat/conversations/${conversationId}/messages`,
    {
      content: payload.content,
      draft_config: {
        model: payload.draftConfig.model,
        prompt_id: payload.draftConfig.promptId,
        strategy: payload.draftConfig.strategy,
        temperature: payload.draftConfig.temperature,
        variables: payload.draftConfig.variables
      }
    }
  )
  return response.data
}

export async function streamConversationMessage(
  conversationId: string,
  payload: { content: string; draftConfig: ChatConversationConfigPayload },
  options: StreamOptions
) {
  return streamChatRequest(`/api/chat/conversations/${conversationId}/messages/stream`, {
    content: payload.content,
    draft_config: {
      model: payload.draftConfig.model,
      prompt_id: payload.draftConfig.promptId,
      strategy: payload.draftConfig.strategy,
      temperature: payload.draftConfig.temperature,
      variables: payload.draftConfig.variables
    }
  }, options)
}

export async function sendConversationMessageWithEdits(
  conversationId: string,
  payload: {
    content: string
    draftConfig: ChatConversationConfigPayload
    modifiedNodes: ChatConversationMessageEditPayload[]
  }
) {
  const response = await apiClient.post<unknown>(
    `/api/chat/conversations/${conversationId}/messages/commit`,
    {
      content: payload.content,
      draft_config: {
        model: payload.draftConfig.model,
        prompt_id: payload.draftConfig.promptId,
        strategy: payload.draftConfig.strategy,
        temperature: payload.draftConfig.temperature,
        variables: payload.draftConfig.variables
      },
      modified_nodes: payload.modifiedNodes.map((item) => ({
        id: item.id,
        content: item.content
      }))
    }
  )
  return response.data
}

export async function streamConversationMessageWithEdits(
  conversationId: string,
  payload: {
    content: string
    draftConfig: ChatConversationConfigPayload
    modifiedNodes: ChatConversationMessageEditPayload[]
  },
  options: StreamOptions
) {
  return streamChatRequest(`/api/chat/conversations/${conversationId}/messages/commit/stream`, {
    content: payload.content,
    draft_config: {
      model: payload.draftConfig.model,
      prompt_id: payload.draftConfig.promptId,
      strategy: payload.draftConfig.strategy,
      temperature: payload.draftConfig.temperature,
      variables: payload.draftConfig.variables
    },
    modified_nodes: payload.modifiedNodes.map((item) => ({
      id: item.id,
      content: item.content
    }))
  }, options)
}

export async function editConversationMessageInBranch(
  conversationId: string,
  messageId: string,
  payload: {
    content: string
    draftConfig: ChatConversationConfigPayload
  }
) {
  const response = await apiClient.post<unknown>(
    `/api/chat/conversations/${conversationId}/messages/${messageId}/branch-edit`,
    {
      content: payload.content,
      draft_config: {
        model: payload.draftConfig.model,
        prompt_id: payload.draftConfig.promptId,
        strategy: payload.draftConfig.strategy,
        temperature: payload.draftConfig.temperature,
        variables: payload.draftConfig.variables
      }
    }
  )
  return response.data
}

export async function streamEditConversationMessageInBranch(
  conversationId: string,
  messageId: string,
  payload: {
    content: string
    draftConfig: ChatConversationConfigPayload
  },
  options: StreamOptions
) {
  return streamChatRequest(
    `/api/chat/conversations/${conversationId}/messages/${messageId}/branch-edit/stream`,
    {
      content: payload.content,
      draft_config: {
        model: payload.draftConfig.model,
        prompt_id: payload.draftConfig.promptId,
        strategy: payload.draftConfig.strategy,
        temperature: payload.draftConfig.temperature,
        variables: payload.draftConfig.variables
      }
    },
    options
  )
}

export async function regenerateConversationMessage(
  conversationId: string,
  messageId: string,
  payload: {
    draftConfig: ChatConversationConfigPayload
    modifiedNodes: ChatConversationMessageEditPayload[]
  }
) {
  const response = await apiClient.post<unknown>(
    `/api/chat/conversations/${conversationId}/messages/${messageId}/regenerate`,
    {
      draft_config: {
        model: payload.draftConfig.model,
        prompt_id: payload.draftConfig.promptId,
        strategy: payload.draftConfig.strategy,
        temperature: payload.draftConfig.temperature,
        variables: payload.draftConfig.variables
      },
      modified_nodes: payload.modifiedNodes.map((item) => ({
        id: item.id,
        content: item.content
      }))
    }
  )
  return response.data
}

export async function streamRegenerateConversationMessage(
  conversationId: string,
  messageId: string,
  payload: {
    draftConfig: ChatConversationConfigPayload
    modifiedNodes: ChatConversationMessageEditPayload[]
  },
  options: StreamOptions
) {
  return streamChatRequest(
    `/api/chat/conversations/${conversationId}/messages/${messageId}/regenerate/stream`,
    {
      draft_config: {
        model: payload.draftConfig.model,
        prompt_id: payload.draftConfig.promptId,
        strategy: payload.draftConfig.strategy,
        temperature: payload.draftConfig.temperature,
        variables: payload.draftConfig.variables
      },
      modified_nodes: payload.modifiedNodes.map((item) => ({
        id: item.id,
        content: item.content
      }))
    },
    options
  )
}

export async function selectConversationMessage(conversationId: string, messageId: string) {
  const response = await apiClient.post<unknown>(
    `/api/chat/conversations/${conversationId}/messages/${messageId}/select`
  )
  return response.data
}

export async function updateConversationMessagePin(
  conversationId: string,
  messageId: string,
  pinned: boolean
) {
  const response = await apiClient.patch<unknown>(
    `/api/chat/conversations/${conversationId}/messages/${messageId}/pin`,
    { pinned }
  )
  return response.data
}

export async function stopConversationMessageGeneration(conversationId: string, messageId: string) {
  await apiClient.post(`/api/chat/conversations/${conversationId}/messages/${messageId}/stop`)
}

export async function createConversationBranch(
  conversationId: string,
  payload: {
    baseMessageId: string
    name?: string
  }
) {
  const response = await apiClient.post<unknown>(
    `/api/chat/conversations/${conversationId}/branches`,
    {
      base_message_id: payload.baseMessageId,
      name: payload.name
    }
  )
  return response.data
}

export async function activateConversationBranch(conversationId: string, branchId: string) {
  const response = await apiClient.post<unknown>(
    `/api/chat/conversations/${conversationId}/branches/${branchId}/activate`
  )
  return response.data
}
