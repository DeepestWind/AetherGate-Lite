import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { endpointQueryKeys } from '@/features/endpoints/endpoint-query-keys'
import { setEndpointEnabled } from '@/shared/api/modules/endpoints'

type ToggleEndpointMutationInput = {
  enabled: boolean
  id: number
}

export function useToggleEndpointMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, enabled }: ToggleEndpointMutationInput) =>
      setEndpointEnabled(id, enabled),
    onSuccess: async (_, variables) => {
      toast.success(variables.enabled ? 'Endpoint 已启用' : 'Endpoint 已禁用')
      await queryClient.invalidateQueries({ queryKey: endpointQueryKeys.list() })
    }
  })
}
