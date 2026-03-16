import { act, renderHook, waitFor } from '@testing-library/react'
import type { ChatConfig } from '@/features/chat/chat-types'
import { useChatSession } from '@/features/chat/hooks/use-chat-session'
import {
  createChatConversation,
  deleteChatConversation,
  getChatConversation,
  listChatConversations,
  renameChatConversation,
  sendConversationMessage,
  updateChatConversationConfig
} from '@/shared/api/modules/chat'

vi.mock('@/shared/api/modules/chat', () => ({
  createChatConversation: vi.fn(),
  deleteChatConversation: vi.fn(),
  getChatConversation: vi.fn(),
  listChatConversations: vi.fn(),
  renameChatConversation: vi.fn(),
  sendConversationMessage: vi.fn(),
  updateChatConversationConfig: vi.fn()
}))

function createDeferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((nextResolve) => {
    resolve = nextResolve
  })

  return { promise, resolve }
}

const draftConfig: ChatConfig = {
  model: 'gpt-lite',
  promptId: '',
  strategy: 'balanced',
  temperature: 0,
  variables: {}
}

describe('useChatSession', () => {
  beforeEach(() => {
    vi.mocked(listChatConversations).mockResolvedValue([
      {
        id: 'conv_1',
        title: '手动标题',
        draft_config: {
          model: 'gpt-lite',
          prompt_id: '',
          strategy: 'balanced',
          temperature: 0,
          variables: {}
        },
        last_message_at: null,
        last_message_preview: null,
        last_message_role: null,
        message_count: 0,
        created_at: 1000,
        updated_at: 1000
      }
    ])
    vi.mocked(getChatConversation).mockResolvedValue({
      id: 'conv_1',
      title: '手动标题',
      draft_config: {
        model: 'gpt-lite',
        prompt_id: '',
        strategy: 'balanced',
        temperature: 0,
        variables: {}
      },
      last_message_at: null,
      last_message_preview: null,
      last_message_role: null,
      message_count: 0,
      created_at: 1000,
      updated_at: 1000,
      messages: []
    })
    vi.mocked(createChatConversation).mockResolvedValue({
      id: 'conv_1',
      title: '手动标题',
      draft_config: {
        model: 'gpt-lite',
        prompt_id: '',
        strategy: 'balanced',
        temperature: 0,
        variables: {}
      },
      last_message_at: null,
      last_message_preview: null,
      last_message_role: null,
      message_count: 0,
      created_at: 1000,
      updated_at: 1000,
      messages: []
    })
    vi.mocked(updateChatConversationConfig).mockResolvedValue({
      id: 'conv_1',
      title: '手动标题',
      draft_config: {
        model: 'gpt-lite',
        prompt_id: '',
        strategy: 'balanced',
        temperature: 0,
        variables: {}
      },
      last_message_at: null,
      last_message_preview: null,
      last_message_role: null,
      message_count: 0,
      created_at: 1000,
      updated_at: 1000
    })
    vi.mocked(deleteChatConversation).mockResolvedValue(undefined)
    vi.mocked(renameChatConversation).mockResolvedValue({
      id: 'conv_1',
      title: '新的标题',
      draft_config: {
        model: 'gpt-lite',
        prompt_id: '',
        strategy: 'balanced',
        temperature: 0,
        variables: {}
      },
      last_message_at: null,
      last_message_preview: null,
      last_message_role: null,
      message_count: 0,
      created_at: 1000,
      updated_at: 1000
    })
    vi.mocked(sendConversationMessage).mockResolvedValue({
      id: 'conv_1',
      title: '手动标题',
      draft_config: {
        model: 'gpt-lite',
        prompt_id: '',
        strategy: 'balanced',
        temperature: 0,
        variables: {}
      },
      last_message_at: 2000,
      last_message_preview: '回复',
      last_message_role: 'assistant',
      message_count: 2,
      created_at: 1000,
      updated_at: 2000,
      messages: [
        {
          id: 'msg_1',
          role: 'user',
          content: '第一条消息',
          status: 'completed',
          timestamp: 1500
        },
        {
          id: 'msg_2',
          role: 'assistant',
          content: '回复',
          status: 'completed',
          timestamp: 2000
        }
      ]
    })
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  it('renames the active session', async () => {
    const { result } = renderHook(() => useChatSession(true))

    await waitFor(() => {
      expect(result.current.activeSession?.id).toBe('conv_1')
    })

    await act(async () => {
      await result.current.renameSession('conv_1', '新的标题')
    })

    expect(renameChatConversation).toHaveBeenCalledWith('conv_1', '新的标题')
    expect(result.current.activeSession?.title).toBe('新的标题')
  })

  it('does not overwrite a manual title while the first message is pending', async () => {
    const deferred = createDeferred<unknown>()
    vi.mocked(sendConversationMessage).mockReturnValueOnce(deferred.promise)

    const { result } = renderHook(() => useChatSession(true))

    await waitFor(() => {
      expect(result.current.activeSession?.id).toBe('conv_1')
    })

    act(() => {
      void result.current.sendChat('第一条消息', draftConfig)
    })

    await waitFor(() => {
      expect(result.current.activeSession?.messageCount).toBe(2)
    })

    expect(result.current.activeSession?.title).toBe('手动标题')

    await act(async () => {
      deferred.resolve({
        id: 'conv_1',
        title: '手动标题',
        draft_config: {
          model: 'gpt-lite',
          prompt_id: '',
          strategy: 'balanced',
          temperature: 0,
          variables: {}
        },
        last_message_at: 2000,
        last_message_preview: '回复',
        last_message_role: 'assistant',
        message_count: 2,
        created_at: 1000,
        updated_at: 2000,
        messages: [
          {
            id: 'msg_1',
            role: 'user',
            content: '第一条消息',
            status: 'completed',
            timestamp: 1500
          },
          {
            id: 'msg_2',
            role: 'assistant',
            content: '回复',
            status: 'completed',
            timestamp: 2000
          }
        ]
      })
      await deferred.promise
    })

    expect(result.current.activeSession?.title).toBe('手动标题')
  })
})
