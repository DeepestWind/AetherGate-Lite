import { useQuery } from '@tanstack/react-query'
import { normalizeAvailableModels } from '@/features/chat/chat-adapters'
import { chatQueryKeys } from '@/features/chat/chat-query-keys'
import { getAvailableModels } from '@/shared/api/modules/chat'
import { useApiAccessState } from '@/shared/auth/use-api-access'

export function useChatModelsQuery() {
  const { canRequestApi } = useApiAccessState()

  return useQuery({
    queryKey: chatQueryKeys.models(),
    queryFn: async () => normalizeAvailableModels(await getAvailableModels()),
    enabled: canRequestApi
  })
}
