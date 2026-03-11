import { useQuery } from '@tanstack/react-query'
import { normalizeEndpoints } from '@/features/endpoints/endpoint-adapters'
import { endpointQueryKeys } from '@/features/endpoints/endpoint-query-keys'
import { useApiAccessState } from '@/shared/auth/use-api-access'
import { getEndpoints } from '@/shared/api/modules/endpoints'

export function useEndpointsQuery() {
  const { canRequestApi } = useApiAccessState()

  return useQuery({
    queryKey: endpointQueryKeys.list(),
    queryFn: async () => normalizeEndpoints(await getEndpoints()),
    enabled: canRequestApi
  })
}
