import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { env } from '@/shared/config/env'

const defaultToken = env.defaultToken.trim()

type SessionState = {
  hasHydrated: boolean
  token: string
  markHydrated: () => void
  setToken: (token: string) => void
  clearToken: () => void
}

export const useSessionStore = create<SessionState>()(
  persist(
    (set) => ({
      hasHydrated: false,
      token: defaultToken,
      markHydrated: () => set({ hasHydrated: true }),
      setToken: (token) => set({ token: token.trim() }),
      clearToken: () => set({ token: '' })
    }),
    {
      name: 'aethergate-lite-session',
      onRehydrateStorage: () => (state) => {
        if (defaultToken) {
          state?.setToken(defaultToken)
        }
        state?.markHydrated()
      }
    }
  )
)
