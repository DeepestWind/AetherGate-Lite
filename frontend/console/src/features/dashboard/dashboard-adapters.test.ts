import {
  normalizeDashboardLogsPage,
  normalizeDashboardMetrics,
  normalizeDashboardStats
} from '@/features/dashboard/dashboard-adapters'

describe('dashboard adapters', () => {
  it('normalizes metrics payloads with fallback keys', () => {
    const result = normalizeDashboardMetrics({
      totalCalls: '12',
      cost_usd: '0.125',
      total_tokens: '2400',
      cache_hit_rate: '0.5',
      avg_latency_ms: '732',
      models: {
        'gpt-4o': 8,
        sonnet: 4
      }
    })

    expect(result.calls).toBe(12)
    expect(result.costUsd).toBe(0.125)
    expect(result.tokens).toBe(2400)
    expect(result.formattedCacheRate).toBe('50.0%')
    expect(result.modelDistribution[0]).toEqual({ name: 'gpt-4o', value: 8 })
  })

  it('normalizes daily stats payloads', () => {
    const result = normalizeDashboardStats({
      series: [
        {
          date: '2026-03-07',
          total_requests: 19,
          total_cost_usd: 0.22,
          total_tokens: 4096
        }
      ]
    })

    expect(result).toEqual([
      {
        statDate: '2026-03-07',
        dateLabel: '03/07',
        totalCalls: 19,
        totalCostUsd: 0.22,
        totalTokens: 4096
      }
    ])
  })

  it('normalizes paged logs payloads', () => {
    const result = normalizeDashboardLogsPage({
      items: [
        {
          requestId: 'req-1',
          actual_model: 'gpt-4o',
          total_tokens: '320',
          cost_usd: '0.0045',
          latency_ms: '680',
          cache_hit: 'true',
          status: 'success',
          fallback_count: 1,
          created_at: '2026-03-07T13:10:00'
        }
      ],
      total: 1
    })

    expect(result.content[0]).toEqual({
      id: 'req-1',
      timestamp: '2026-03-07T13:10:00',
      actualModel: 'gpt-4o',
      totalTokens: 320,
      costUsd: 0.0045,
      latencyMs: 680,
      cacheHit: true,
      status: 'fallback'
    })
    expect(result.totalPages).toBe(1)
  })
})
