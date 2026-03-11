import { apiClient } from '@/shared/api/client'

type SendChatPayload = {
  messages: Array<{ content: string; role: string }>
  model: string
  promptId?: string
  strategy?: string
  temperature?: number
  promptVariables?: Record<string, string>
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
