import { create } from 'zustand'
import type { ChatConfig } from '@/features/chat/chat-types'

type ChatUiState = {
  config: ChatConfig
  inputDraft: string
  resetVariables: () => void
  setConfigField: <K extends keyof ChatConfig>(key: K, value: ChatConfig[K]) => void
  setInputDraft: (value: string) => void
  setVariables: (variables: Record<string, string>) => void
}

export const useChatUiStore = create<ChatUiState>((set) => ({
  config: {
    strategy: 'balanced',
    model: '',
    promptId: '',
    temperature: 0,
    variables: {}
  },
  inputDraft: '',
  setInputDraft: (value) => set({ inputDraft: value }),
  setConfigField: (key, value) =>
    set((state) => ({
      config: {
        ...state.config,
        [key]: value
      }
    })),
  setVariables: (variables) =>
    set((state) => ({
      config: {
        ...state.config,
        variables
      }
    })),
  resetVariables: () =>
    set((state) => ({
      config: {
        ...state.config,
        variables: {}
      }
    }))
}))
