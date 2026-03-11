import { useSessionStore } from '@/shared/stores/use-session-store'

export function useApiAccessState() {
  const hasHydrated = useSessionStore((state) => state.hasHydrated)
  const token = useSessionStore((state) => state.token)
  const hasToken = token.trim().length > 0

  return {
    hasHydrated,
    hasToken,
    canRequestApi: hasHydrated && hasToken
  }
}
