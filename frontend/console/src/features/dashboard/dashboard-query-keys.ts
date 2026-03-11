import type { LogsParams } from '@/shared/api/modules/internal'

export const dashboardQueryKeys = {
  all: ['dashboard'] as const,
  metrics: () => [...dashboardQueryKeys.all, 'metrics'] as const,
  stats: (days: number) => [...dashboardQueryKeys.all, 'stats', days] as const,
  logs: (params: LogsParams) => [...dashboardQueryKeys.all, 'logs', params] as const
}
