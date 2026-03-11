import { apiClient } from '@/shared/api/client'

export async function getPromptTemplates() {
  const response = await apiClient.get<unknown>('/api/prompts')
  return response.data
}

export async function createPromptTemplate(data: unknown) {
  const response = await apiClient.post<unknown>('/api/prompts', data)
  return response.data
}

export async function updatePromptTemplate(id: number, data: unknown) {
  const response = await apiClient.put<unknown>(`/api/prompts/${id}`, data)
  return response.data
}

export async function deletePromptTemplate(id: number) {
  const response = await apiClient.delete<unknown>(`/api/prompts/${id}`)
  return response.data
}

export async function previewPromptTemplate(id: number, data: unknown) {
  const response = await apiClient.post<unknown>(`/api/prompts/${id}/preview`, data)
  return response.data
}
