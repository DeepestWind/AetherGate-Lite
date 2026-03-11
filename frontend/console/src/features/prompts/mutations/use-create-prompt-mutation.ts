import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { buildCreatePromptPayload } from '@/features/prompts/prompt-adapters'
import { promptQueryKeys } from '@/features/prompts/prompt-query-keys'
import type { PromptFormValues } from '@/features/prompts/prompt-types'
import { createPromptTemplate } from '@/shared/api/modules/prompts'

export function useCreatePromptMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (values: PromptFormValues) =>
      createPromptTemplate(buildCreatePromptPayload(values)),
    onSuccess: async () => {
      toast.success('Prompt 模板已创建')
      await queryClient.invalidateQueries({ queryKey: promptQueryKeys.list() })
    }
  })
}

