import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { promptQueryKeys } from '@/features/prompts/prompt-query-keys'
import { deletePromptTemplate } from '@/shared/api/modules/prompts'

export function useDeletePromptMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: number) => deletePromptTemplate(id),
    onSuccess: async () => {
      toast.success('Prompt 模板已删除')
      await queryClient.invalidateQueries({ queryKey: promptQueryKeys.list() })
    }
  })
}

