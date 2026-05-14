import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { buildUpdatePromptPayload } from '@/features/prompts/prompt-adapters'
import { promptQueryKeys } from '@/features/prompts/prompt-query-keys'
import type { PromptFormValues } from '@/features/prompts/prompt-types'
import { updatePromptTemplate } from '@/shared/api/modules/prompts'

type UpdatePromptMutationInput = {
  id: number
  values: PromptFormValues
}

export function useUpdatePromptMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ id, values }: UpdatePromptMutationInput) =>
      updatePromptTemplate(id, buildUpdatePromptPayload(values)),
    onSuccess: async () => {
      toast.success('Prompt 模板已更新')
      await queryClient.invalidateQueries({ queryKey: promptQueryKeys.list() })
    }
  })
}
