export type DashboardMetrics = {
  avgLatencyMs: number
  cacheHitRate: number
  calls: number
  costUsd: number
  formattedCacheRate: string
  formattedCalls: string
  formattedCost: string
  formattedLatency: string
  modelDistribution: Array<{ name: string; value: number }>
  tokens: number
}

export type DashboardStatPoint = {
  dateLabel: string
  statDate: string
  totalCalls: number
  totalCostUsd: number
  totalTokens: number
}

export type DashboardLogRow = {
  actualModel: string
  cacheHit: boolean
  costUsd: number
  id: number | string
  latencyMs: number
  status: string
  timestamp: string
  totalTokens: number
}

export type DashboardLogsPage = {
  content: DashboardLogRow[]
  first: boolean
  last: boolean
  page: number
  size: number
  totalElements: number
  totalPages: number
}
