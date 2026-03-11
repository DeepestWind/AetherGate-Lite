import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { buildCreateEndpointPayload } from '@/features/endpoints/endpoint-adapters'
import { endpointQueryKeys } from '@/features/endpoints/endpoint-query-keys'
import type { EndpointFormValues } from '@/features/endpoints/endpoint-types'
import { createEndpoint } from '@/shared/api/modules/endpoints'

export function useCreateEndpointMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (values: EndpointFormValues) =>
      createEndpoint(buildCreateEndpointPayload(values)),
    onSuccess: async () => {
      toast.success('Endpoint 已保存，后台验证中')
      await queryClient.invalidateQueries({ queryKey: endpointQueryKeys.list() })
    }
  })
}
