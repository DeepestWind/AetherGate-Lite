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
