import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { endpointQueryKeys } from '@/features/endpoints/endpoint-query-keys'
import { deleteEndpoint } from '@/shared/api/modules/endpoints'

export function useDeleteEndpointMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) => deleteEndpoint(id),
    onSuccess: async () => {
      toast.success('Endpoint 已删除')
      await queryClient.invalidateQueries({ queryKey: endpointQueryKeys.list() })
    }
  })
}
