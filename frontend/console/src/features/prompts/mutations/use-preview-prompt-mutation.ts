import { useMutation } from '@tanstack/react-query'
import { normalizePromptPreview } from '@/features/prompts/prompt-adapters'
import { previewPromptTemplate } from '@/shared/api/modules/prompts'

type PreviewPromptMutationInput = {
  id: number
  variables: Record<string, string>
}

export function usePreviewPromptMutation() {
  return useMutation({
    mutationFn: async ({ id, variables }: PreviewPromptMutationInput) =>
      normalizePromptPreview(await previewPromptTemplate(id, { variables }))
  })
}

