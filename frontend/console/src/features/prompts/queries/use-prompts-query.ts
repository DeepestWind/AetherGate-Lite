import { useQuery } from '@tanstack/react-query'
import { normalizePromptTemplates } from '@/features/prompts/prompt-adapters'
import { promptQueryKeys } from '@/features/prompts/prompt-query-keys'
import { getPromptTemplates } from '@/shared/api/modules/prompts'
import { useApiAccessState } from '@/shared/auth/use-api-access'

export function usePromptsQuery() {
  const { canRequestApi } = useApiAccessState()

  return useQuery({
    queryKey: promptQueryKeys.list(),
    queryFn: async () => normalizePromptTemplates(await getPromptTemplates()),
    enabled: canRequestApi
  })
}
