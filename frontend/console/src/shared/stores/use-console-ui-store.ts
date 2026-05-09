import { create } from 'zustand'

type ConsoleUiState = {
  mobileNavOpen: boolean
  setMobileNavOpen: (open: boolean) => void
  toggleMobileNav: () => void

  chatLeftCollapsed: boolean
  chatRightCollapsed: boolean
  toggleChatLeft: () => void
  toggleChatRight: () => void
  setChatLeftCollapsed: (collapsed: boolean) => void
  setChatRightCollapsed: (collapsed: boolean) => void

  chatControlPanelOpen: boolean
  toggleChatControlPanel: () => void
  setChatControlPanelOpen: (open: boolean) => void
}

export const useConsoleUiStore = create<ConsoleUiState>((set) => ({
  mobileNavOpen: false,
  setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
  toggleMobileNav: () =>
    set((state) => ({
      mobileNavOpen: !state.mobileNavOpen
    })),

  chatLeftCollapsed: false,
  chatRightCollapsed: false,
  toggleChatLeft: () => set((state) => ({ chatLeftCollapsed: !state.chatLeftCollapsed })),
  toggleChatRight: () => set((state) => ({ chatRightCollapsed: !state.chatRightCollapsed })),
  setChatLeftCollapsed: (collapsed) => set({ chatLeftCollapsed: collapsed }),
  setChatRightCollapsed: (collapsed) => set({ chatRightCollapsed: collapsed }),

  chatControlPanelOpen: false,
  toggleChatControlPanel: () => set((state) => ({ chatControlPanelOpen: !state.chatControlPanelOpen })),
  setChatControlPanelOpen: (open) => set({ chatControlPanelOpen: open })
}))
