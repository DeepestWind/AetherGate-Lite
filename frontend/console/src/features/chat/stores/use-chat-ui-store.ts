import { create } from 'zustand'
import { defaultChatConfig, type ChatConfig } from '@/features/chat/chat-types'

type ChatUiState = {
  config: ChatConfig
  inputDraft: string
  resetVariables: () => void
  setConfig: (config: ChatConfig) => void
  setConfigField: <K extends keyof ChatConfig>(key: K, value: ChatConfig[K]) => void
  setInputDraft: (value: string) => void
  setVariables: (variables: Record<string, string>) => void
}

export const useChatUiStore = create<ChatUiState>((set) => ({
  config: { ...defaultChatConfig },
  inputDraft: '',
  setConfig: (config) => set({ config }),
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
