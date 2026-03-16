import { create } from 'zustand'

type ThemeMode = 'light' | 'dark' | 'system'

type ConsoleUiState = {
  collapseSidebar: () => void
  expandSidebar: () => void
  mobileNavOpen: boolean
  setSidebarCollapsed: (collapsed: boolean) => void
  sidebarCollapsed: boolean
  setMobileNavOpen: (open: boolean) => void
  setThemeMode: (value: ThemeMode) => void
  themeMode: ThemeMode
  toggleMobileNav: () => void
  toggleSidebar: () => void
}

export const useConsoleUiStore = create<ConsoleUiState>((set) => ({
  collapseSidebar: () => set({ sidebarCollapsed: true }),
  expandSidebar: () => set({ sidebarCollapsed: false }),
  mobileNavOpen: false,
  setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
  sidebarCollapsed: false,
  themeMode: 'light',
  setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
  setThemeMode: (value) => set({ themeMode: value }),
  toggleMobileNav: () =>
    set((state) => ({
      mobileNavOpen: !state.mobileNavOpen
    })),
  toggleSidebar: () =>
    set((state) => ({
      sidebarCollapsed: !state.sidebarCollapsed
    }))
}))
