import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { buildUpdateEndpointPayload } from '@/features/endpoints/endpoint-adapters'
import { endpointQueryKeys } from '@/features/endpoints/endpoint-query-keys'
import type { EndpointFormValues, ProviderType } from '@/features/endpoints/endpoint-types'
import { updateEndpoint } from '@/shared/api/modules/endpoints'

type UpdateEndpointMutationInput = {
  id: number
  providerType: ProviderType
  values: EndpointFormValues
}

export function useUpdateEndpointMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, providerType: _, values }: UpdateEndpointMutationInput) =>
      updateEndpoint(id, buildUpdateEndpointPayload(values)),
    onSuccess: async () => {
      toast.success('Endpoint 已更新')
      await queryClient.invalidateQueries({ queryKey: endpointQueryKeys.list() })
    }
  })
}
