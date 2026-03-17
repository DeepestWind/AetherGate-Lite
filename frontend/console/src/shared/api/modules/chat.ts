import { apiClient } from '@/shared/api/client'

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
