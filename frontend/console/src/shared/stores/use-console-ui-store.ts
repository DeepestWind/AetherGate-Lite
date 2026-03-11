import { create } from 'zustand'

type NavGroupKey = 'chat' | 'control'
type ThemeMode = 'light' | 'dark' | 'system'

type ConsoleUiState = {
  mobileNavOpen: boolean
  navGroupsCollapsed: Record<NavGroupKey, boolean>
  sidebarCollapsed: boolean
  setMobileNavOpen: (open: boolean) => void
  setThemeMode: (value: ThemeMode) => void
  themeMode: ThemeMode
  toggleNavGroup: (group: NavGroupKey) => void
  toggleSidebar: () => void
}

export const useConsoleUiStore = create<ConsoleUiState>((set) => ({
  mobileNavOpen: false,
  navGroupsCollapsed: {
    chat: false,
    control: false
  },
  sidebarCollapsed: false,
  themeMode: 'light',
  setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
  setThemeMode: (value) => set({ themeMode: value }),
  toggleNavGroup: (group) =>
    set((state) => ({
      navGroupsCollapsed: {
        ...state.navGroupsCollapsed,
        [group]: !state.navGroupsCollapsed[group]
      }
    })),
  toggleSidebar: () =>
    set((state) => ({
      sidebarCollapsed: !state.sidebarCollapsed
    }))
}))
