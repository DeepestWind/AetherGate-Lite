import { create } from 'zustand'

type ConsoleUiState = {
  mobileNavOpen: boolean
  setMobileNavOpen: (open: boolean) => void
  toggleMobileNav: () => void
}

export const useConsoleUiStore = create<ConsoleUiState>((set) => ({
  mobileNavOpen: false,
  setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
  toggleMobileNav: () =>
    set((state) => ({
      mobileNavOpen: !state.mobileNavOpen
    }))
}))
