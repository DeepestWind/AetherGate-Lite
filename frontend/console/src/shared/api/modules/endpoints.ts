import { apiClient } from '@/shared/api/client'

export async function getEndpoints() {
  const response = await apiClient.get<unknown>('/api/endpoints')
  return response.data
}

export async function createEndpoint(data: unknown) {
  const response = await apiClient.post<unknown>('/api/endpoints', data)
  return response.data
}

export async function updateEndpoint(id: number, data: unknown) {
  const response = await apiClient.put<unknown>(`/api/endpoints/${id}`, data)
  return response.data
}

export async function setEndpointEnabled(id: number, enabled: boolean) {
  const response = await apiClient.put<unknown>(`/api/endpoints/${id}/enabled`, {
    is_enabled: enabled
  })
  return response.data
}

export async function deleteEndpoint(id: number) {
  const response = await apiClient.delete<unknown>(`/api/endpoints/${id}`)
  return response.data
}

export async function validateEndpoint(id: number) {
  const response = await apiClient.post<unknown>(`/api/endpoints/${id}/validate`)
  return response.data
}
