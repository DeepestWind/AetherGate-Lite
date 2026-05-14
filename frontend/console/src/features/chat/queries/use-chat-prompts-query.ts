import { useQuery } from '@tanstack/react-query'
import { normalizePromptTemplates } from '@/features/chat/chat-adapters'
import { chatQueryKeys } from '@/features/chat/chat-query-keys'
import { getPromptTemplates } from '@/shared/api/modules/prompts'
import { useApiAccessState } from '@/shared/auth/use-api-access'

export function useChatPromptsQuery() {
  const { canRequestApi } = useApiAccessState()

  return useQuery({
    queryKey: chatQueryKeys.prompts(),
    queryFn: async () => normalizePromptTemplates(await getPromptTemplates()),
    enabled: canRequestApi
  })
}
