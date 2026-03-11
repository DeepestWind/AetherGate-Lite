import { useQuery } from '@tanstack/react-query'
import { normalizeDashboardMetrics } from '@/features/dashboard/dashboard-adapters'
import { dashboardQueryKeys } from '@/features/dashboard/dashboard-query-keys'
import { getMetrics } from '@/shared/api/modules/internal'
import { useApiAccessState } from '@/shared/auth/use-api-access'

export function useDashboardMetricsQuery() {
  const { canRequestApi } = useApiAccessState()

  return useQuery({
    queryKey: dashboardQueryKeys.metrics(),
    queryFn: async () => normalizeDashboardMetrics(await getMetrics()),
    enabled: canRequestApi,
    refetchInterval: canRequestApi ? 60_000 : false
  })
}
