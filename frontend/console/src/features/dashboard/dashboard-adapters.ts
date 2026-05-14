import dayjs from 'dayjs'
import type {
  DashboardLogRow,
  DashboardLogsPage,
  DashboardMetrics,
  DashboardStatPoint
} from '@/features/dashboard/dashboard-types'

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

function toBoolean(value: unknown, fallback = false) {
  if (typeof value === 'boolean') {
    return value
  }

  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true' || normalized === '1') {
      return true
    }
    if (normalized === 'false' || normalized === '0') {
      return false
    }
  }

  if (typeof value === 'number') {
    return value === 1
  }

  return fallback
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function normalizeDashboardMetrics(payload: unknown): DashboardMetrics {
  const source = isRecord(payload) ? payload : {}
  const rawModels = readValue(source, ['modelDistribution', 'model_distribution', 'models'], {})
  const models = isRecord(rawModels) ? rawModels : {}

  const calls = toNumber(
    readValue(source, ['calls', 'totalCalls', 'totalRequests', 'total_requests'], 0)
  )
  const costUsd = toNumber(readValue(source, ['costUsd', 'cost_usd'], 0))
  const tokens = toNumber(readValue(source, ['tokens', 'totalTokens', 'total_tokens'], 0))
  const cacheHits = toNumber(readValue(source, ['cacheHits', 'cache_hits'], 0))
  const cacheHitRate = toNumber(
    readValue(source, ['cacheHitRate', 'cache_hit_rate'], calls > 0 ? cacheHits / calls : 0)
  )
  const avgLatencyMs = toNumber(
    readValue(source, ['avgLatencyMs', 'averageLatencyMs', 'average_latency_ms'], 0)
  )

  const modelDistribution = Object.entries(models)
    .map(([name, value]) => ({
      name,
      value: toNumber(value, 0)
    }))
    .sort((left, right) => right.value - left.value)

  return {
    calls,
    costUsd,
    tokens,
    cacheHitRate,
    avgLatencyMs,
    modelDistribution,
    formattedCalls: calls.toLocaleString(),
    formattedCost: `$${costUsd.toFixed(4)}`,
    formattedCacheRate: `${(cacheHitRate * 100).toFixed(1)}%`,
    formattedLatency: `${Math.round(avgLatencyMs)}ms`
  }
}

export function normalizeDashboardStats(payload: unknown): DashboardStatPoint[] {
  const source = Array.isArray(payload)
    ? payload
    : isRecord(payload) && Array.isArray(payload.series)
      ? payload.series
      : isRecord(payload) && Array.isArray(payload.content)
        ? payload.content
        : []

  return source.map((item) => {
    const row = isRecord(item) ? item : {}
    const statDate = String(readValue(row, ['statDate', 'stat_date', 'date'], ''))
    const parsedDate = dayjs(statDate)

    return {
      statDate,
      dateLabel: parsedDate.isValid() ? parsedDate.format('MM/DD') : '--/--',
      totalCalls: toNumber(
        readValue(
          row,
          ['totalCalls', 'total_calls', 'calls', 'requestCount', 'totalRequests', 'total_requests'],
          0
        )
      ),
      totalCostUsd: toNumber(
        readValue(row, ['totalCostUsd', 'total_cost_usd', 'costUsd', 'cost_usd'], 0)
      ),
      totalTokens: toNumber(readValue(row, ['totalTokens', 'total_tokens', 'tokens'], 0))
    }
  })
}

function normalizeDashboardLogRow(payload: unknown, index: number): DashboardLogRow {
  const row = isRecord(payload) ? payload : {}
  const fallbackCount = toNumber(readValue(row, ['fallbackCount', 'fallback_count'], 0))
  const rawStatus = String(readValue(row, ['status'], 'unknown'))

  return {
    id: readValue(row, ['id', 'requestId'], index) as number | string,
    timestamp: String(readValue(row, ['timestamp', 'createdAt', 'created_at'], '')),
    actualModel: String(readValue(row, ['actualModel', 'actual_model', 'model'], '-')),
    totalTokens: toNumber(readValue(row, ['totalTokens', 'total_tokens'], 0)),
    costUsd: toNumber(readValue(row, ['costUsd', 'cost_usd'], 0)),
    latencyMs: toNumber(readValue(row, ['latencyMs', 'latency_ms'], 0)),
    cacheHit: toBoolean(readValue(row, ['cacheHit', 'cache_hit'], false)),
    status: rawStatus === 'success' && fallbackCount > 0 ? 'fallback' : rawStatus
  }
}

export function normalizeDashboardLogsPage(payload: unknown): DashboardLogsPage {
  const source = isRecord(payload) ? payload : {}
  const items = Array.isArray(source.items)
    ? source.items
    : Array.isArray(source.content)
      ? source.content
      : []
  const content = items.map((item, index) => normalizeDashboardLogRow(item, index))
  const totalElements = toNumber(
    readValue(source, ['totalElements', 'total_elements', 'total'], content.length)
  )
  const size = toNumber(readValue(source, ['size'], content.length || 10), content.length || 10)
  const page = toNumber(readValue(source, ['page'], 0))
  const totalPages = size > 0 ? Math.max(1, Math.ceil(totalElements / size)) : 1

  return {
    content,
    page,
    size,
    totalElements,
    totalPages,
    first: page <= 0,
    last: page >= totalPages - 1
  }
}
