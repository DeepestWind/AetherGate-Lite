import { create } from 'zustand'

type ConsoleUiState = {
  collapseSidebar: () => void
  expandSidebar: () => void
  mobileNavOpen: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
  sidebarCollapsed: boolean
  setMobileNavOpen: (open: boolean) => void
  toggleMobileNav: () => void
  toggleSidebar: () => void
}

export const useConsoleUiStore = create<ConsoleUiState>((set) => ({
  collapseSidebar: () => set({ sidebarCollapsed: true }),
  expandSidebar: () => set({ sidebarCollapsed: false }),
  mobileNavOpen: false,
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  sidebarCollapsed: false,
  setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
  toggleMobileNav: () =>
    set((state) => ({
      mobileNavOpen: !state.mobileNavOpen
    })),
  toggleSidebar: () =>
    set((state) => ({
      sidebarCollapsed: !state.sidebarCollapsed
    }))
}))
