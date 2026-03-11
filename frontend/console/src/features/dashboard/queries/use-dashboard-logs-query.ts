import { useQuery } from '@tanstack/react-query'
import { normalizeDashboardLogsPage } from '@/features/dashboard/dashboard-adapters'
import { dashboardQueryKeys } from '@/features/dashboard/dashboard-query-keys'
import { useApiAccessState } from '@/shared/auth/use-api-access'
import type { LogsParams } from '@/shared/api/modules/internal'
import { getLogs } from '@/shared/api/modules/internal'

export function useDashboardLogsQuery(params: LogsParams) {
  const { canRequestApi } = useApiAccessState()

  return useQuery({
    queryKey: dashboardQueryKeys.logs(params),
    queryFn: async () => normalizeDashboardLogsPage(await getLogs(params)),
    enabled: canRequestApi,
    refetchInterval: canRequestApi ? 60_000 : false
  })
}
