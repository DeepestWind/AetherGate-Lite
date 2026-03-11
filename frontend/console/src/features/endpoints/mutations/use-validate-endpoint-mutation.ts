import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { endpointQueryKeys } from '@/features/endpoints/endpoint-query-keys'
import { validateEndpoint } from '@/shared/api/modules/endpoints'

export function useValidateEndpointMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) => validateEndpoint(id),
    onSuccess: async () => {
      toast.success('验证完成，状态已更新')
      await queryClient.invalidateQueries({ queryKey: endpointQueryKeys.list() })
    }
  })
}
