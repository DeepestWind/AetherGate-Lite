import { useQuery } from '@tanstack/react-query'
import { normalizeDashboardStats } from '@/features/dashboard/dashboard-adapters'
import { dashboardQueryKeys } from '@/features/dashboard/dashboard-query-keys'
import { getStats } from '@/shared/api/modules/internal'
import { useApiAccessState } from '@/shared/auth/use-api-access'

export function useDashboardStatsQuery(days = 7) {
  const { canRequestApi } = useApiAccessState()

  return useQuery({
    queryKey: dashboardQueryKeys.stats(days),
    queryFn: async () => normalizeDashboardStats(await getStats(days)),
    enabled: canRequestApi,
    refetchInterval: canRequestApi ? 60_000 : false
  })
}
