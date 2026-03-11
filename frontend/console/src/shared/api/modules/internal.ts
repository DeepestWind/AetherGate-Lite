import { apiClient } from '@/shared/api/client'

export type LogsParams = {
  cacheHit?: boolean
  logicalModel?: string
  offset?: number
  page?: number
  promptId?: string
  size?: number
  status?: string
}

export async function getMetrics() {
  const response = await apiClient.get<unknown>('/internal/metrics')
  return response.data
}

export async function getStats(days = 7) {
  const response = await apiClient.get<unknown>('/internal/stats', {
    params: { days }
  })
  return response.data
}

export async function getLogs(params: LogsParams) {
  const size = params.size ?? 10
  const page = params.page ?? 0
  const response = await apiClient.get<unknown>('/internal/logs', {
    params: {
      limit: size,
      offset: params.offset ?? page * size,
      status: params.status,
      logical_model: params.logicalModel,
      prompt_id: params.promptId,
      cache_hit: params.cacheHit
    }
  })
  return response.data
}
