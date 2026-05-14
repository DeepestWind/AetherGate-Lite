import { act, renderHook, waitFor } from '@testing-library/react'
import type { ChatConfig } from '@/features/chat/chat-types'
import { useChatSession } from '@/features/chat/hooks/use-chat-session'
import {
  activateConversationBranch,
  createChatConversation,
  createConversationBranch,
  deleteChatConversation,
  editConversationMessageInBranch,
  getChatConversation,
  listChatConversations,
  regenerateConversationMessage,
  renameChatConversation,
  selectConversationMessage,
  sendConversationMessage,
  sendConversationMessageWithEdits,
  stopConversationMessageGeneration,
  streamConversationMessage,
  streamConversationMessageWithEdits,
  streamEditConversationMessageInBranch,
  streamRegenerateConversationMessage,
  updateChatConversationConfig,
  updateConversationMessagePin
} from '@/shared/api/modules/chat'

vi.mock('@/shared/api/modules/chat', () => ({
  createChatConversation: vi.fn(),
  createConversationBranch: vi.fn(),
  deleteChatConversation: vi.fn(),
  editConversationMessageInBranch: vi.fn(),
  getChatConversation: vi.fn(),
  listChatConversations: vi.fn(),
  activateConversationBranch: vi.fn(),
  regenerateConversationMessage: vi.fn(),
  renameChatConversation: vi.fn(),
  selectConversationMessage: vi.fn(),
  sendConversationMessage: vi.fn(),
  sendConversationMessageWithEdits: vi.fn(),
  stopConversationMessageGeneration: vi.fn(),
  streamConversationMessage: vi.fn(),
  streamConversationMessageWithEdits: vi.fn(),
  streamEditConversationMessageInBranch: vi.fn(),
  streamRegenerateConversationMessage: vi.fn(),
  updateConversationMessagePin: vi.fn(),
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

const mainBranch = {
  id: 'branch_main',
  name: 'main',
  head_message_id: null,
  base_message_id: null
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
        active_branch_id: 'branch_main',
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
      active_branch_id: 'branch_main',
      message_count: 0,
      created_at: 1000,
      updated_at: 1000,
      branches: [mainBranch],
      message_nodes: {},
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
      active_branch_id: 'branch_main',
      message_count: 0,
      created_at: 1000,
      updated_at: 1000,
      branches: [mainBranch],
      message_nodes: {},
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
      active_branch_id: 'branch_main',
      message_count: 0,
      created_at: 1000,
      updated_at: 1000
    })
    vi.mocked(updateConversationMessagePin).mockResolvedValue({
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
      active_branch_id: 'branch_main',
      message_count: 0,
      created_at: 1000,
      updated_at: 1000,
      branches: [mainBranch],
      message_nodes: {},
      messages: []
    })
    vi.mocked(editConversationMessageInBranch).mockResolvedValue({
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
      active_branch_id: 'branch_main',
      message_count: 0,
      created_at: 1000,
      updated_at: 1000,
      branches: [mainBranch],
      message_nodes: {},
      messages: []
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
      active_branch_id: 'branch_main',
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
      active_branch_id: 'branch_main',
      message_count: 2,
      created_at: 1000,
      updated_at: 2000,
      branches: [
        {
          id: 'branch_main',
          name: 'main',
          head_message_id: 'msg_2',
          base_message_id: 'msg_1'
        }
      ],
      message_nodes: {
        msg_1: {
          id: 'msg_1',
          role: 'user',
          content: '第一条消息',
          status: 'completed',
          timestamp: 1500,
          parent_id: null,
          pinned: false,
          archived: false,
          stale: false
        },
        msg_2: {
          id: 'msg_2',
          role: 'assistant',
          content: '回复',
          status: 'completed',
          timestamp: 2000,
          parent_id: 'msg_1',
          pinned: false,
          archived: false,
          stale: false
        }
      },
      messages: [
        {
          id: 'msg_1',
          role: 'user',
          content: '第一条消息',
          status: 'completed',
          timestamp: 1500,
          parent_id: null,
          pinned: false,
          archived: false,
          stale: false
        },
        {
          id: 'msg_2',
          role: 'assistant',
          content: '回复',
          status: 'completed',
          timestamp: 2000,
          parent_id: 'msg_1',
          pinned: false,
          archived: false,
          stale: false
        }
      ]
    })
    vi.mocked(sendConversationMessageWithEdits).mockResolvedValue({
      id: 'conv_1',
      title: '手动标题',
      draft_config: {
        model: 'gpt-lite',
        prompt_id: '',
        strategy: 'balanced',
        temperature: 0,
        variables: {}
      },
      last_message_at: 3000,
      last_message_preview: '改写后回复',
      last_message_role: 'assistant',
      active_branch_id: 'branch_main',
      message_count: 4,
      created_at: 1000,
      updated_at: 3000,
      branches: [
        {
          id: 'branch_main',
          name: 'main',
          head_message_id: 'msg_4',
          base_message_id: 'msg_1'
        }
      ],
      message_nodes: {
        msg_1: {
          id: 'msg_1',
          role: 'user',
          content: '改写后的第一条消息',
          status: 'completed',
          timestamp: 1500,
          parent_id: null,
          pinned: false,
          archived: false,
          stale: false
        },
        msg_2: {
          id: 'msg_2',
          role: 'assistant',
          content: '回复',
          status: 'completed',
          timestamp: 2000,
          parent_id: 'msg_1',
          pinned: false,
          archived: false,
          stale: false
        },
        msg_3: {
          id: 'msg_3',
          role: 'user',
          content: '继续',
          status: 'completed',
          timestamp: 2500,
          parent_id: 'msg_2',
          pinned: false,
          archived: false,
          stale: false
        },
        msg_4: {
          id: 'msg_4',
          role: 'assistant',
          content: '改写后回复',
          status: 'completed',
          timestamp: 3000,
          parent_id: 'msg_3',
          pinned: false,
          archived: false,
          stale: false
        }
      },
      messages: [
        {
          id: 'msg_1',
          role: 'user',
          content: '改写后的第一条消息',
          status: 'completed',
          timestamp: 1500,
          parent_id: null,
          pinned: false,
          archived: false,
          stale: false
        },
        {
          id: 'msg_2',
          role: 'assistant',
          content: '回复',
          status: 'completed',
          timestamp: 2000,
          parent_id: 'msg_1',
          pinned: false,
          archived: false,
          stale: false
        },
        {
          id: 'msg_3',
          role: 'user',
          content: '继续',
          status: 'completed',
          timestamp: 2500,
          parent_id: 'msg_2',
          pinned: false,
          archived: false,
          stale: false
        },
        {
          id: 'msg_4',
          role: 'assistant',
          content: '改写后回复',
          status: 'completed',
          timestamp: 3000,
          parent_id: 'msg_3',
          pinned: false,
          archived: false,
          stale: false
        }
      ]
    })
    vi.mocked(stopConversationMessageGeneration).mockResolvedValue(undefined)
    vi.mocked(streamConversationMessage).mockImplementation(
      async (conversationId, payload, options) => {
        const conversation = await sendConversationMessage(conversationId, payload)
        options.onEvent({
          kind: 'message.completed',
          conversation
        })
      }
    )
    vi.mocked(streamConversationMessageWithEdits).mockImplementation(
      async (conversationId, payload, options) => {
        const conversation = await sendConversationMessageWithEdits(conversationId, payload)
        options.onEvent({
          kind: 'message.completed',
          conversation
        })
      }
    )
    vi.mocked(streamEditConversationMessageInBranch).mockImplementation(
      async (conversationId, messageId, payload, options) => {
        const conversation = await editConversationMessageInBranch(
          conversationId,
          messageId,
          payload
        )
        options.onEvent({
          kind: 'message.completed',
          conversation
        })
      }
    )
    vi.mocked(streamRegenerateConversationMessage).mockImplementation(
      async (conversationId, messageId, payload, options) => {
        const conversation = await regenerateConversationMessage(conversationId, messageId, payload)
        options.onEvent({
          kind: 'message.completed',
          conversation
        })
      }
    )
    vi.mocked(regenerateConversationMessage).mockResolvedValue({
      id: 'conv_1',
      title: '手动标题',
      draft_config: {
        model: 'gpt-lite',
        prompt_id: '',
        strategy: 'balanced',
        temperature: 0,
        variables: {}
      },
      last_message_at: 3200,
      last_message_preview: '重试后的回复',
      last_message_role: 'assistant',
      active_branch_id: 'branch_main',
      message_count: 3,
      created_at: 1000,
      updated_at: 3200,
      branches: [
        {
          id: 'branch_main',
          name: 'main',
          head_message_id: 'msg_3',
          base_message_id: 'msg_1'
        }
      ],
      message_nodes: {
        msg_1: {
          id: 'msg_1',
          role: 'user',
          content: '第一条消息',
          status: 'completed',
          timestamp: 1500,
          parent_id: null,
          pinned: false,
          archived: false,
          stale: false
        },
        msg_2: {
          id: 'msg_2',
          role: 'assistant',
          content: '回复',
          status: 'completed',
          timestamp: 2000,
          parent_id: 'msg_1',
          pinned: false,
          archived: false,
          stale: false
        },
        msg_3: {
          id: 'msg_3',
          role: 'assistant',
          content: '重试后的回复',
          status: 'completed',
          timestamp: 3200,
          parent_id: 'msg_1',
          pinned: false,
          archived: false,
          stale: false
        }
      },
      messages: [
        {
          id: 'msg_1',
          role: 'user',
          content: '第一条消息',
          status: 'completed',
          timestamp: 1500,
          parent_id: null,
          pinned: false,
          archived: false,
          stale: false
        },
        {
          id: 'msg_3',
          role: 'assistant',
          content: '重试后的回复',
          status: 'completed',
          timestamp: 3200,
          parent_id: 'msg_1',
          pinned: false,
          archived: false,
          stale: false
        }
      ]
    })
    vi.mocked(selectConversationMessage).mockResolvedValue({
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
      active_branch_id: 'branch_main',
      message_count: 3,
      created_at: 1000,
      updated_at: 3300,
      branches: [
        {
          id: 'branch_main',
          name: 'main',
          head_message_id: 'msg_2',
          base_message_id: 'msg_1'
        }
      ],
      message_nodes: {
        msg_1: {
          id: 'msg_1',
          role: 'user',
          content: '第一条消息',
          status: 'completed',
          timestamp: 1500,
          parent_id: null,
          pinned: false,
          archived: false,
          stale: false
        },
        msg_2: {
          id: 'msg_2',
          role: 'assistant',
          content: '回复',
          status: 'completed',
          timestamp: 2000,
          parent_id: 'msg_1',
          pinned: false,
          archived: false,
          stale: false
        },
        msg_3: {
          id: 'msg_3',
          role: 'assistant',
          content: '重试后的回复',
          status: 'completed',
          timestamp: 3200,
          parent_id: 'msg_1',
          pinned: false,
          archived: false,
          stale: false
        }
      },
      messages: [
        {
          id: 'msg_1',
          role: 'user',
          content: '第一条消息',
          status: 'completed',
          timestamp: 1500,
          parent_id: null,
          pinned: false,
          archived: false,
          stale: false
        },
        {
          id: 'msg_2',
          role: 'assistant',
          content: '回复',
          status: 'completed',
          timestamp: 2000,
          parent_id: 'msg_1',
          pinned: false,
          archived: false,
          stale: false
        }
      ]
    })
    vi.mocked(createConversationBranch).mockResolvedValue({
      id: 'conv_1',
      title: '手动标题',
      draft_config: {
        model: 'gpt-lite',
        prompt_id: '',
        strategy: 'balanced',
        temperature: 0,
        variables: {}
      },
      last_message_at: 1500,
      last_message_preview: '第一条消息',
      last_message_role: 'user',
      active_branch_id: 'branch_side',
      message_count: 2,
      created_at: 1000,
      updated_at: 3400,
      branches: [
        {
          id: 'branch_main',
          name: 'main',
          head_message_id: 'msg_2',
          base_message_id: 'msg_1'
        },
        {
          id: 'branch_side',
          name: 'branch-2',
          head_message_id: 'msg_1',
          base_message_id: 'msg_1'
        }
      ],
      message_nodes: {
        msg_1: {
          id: 'msg_1',
          role: 'user',
          content: '第一条消息',
          status: 'completed',
          timestamp: 1500,
          parent_id: null,
          pinned: false,
          archived: false,
          stale: false
        },
        msg_2: {
          id: 'msg_2',
          role: 'assistant',
          content: '回复',
          status: 'completed',
          timestamp: 2000,
          parent_id: 'msg_1',
          pinned: false,
          archived: false,
          stale: false
        }
      },
      messages: [
        {
          id: 'msg_1',
          role: 'user',
          content: '第一条消息',
          status: 'completed',
          timestamp: 1500,
          parent_id: null,
          pinned: false,
          archived: false,
          stale: false
        }
      ]
    })
    vi.mocked(activateConversationBranch).mockResolvedValue({
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
      active_branch_id: 'branch_main',
      message_count: 2,
      created_at: 1000,
      updated_at: 3500,
      branches: [
        {
          id: 'branch_main',
          name: 'main',
          head_message_id: 'msg_2',
          base_message_id: 'msg_1'
        },
        {
          id: 'branch_side',
          name: 'branch-2',
          head_message_id: 'msg_1',
          base_message_id: 'msg_1'
        }
      ],
      message_nodes: {
        msg_1: {
          id: 'msg_1',
          role: 'user',
          content: '第一条消息',
          status: 'completed',
          timestamp: 1500,
          parent_id: null,
          pinned: false,
          archived: false,
          stale: false
        },
        msg_2: {
          id: 'msg_2',
          role: 'assistant',
          content: '回复',
          status: 'completed',
          timestamp: 2000,
          parent_id: 'msg_1',
          pinned: false,
          archived: false,
          stale: false
        }
      },
      messages: [
        {
          id: 'msg_1',
          role: 'user',
          content: '第一条消息',
          status: 'completed',
          timestamp: 1500,
          parent_id: null,
          pinned: false,
          archived: false,
          stale: false
        },
        {
          id: 'msg_2',
          role: 'assistant',
          content: '回复',
          status: 'completed',
          timestamp: 2000,
          parent_id: 'msg_1',
          pinned: false,
          archived: false,
          stale: false
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
        active_branch_id: 'branch_main',
        message_count: 2,
        created_at: 1000,
        updated_at: 2000,
        branches: [
          {
            id: 'branch_main',
            name: 'main',
            head_message_id: 'msg_2',
            base_message_id: 'msg_1'
          }
        ],
        message_nodes: {
          msg_1: {
            id: 'msg_1',
            role: 'user',
            content: '第一条消息',
            status: 'completed',
            timestamp: 1500,
            parent_id: null,
            pinned: false,
            archived: false,
            stale: false
          },
          msg_2: {
            id: 'msg_2',
            role: 'assistant',
            content: '回复',
            status: 'completed',
            timestamp: 2000,
            parent_id: 'msg_1',
            pinned: false,
            archived: false,
            stale: false
          }
        },
        messages: [
          {
            id: 'msg_1',
            role: 'user',
            content: '第一条消息',
            status: 'completed',
            timestamp: 1500,
            parent_id: null,
            pinned: false,
            archived: false,
            stale: false
          },
          {
            id: 'msg_2',
            role: 'assistant',
            content: '回复',
            status: 'completed',
            timestamp: 2000,
            parent_id: 'msg_1',
            pinned: false,
            archived: false,
            stale: false
          }
        ]
      })
      await deferred.promise
    })

    expect(result.current.activeSession?.title).toBe('手动标题')
  })

  it('keeps streamed messages visible when a stale detail request resolves afterwards', async () => {
    const detailDeferred = createDeferred<unknown>()
    const streamDeferred = createDeferred<void>()

    vi.mocked(getChatConversation).mockReturnValueOnce(detailDeferred.promise)
    vi.mocked(streamConversationMessage).mockImplementationOnce(
      async (_conversationId, _payload, options) => {
        options.onEvent({
          kind: 'message.created',
          branchId: 'branch_main',
          userMessageId: 'msg_server_user',
          assistantMessageId: 'msg_server_assistant'
        })
        options.onEvent({
          kind: 'message.delta',
          assistantMessageId: 'msg_server_assistant',
          delta: '流式中',
          content: '流式中'
        })
        await streamDeferred.promise
        options.onEvent({
          kind: 'message.completed',
          assistantMessageId: 'msg_server_assistant',
          conversation: {
            id: 'conv_1',
            title: '手动标题',
            draft_config: {
              model: 'gpt-lite',
              prompt_id: '',
              strategy: 'balanced',
              temperature: 0,
              variables: {}
            },
            last_message_at: 3000,
            last_message_preview: '流式完成',
            last_message_role: 'assistant',
            active_branch_id: 'branch_main',
            message_count: 2,
            created_at: 1000,
            updated_at: 3000,
            branches: [
              {
                id: 'branch_main',
                name: 'main',
                head_message_id: 'msg_server_assistant',
                base_message_id: 'msg_server_user'
              }
            ],
            message_nodes: {
              msg_server_user: {
                id: 'msg_server_user',
                role: 'user',
                content: '抢在详情回来前发送',
                status: 'completed',
                timestamp: 2000,
                parent_id: null,
                pinned: false,
                archived: false,
                stale: false
              },
              msg_server_assistant: {
                id: 'msg_server_assistant',
                role: 'assistant',
                content: '流式完成',
                status: 'completed',
                timestamp: 3000,
                parent_id: 'msg_server_user',
                pinned: false,
                archived: false,
                stale: false
              }
            },
            messages: [
              {
                id: 'msg_server_user',
                role: 'user',
                content: '抢在详情回来前发送',
                status: 'completed',
                timestamp: 2000,
                parent_id: null,
                pinned: false,
                archived: false,
                stale: false
              },
              {
                id: 'msg_server_assistant',
                role: 'assistant',
                content: '流式完成',
                status: 'completed',
                timestamp: 3000,
                parent_id: 'msg_server_user',
                pinned: false,
                archived: false,
                stale: false
              }
            ]
          }
        })
      }
    )

    const { result } = renderHook(() => useChatSession(true))

    await waitFor(() => {
      expect(result.current.activeSession?.id).toBe('conv_1')
    })

    act(() => {
      void result.current.sendChat('抢在详情回来前发送', draftConfig)
    })

    await waitFor(() => {
      expect(result.current.messages.map((message) => message.role)).toEqual(['user', 'assistant'])
    })
    expect(result.current.messages[0]?.content).toBe('抢在详情回来前发送')
    expect(result.current.messages[1]?.content).toBe('流式中')

    await act(async () => {
      detailDeferred.resolve({
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
        active_branch_id: 'branch_main',
        message_count: 0,
        created_at: 1000,
        updated_at: 1000,
        branches: [mainBranch],
        message_nodes: {},
        messages: []
      })
    })

    expect(result.current.messages.map((message) => message.role)).toEqual(['user', 'assistant'])
    expect(result.current.messages[0]?.content).toBe('抢在详情回来前发送')
    expect(result.current.messages[1]?.content).toBe('流式中')

    await act(async () => {
      streamDeferred.resolve(undefined)
    })

    await waitFor(() => {
      expect(result.current.messages[1]?.content).toBe('流式完成')
    })
  })

  it('shows optimistic user and streaming assistant messages for server-rendered sessions', async () => {
    const streamDeferred = createDeferred<void>()

    vi.mocked(getChatConversation).mockResolvedValueOnce({
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
      last_message_preview: '上一条回复',
      last_message_role: 'assistant',
      active_branch_id: 'branch_main',
      message_count: 2,
      created_at: 1000,
      updated_at: 2000,
      branches: [
        {
          id: 'branch_main',
          name: 'main',
          head_message_id: 'msg_2',
          base_message_id: 'msg_1'
        }
      ],
      message_nodes: {
        msg_1: {
          id: 'msg_1',
          role: 'user',
          content: '上一条问题',
          status: 'completed',
          timestamp: 1500,
          parent_id: null,
          pinned: false,
          archived: false,
          stale: false
        },
        msg_2: {
          id: 'msg_2',
          role: 'assistant',
          content: '上一条回复',
          status: 'completed',
          timestamp: 2000,
          parent_id: 'msg_1',
          pinned: false,
          archived: false,
          stale: false
        }
      },
      visible_messages: [
        {
          virtual_id: 'summary:branch_main:msg_2:0',
          kind: 'summary',
          role: 'summary',
          content: '压缩摘要',
          source_node_id: null,
          timestamp: 1400
        },
        {
          virtual_id: 'msg_1',
          kind: 'node',
          role: 'user',
          content: '上一条问题',
          source_node_id: 'msg_1',
          timestamp: 1500
        },
        {
          virtual_id: 'msg_2',
          kind: 'node',
          role: 'assistant',
          content: '上一条回复',
          source_node_id: 'msg_2',
          timestamp: 2000
        }
      ],
      messages: [
        {
          id: 'msg_1',
          role: 'user',
          content: '上一条问题',
          status: 'completed',
          timestamp: 1500,
          parent_id: null,
          pinned: false,
          archived: false,
          stale: false
        },
        {
          id: 'msg_2',
          role: 'assistant',
          content: '上一条回复',
          status: 'completed',
          timestamp: 2000,
          parent_id: 'msg_1',
          pinned: false,
          archived: false,
          stale: false
        }
      ]
    })

    vi.mocked(streamConversationMessage).mockImplementationOnce(
      async (_conversationId, _payload, options) => {
        options.onEvent({
          kind: 'message.created',
          branchId: 'branch_main',
          userMessageId: 'msg_3',
          assistantMessageId: 'msg_4'
        })
        options.onEvent({
          kind: 'message.delta',
          assistantMessageId: 'msg_4',
          delta: '流式回答中',
          content: '流式回答中'
        })
        await streamDeferred.promise
      }
    )

    const { result } = renderHook(() => useChatSession(true))

    await waitFor(() => {
      expect(result.current.activeSession?.id).toBe('conv_1')
    })

    await act(async () => {
      await result.current.selectSession('conv_1')
    })

    act(() => {
      void result.current.sendChat('现在的问题', draftConfig)
    })

    await waitFor(() => {
      expect(result.current.messages.slice(-2).map((message) => message.role)).toEqual([
        'user',
        'assistant'
      ])
    })
    expect(result.current.messages.at(-2)?.content).toBe('现在的问题')
    expect(result.current.messages.at(-1)?.content).toBe('流式回答中')

    await act(async () => {
      streamDeferred.resolve(undefined)
    })
  })

  it('submits pending edits with the next message and clears local diff buffer', async () => {
    vi.mocked(getChatConversation).mockResolvedValueOnce({
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
      active_branch_id: 'branch_main',
      message_count: 2,
      created_at: 1000,
      updated_at: 2000,
      branches: [
        {
          id: 'branch_main',
          name: 'main',
          head_message_id: 'msg_2',
          base_message_id: 'msg_1'
        }
      ],
      message_nodes: {
        msg_1: {
          id: 'msg_1',
          role: 'user',
          content: '第一条消息',
          status: 'completed',
          timestamp: 1500,
          parent_id: null,
          pinned: false,
          archived: false,
          stale: false
        },
        msg_2: {
          id: 'msg_2',
          role: 'assistant',
          content: '回复',
          status: 'completed',
          timestamp: 2000,
          parent_id: 'msg_1',
          pinned: false,
          archived: false,
          stale: false
        }
      },
      messages: [
        {
          id: 'msg_1',
          role: 'user',
          content: '第一条消息',
          status: 'completed',
          timestamp: 1500,
          parent_id: null,
          pinned: false,
          archived: false,
          stale: false
        },
        {
          id: 'msg_2',
          role: 'assistant',
          content: '回复',
          status: 'completed',
          timestamp: 2000,
          parent_id: 'msg_1',
          pinned: false,
          archived: false,
          stale: false
        }
      ]
    })

    const { result } = renderHook(() => useChatSession(true))

    await waitFor(() => {
      expect(result.current.activeSession?.id).toBe('conv_1')
    })

    await act(async () => {
      await result.current.selectSession('conv_1')
    })

    act(() => {
      result.current.setPendingEdit('msg_1', '改写后的第一条消息')
    })

    expect(result.current.pendingEditCount).toBe(1)
    expect(result.current.messages[0]?.content).toBe('改写后的第一条消息')
    expect(result.current.messages[0]?.pendingEdit).toBe(true)

    await act(async () => {
      await result.current.sendChat('继续', draftConfig)
    })

    expect(streamConversationMessageWithEdits).toHaveBeenCalledWith(
      'conv_1',
      {
        content: '继续',
        draftConfig,
        modifiedNodes: [
          {
            id: 'msg_1',
            content: '改写后的第一条消息'
          }
        ]
      },
      expect.any(Object)
    )
    expect(result.current.pendingEditCount).toBe(0)
    expect(result.current.messages[0]?.content).toBe('改写后的第一条消息')
    expect(result.current.messages[0]?.pendingEdit).toBeFalsy()
  })

  it('branches immediately when editing a non-leaf user message', async () => {
    vi.mocked(getChatConversation).mockResolvedValueOnce({
      id: 'conv_1',
      title: '手动标题',
      draft_config: {
        model: 'gpt-lite',
        prompt_id: '',
        strategy: 'balanced',
        temperature: 0,
        variables: {}
      },
      last_message_at: 3000,
      last_message_preview: '第二轮回复',
      last_message_role: 'assistant',
      active_branch_id: 'branch_main',
      message_count: 4,
      created_at: 1000,
      updated_at: 3000,
      branches: [
        {
          id: 'branch_main',
          name: 'main',
          head_message_id: 'msg_4',
          base_message_id: 'msg_1'
        }
      ],
      message_nodes: {
        msg_1: {
          id: 'msg_1',
          role: 'user',
          content: '第一条消息',
          status: 'completed',
          timestamp: 1500,
          parent_id: null,
          pinned: false,
          archived: false,
          stale: false
        },
        msg_2: {
          id: 'msg_2',
          role: 'assistant',
          content: '第一轮回复',
          status: 'completed',
          timestamp: 2000,
          parent_id: 'msg_1',
          pinned: false,
          archived: false,
          stale: false
        },
        msg_3: {
          id: 'msg_3',
          role: 'user',
          content: '继续追问',
          status: 'completed',
          timestamp: 2500,
          parent_id: 'msg_2',
          pinned: false,
          archived: false,
          stale: false
        },
        msg_4: {
          id: 'msg_4',
          role: 'assistant',
          content: '第二轮回复',
          status: 'completed',
          timestamp: 3000,
          parent_id: 'msg_3',
          pinned: false,
          archived: false,
          stale: false
        }
      },
      messages: [
        {
          id: 'msg_1',
          role: 'user',
          content: '第一条消息',
          status: 'completed',
          timestamp: 1500,
          parent_id: null,
          pinned: false,
          archived: false,
          stale: false
        },
        {
          id: 'msg_2',
          role: 'assistant',
          content: '第一轮回复',
          status: 'completed',
          timestamp: 2000,
          parent_id: 'msg_1',
          pinned: false,
          archived: false,
          stale: false
        },
        {
          id: 'msg_3',
          role: 'user',
          content: '继续追问',
          status: 'completed',
          timestamp: 2500,
          parent_id: 'msg_2',
          pinned: false,
          archived: false,
          stale: false
        },
        {
          id: 'msg_4',
          role: 'assistant',
          content: '第二轮回复',
          status: 'completed',
          timestamp: 3000,
          parent_id: 'msg_3',
          pinned: false,
          archived: false,
          stale: false
        }
      ]
    })
    vi.mocked(editConversationMessageInBranch).mockResolvedValueOnce({
      id: 'conv_1',
      title: '手动标题',
      draft_config: {
        model: 'gpt-lite',
        prompt_id: '',
        strategy: 'balanced',
        temperature: 0,
        variables: {}
      },
      last_message_at: 3600,
      last_message_preview: '改写后的自动回复',
      last_message_role: 'assistant',
      active_branch_id: 'branch_side',
      message_count: 6,
      created_at: 1000,
      updated_at: 3600,
      branches: [
        {
          id: 'branch_main',
          name: 'main',
          head_message_id: 'msg_4',
          base_message_id: 'msg_1'
        },
        {
          id: 'branch_side',
          name: 'branch-2',
          head_message_id: 'msg_6',
          base_message_id: 'msg_5'
        }
      ],
      message_nodes: {
        msg_1: {
          id: 'msg_1',
          role: 'user',
          content: '第一条消息',
          status: 'completed',
          timestamp: 1500,
          parent_id: null,
          pinned: false,
          archived: false,
          stale: false
        },
        msg_2: {
          id: 'msg_2',
          role: 'assistant',
          content: '第一轮回复',
          status: 'completed',
          timestamp: 2000,
          parent_id: 'msg_1',
          pinned: false,
          archived: false,
          stale: false
        },
        msg_3: {
          id: 'msg_3',
          role: 'user',
          content: '继续追问',
          status: 'completed',
          timestamp: 2500,
          parent_id: 'msg_2',
          pinned: false,
          archived: false,
          stale: false
        },
        msg_4: {
          id: 'msg_4',
          role: 'assistant',
          content: '第二轮回复',
          status: 'completed',
          timestamp: 3000,
          parent_id: 'msg_3',
          pinned: false,
          archived: false,
          stale: false
        },
        msg_5: {
          id: 'msg_5',
          role: 'user',
          content: '改写后的第一条消息',
          status: 'completed',
          timestamp: 3300,
          parent_id: null,
          modified_from: 'msg_1',
          pinned: false,
          archived: false,
          stale: false
        },
        msg_6: {
          id: 'msg_6',
          role: 'assistant',
          content: '改写后的自动回复',
          status: 'completed',
          timestamp: 3600,
          parent_id: 'msg_5',
          pinned: false,
          archived: false,
          stale: false
        }
      },
      messages: [
        {
          id: 'msg_5',
          role: 'user',
          content: '改写后的第一条消息',
          status: 'completed',
          timestamp: 3300,
          parent_id: null,
          modified_from: 'msg_1',
          pinned: false,
          archived: false,
          stale: false
        },
        {
          id: 'msg_6',
          role: 'assistant',
          content: '改写后的自动回复',
          status: 'completed',
          timestamp: 3600,
          parent_id: 'msg_5',
          pinned: false,
          archived: false,
          stale: false
        }
      ]
    })

    const { result } = renderHook(() => useChatSession(true))

    await waitFor(() => {
      expect(result.current.activeSession?.id).toBe('conv_1')
    })

    await act(async () => {
      await result.current.selectSession('conv_1')
    })

    let mode: 'buffered' | 'branch_assistant' | 'branch_user' | null = null
    await act(async () => {
      mode = await result.current.commitMessageEdit('msg_1', '改写后的第一条消息', draftConfig)
    })

    expect(mode).toBe('branch_user')
    expect(streamEditConversationMessageInBranch).toHaveBeenCalledWith(
      'conv_1',
      'msg_1',
      {
        content: '改写后的第一条消息',
        draftConfig
      },
      expect.any(Object)
    )
    expect(result.current.activeSession?.activeBranchId).toBe('branch_side')
    expect(result.current.messages.map((message) => message.id)).toEqual(['msg_5', 'msg_6'])
  })

  it('regenerates an assistant message as a sibling variant and clears pending edits', async () => {
    vi.mocked(getChatConversation).mockResolvedValueOnce({
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
      active_branch_id: 'branch_main',
      message_count: 2,
      created_at: 1000,
      updated_at: 2000,
      branches: [
        {
          id: 'branch_main',
          name: 'main',
          head_message_id: 'msg_2',
          base_message_id: 'msg_1'
        }
      ],
      message_nodes: {
        msg_1: {
          id: 'msg_1',
          role: 'user',
          content: '第一条消息',
          status: 'completed',
          timestamp: 1500,
          parent_id: null,
          pinned: false,
          archived: false,
          stale: false
        },
        msg_2: {
          id: 'msg_2',
          role: 'assistant',
          content: '回复',
          status: 'completed',
          timestamp: 2000,
          parent_id: 'msg_1',
          pinned: false,
          archived: false,
          stale: false
        }
      },
      messages: [
        {
          id: 'msg_1',
          role: 'user',
          content: '第一条消息',
          status: 'completed',
          timestamp: 1500,
          parent_id: null,
          pinned: false,
          archived: false,
          stale: false
        },
        {
          id: 'msg_2',
          role: 'assistant',
          content: '回复',
          status: 'completed',
          timestamp: 2000,
          parent_id: 'msg_1',
          pinned: false,
          archived: false,
          stale: false
        }
      ]
    })

    const { result } = renderHook(() => useChatSession(true))

    await waitFor(() => {
      expect(result.current.activeSession?.id).toBe('conv_1')
    })

    await act(async () => {
      await result.current.selectSession('conv_1')
    })

    act(() => {
      result.current.setPendingEdit('msg_1', '改写后的第一条消息')
    })

    await act(async () => {
      await result.current.regenerateAssistantMessage('msg_2', draftConfig)
    })

    expect(streamRegenerateConversationMessage).toHaveBeenCalledWith(
      'conv_1',
      'msg_2',
      {
        draftConfig,
        modifiedNodes: [
          {
            id: 'msg_1',
            content: '改写后的第一条消息'
          }
        ]
      },
      expect.any(Object)
    )
    expect(result.current.pendingEditCount).toBe(0)
    expect(result.current.messages.map((message) => message.id)).toEqual(['msg_1', 'msg_3'])
    expect(result.current.messages[1]?.content).toBe('重试后的回复')
  })

  it('selects a sibling assistant variant as the active branch head', async () => {
    vi.mocked(getChatConversation).mockResolvedValueOnce({
      id: 'conv_1',
      title: '手动标题',
      draft_config: {
        model: 'gpt-lite',
        prompt_id: '',
        strategy: 'balanced',
        temperature: 0,
        variables: {}
      },
      last_message_at: 3200,
      last_message_preview: '重试后的回复',
      last_message_role: 'assistant',
      active_branch_id: 'branch_main',
      message_count: 3,
      created_at: 1000,
      updated_at: 3200,
      branches: [
        {
          id: 'branch_main',
          name: 'main',
          head_message_id: 'msg_3',
          base_message_id: 'msg_1'
        }
      ],
      message_nodes: {
        msg_1: {
          id: 'msg_1',
          role: 'user',
          content: '第一条消息',
          status: 'completed',
          timestamp: 1500,
          parent_id: null,
          pinned: false,
          archived: false,
          stale: false
        },
        msg_2: {
          id: 'msg_2',
          role: 'assistant',
          content: '回复',
          status: 'completed',
          timestamp: 2000,
          parent_id: 'msg_1',
          pinned: false,
          archived: false,
          stale: false
        },
        msg_3: {
          id: 'msg_3',
          role: 'assistant',
          content: '重试后的回复',
          status: 'completed',
          timestamp: 3200,
          parent_id: 'msg_1',
          pinned: false,
          archived: false,
          stale: false
        }
      },
      messages: [
        {
          id: 'msg_1',
          role: 'user',
          content: '第一条消息',
          status: 'completed',
          timestamp: 1500,
          parent_id: null,
          pinned: false,
          archived: false,
          stale: false
        },
        {
          id: 'msg_3',
          role: 'assistant',
          content: '重试后的回复',
          status: 'completed',
          timestamp: 3200,
          parent_id: 'msg_1',
          pinned: false,
          archived: false,
          stale: false
        }
      ]
    })

    const { result } = renderHook(() => useChatSession(true))

    await waitFor(() => {
      expect(result.current.activeSession?.id).toBe('conv_1')
    })

    await act(async () => {
      await result.current.selectSession('conv_1')
    })

    await act(async () => {
      await result.current.selectAssistantMessage('msg_2')
    })

    expect(selectConversationMessage).toHaveBeenCalledWith('conv_1', 'msg_2')
    expect(result.current.messages.map((message) => message.id)).toEqual(['msg_1', 'msg_2'])
    expect(result.current.messages[1]?.content).toBe('回复')
  })

  it('switches non-leaf assistant siblings in local history preview only', async () => {
    vi.mocked(getChatConversation).mockResolvedValueOnce({
      id: 'conv_1',
      title: '手动标题',
      draft_config: {
        model: 'gpt-lite',
        prompt_id: '',
        strategy: 'balanced',
        temperature: 0,
        variables: {}
      },
      last_message_at: 3000,
      last_message_preview: '第二段回答',
      last_message_role: 'assistant',
      active_branch_id: 'branch_main',
      message_count: 4,
      created_at: 1000,
      updated_at: 3000,
      branches: [
        {
          id: 'branch_main',
          name: 'main',
          head_message_id: 'msg_4',
          base_message_id: 'msg_1'
        }
      ],
      message_nodes: {
        msg_1: {
          id: 'msg_1',
          role: 'user',
          content: '第一条消息',
          status: 'completed',
          timestamp: 1500,
          parent_id: null,
          pinned: false,
          archived: false,
          stale: false
        },
        msg_2: {
          id: 'msg_2',
          role: 'assistant',
          content: '第一版回答',
          status: 'completed',
          timestamp: 2000,
          parent_id: 'msg_1',
          pinned: false,
          archived: false,
          stale: false
        },
        msg_2b: {
          id: 'msg_2b',
          role: 'assistant',
          content: '历史备选回答',
          status: 'completed',
          timestamp: 2100,
          parent_id: 'msg_1',
          pinned: false,
          archived: false,
          stale: false
        },
        msg_3: {
          id: 'msg_3',
          role: 'user',
          content: '继续追问',
          status: 'completed',
          timestamp: 2500,
          parent_id: 'msg_2',
          pinned: false,
          archived: false,
          stale: false
        },
        msg_4: {
          id: 'msg_4',
          role: 'assistant',
          content: '第二段回答',
          status: 'completed',
          timestamp: 3000,
          parent_id: 'msg_3',
          pinned: false,
          archived: false,
          stale: false
        }
      },
      messages: [
        {
          id: 'msg_1',
          role: 'user',
          content: '第一条消息',
          status: 'completed',
          timestamp: 1500,
          parent_id: null,
          pinned: false,
          archived: false,
          stale: false
        },
        {
          id: 'msg_2',
          role: 'assistant',
          content: '第一版回答',
          status: 'completed',
          timestamp: 2000,
          parent_id: 'msg_1',
          pinned: false,
          archived: false,
          stale: false
        },
        {
          id: 'msg_3',
          role: 'user',
          content: '继续追问',
          status: 'completed',
          timestamp: 2500,
          parent_id: 'msg_2',
          pinned: false,
          archived: false,
          stale: false
        },
        {
          id: 'msg_4',
          role: 'assistant',
          content: '第二段回答',
          status: 'completed',
          timestamp: 3000,
          parent_id: 'msg_3',
          pinned: false,
          archived: false,
          stale: false
        }
      ]
    })

    const { result } = renderHook(() => useChatSession(true))

    await waitFor(() => {
      expect(result.current.activeSession?.id).toBe('conv_1')
    })

    await act(async () => {
      await result.current.selectSession('conv_1')
    })

    await act(async () => {
      await result.current.selectAssistantMessage('msg_2b')
    })

    expect(selectConversationMessage).not.toHaveBeenCalled()
    expect(result.current.activeSession?.activeBranch?.headMessageId).toBe('msg_4')
    expect(result.current.messages.map((message) => message.id)).toEqual([
      'msg_1',
      'msg_2b',
      'msg_3',
      'msg_4'
    ])
  })

  it('regenerates non-leaf assistant siblings without changing active context', async () => {
    vi.mocked(getChatConversation).mockResolvedValueOnce({
      id: 'conv_1',
      title: '手动标题',
      draft_config: {
        model: 'gpt-lite',
        prompt_id: '',
        strategy: 'balanced',
        temperature: 0,
        variables: {}
      },
      last_message_at: 3000,
      last_message_preview: '第二段回答',
      last_message_role: 'assistant',
      active_branch_id: 'branch_main',
      message_count: 4,
      created_at: 1000,
      updated_at: 3000,
      branches: [
        {
          id: 'branch_main',
          name: 'main',
          head_message_id: 'msg_4',
          base_message_id: 'msg_1'
        }
      ],
      message_nodes: {
        msg_1: {
          id: 'msg_1',
          role: 'user',
          content: '第一条消息',
          status: 'completed',
          timestamp: 1500,
          parent_id: null,
          pinned: false,
          archived: false,
          stale: false
        },
        msg_2: {
          id: 'msg_2',
          role: 'assistant',
          content: '第一版回答',
          status: 'completed',
          timestamp: 2000,
          parent_id: 'msg_1',
          pinned: false,
          archived: false,
          stale: false
        },
        msg_3: {
          id: 'msg_3',
          role: 'user',
          content: '继续追问',
          status: 'completed',
          timestamp: 2500,
          parent_id: 'msg_2',
          pinned: false,
          archived: false,
          stale: false
        },
        msg_4: {
          id: 'msg_4',
          role: 'assistant',
          content: '第二段回答',
          status: 'completed',
          timestamp: 3000,
          parent_id: 'msg_3',
          pinned: false,
          archived: false,
          stale: false
        }
      },
      messages: [
        {
          id: 'msg_1',
          role: 'user',
          content: '第一条消息',
          status: 'completed',
          timestamp: 1500,
          parent_id: null,
          pinned: false,
          archived: false,
          stale: false
        },
        {
          id: 'msg_2',
          role: 'assistant',
          content: '第一版回答',
          status: 'completed',
          timestamp: 2000,
          parent_id: 'msg_1',
          pinned: false,
          archived: false,
          stale: false
        },
        {
          id: 'msg_3',
          role: 'user',
          content: '继续追问',
          status: 'completed',
          timestamp: 2500,
          parent_id: 'msg_2',
          pinned: false,
          archived: false,
          stale: false
        },
        {
          id: 'msg_4',
          role: 'assistant',
          content: '第二段回答',
          status: 'completed',
          timestamp: 3000,
          parent_id: 'msg_3',
          pinned: false,
          archived: false,
          stale: false
        }
      ]
    })
    vi.mocked(regenerateConversationMessage).mockResolvedValueOnce({
      id: 'conv_1',
      title: '手动标题',
      draft_config: {
        model: 'gpt-lite',
        prompt_id: '',
        strategy: 'balanced',
        temperature: 0,
        variables: {}
      },
      last_message_at: 3000,
      last_message_preview: '第二段回答',
      last_message_role: 'assistant',
      active_branch_id: 'branch_main',
      message_count: 5,
      created_at: 1000,
      updated_at: 3600,
      branches: [
        {
          id: 'branch_main',
          name: 'main',
          head_message_id: 'msg_4',
          base_message_id: 'msg_1'
        }
      ],
      message_nodes: {
        msg_1: {
          id: 'msg_1',
          role: 'user',
          content: '第一条消息',
          status: 'completed',
          timestamp: 1500,
          parent_id: null,
          pinned: false,
          archived: false,
          stale: false
        },
        msg_2: {
          id: 'msg_2',
          role: 'assistant',
          content: '第一版回答',
          status: 'completed',
          timestamp: 2000,
          parent_id: 'msg_1',
          pinned: false,
          archived: false,
          stale: false
        },
        msg_2c: {
          id: 'msg_2c',
          role: 'assistant',
          content: '历史回答新版本',
          status: 'completed',
          timestamp: 3600,
          parent_id: 'msg_1',
          pinned: false,
          archived: false,
          stale: false
        },
        msg_3: {
          id: 'msg_3',
          role: 'user',
          content: '继续追问',
          status: 'completed',
          timestamp: 2500,
          parent_id: 'msg_2',
          pinned: false,
          archived: false,
          stale: false
        },
        msg_4: {
          id: 'msg_4',
          role: 'assistant',
          content: '第二段回答',
          status: 'completed',
          timestamp: 3000,
          parent_id: 'msg_3',
          pinned: false,
          archived: false,
          stale: false
        }
      },
      messages: [
        {
          id: 'msg_1',
          role: 'user',
          content: '第一条消息',
          status: 'completed',
          timestamp: 1500,
          parent_id: null,
          pinned: false,
          archived: false,
          stale: false
        },
        {
          id: 'msg_2',
          role: 'assistant',
          content: '第一版回答',
          status: 'completed',
          timestamp: 2000,
          parent_id: 'msg_1',
          pinned: false,
          archived: false,
          stale: false
        },
        {
          id: 'msg_3',
          role: 'user',
          content: '继续追问',
          status: 'completed',
          timestamp: 2500,
          parent_id: 'msg_2',
          pinned: false,
          archived: false,
          stale: false
        },
        {
          id: 'msg_4',
          role: 'assistant',
          content: '第二段回答',
          status: 'completed',
          timestamp: 3000,
          parent_id: 'msg_3',
          pinned: false,
          archived: false,
          stale: false
        }
      ]
    })

    const { result } = renderHook(() => useChatSession(true))

    await waitFor(() => {
      expect(result.current.activeSession?.id).toBe('conv_1')
    })

    await act(async () => {
      await result.current.selectSession('conv_1')
    })

    await act(async () => {
      await result.current.regenerateAssistantMessage('msg_2', draftConfig)
    })

    expect(streamRegenerateConversationMessage).toHaveBeenCalledWith(
      'conv_1',
      'msg_2',
      {
        draftConfig,
        modifiedNodes: []
      },
      expect.any(Object)
    )
    expect(result.current.activeSession?.activeBranch?.headMessageId).toBe('msg_4')
    expect(result.current.messages.map((message) => message.id)).toEqual([
      'msg_1',
      'msg_2c',
      'msg_3',
      'msg_4'
    ])
  })

  it('creates a branch from an existing node and switches active path', async () => {
    vi.mocked(getChatConversation).mockResolvedValueOnce({
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
      active_branch_id: 'branch_main',
      message_count: 2,
      created_at: 1000,
      updated_at: 2000,
      branches: [
        {
          id: 'branch_main',
          name: 'main',
          head_message_id: 'msg_2',
          base_message_id: 'msg_1'
        }
      ],
      message_nodes: {
        msg_1: {
          id: 'msg_1',
          role: 'user',
          content: '第一条消息',
          status: 'completed',
          timestamp: 1500,
          parent_id: null,
          pinned: false,
          archived: false,
          stale: false
        },
        msg_2: {
          id: 'msg_2',
          role: 'assistant',
          content: '回复',
          status: 'completed',
          timestamp: 2000,
          parent_id: 'msg_1',
          pinned: false,
          archived: false,
          stale: false
        }
      },
      messages: [
        {
          id: 'msg_1',
          role: 'user',
          content: '第一条消息',
          status: 'completed',
          timestamp: 1500,
          parent_id: null,
          pinned: false,
          archived: false,
          stale: false
        },
        {
          id: 'msg_2',
          role: 'assistant',
          content: '回复',
          status: 'completed',
          timestamp: 2000,
          parent_id: 'msg_1',
          pinned: false,
          archived: false,
          stale: false
        }
      ]
    })

    const { result } = renderHook(() => useChatSession(true))

    await waitFor(() => {
      expect(result.current.activeSession?.id).toBe('conv_1')
    })

    await act(async () => {
      await result.current.selectSession('conv_1')
    })

    await act(async () => {
      await result.current.createBranch('msg_1')
    })

    expect(createConversationBranch).toHaveBeenCalledWith('conv_1', {
      baseMessageId: 'msg_1',
      name: undefined
    })
    expect(result.current.activeSession?.activeBranchId).toBe('branch_side')
    expect(result.current.messages.map((message) => message.id)).toEqual(['msg_1'])
  })

  it('activates an existing branch from the selector', async () => {
    vi.mocked(getChatConversation).mockResolvedValueOnce({
      id: 'conv_1',
      title: '手动标题',
      draft_config: {
        model: 'gpt-lite',
        prompt_id: '',
        strategy: 'balanced',
        temperature: 0,
        variables: {}
      },
      last_message_at: 1500,
      last_message_preview: '第一条消息',
      last_message_role: 'user',
      active_branch_id: 'branch_side',
      message_count: 2,
      created_at: 1000,
      updated_at: 3400,
      branches: [
        {
          id: 'branch_main',
          name: 'main',
          head_message_id: 'msg_2',
          base_message_id: 'msg_1'
        },
        {
          id: 'branch_side',
          name: 'branch-2',
          head_message_id: 'msg_1',
          base_message_id: 'msg_1'
        }
      ],
      message_nodes: {
        msg_1: {
          id: 'msg_1',
          role: 'user',
          content: '第一条消息',
          status: 'completed',
          timestamp: 1500,
          parent_id: null,
          pinned: false,
          archived: false,
          stale: false
        },
        msg_2: {
          id: 'msg_2',
          role: 'assistant',
          content: '回复',
          status: 'completed',
          timestamp: 2000,
          parent_id: 'msg_1',
          pinned: false,
          archived: false,
          stale: false
        }
      },
      messages: [
        {
          id: 'msg_1',
          role: 'user',
          content: '第一条消息',
          status: 'completed',
          timestamp: 1500,
          parent_id: null,
          pinned: false,
          archived: false,
          stale: false
        }
      ]
    })

    const { result } = renderHook(() => useChatSession(true))

    await waitFor(() => {
      expect(result.current.activeSession?.id).toBe('conv_1')
    })

    await act(async () => {
      await result.current.selectSession('conv_1')
    })

    await act(async () => {
      await result.current.selectBranch('branch_main')
    })

    expect(activateConversationBranch).toHaveBeenCalledWith('conv_1', 'branch_main')
    expect(result.current.activeSession?.activeBranchId).toBe('branch_main')
    expect(result.current.messages.map((message) => message.id)).toEqual(['msg_1', 'msg_2'])
  })

  it('updates message pin state from the backend response', async () => {
    vi.mocked(getChatConversation).mockResolvedValueOnce({
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
      active_branch_id: 'branch_main',
      message_count: 2,
      created_at: 1000,
      updated_at: 2000,
      branches: [
        {
          id: 'branch_main',
          name: 'main',
          head_message_id: 'msg_2',
          base_message_id: 'msg_1'
        }
      ],
      message_nodes: {
        msg_1: {
          id: 'msg_1',
          role: 'user',
          content: '第一条消息',
          status: 'completed',
          timestamp: 1500,
          parent_id: null,
          pinned: false,
          archived: false,
          stale: false
        },
        msg_2: {
          id: 'msg_2',
          role: 'assistant',
          content: '回复',
          status: 'completed',
          timestamp: 2000,
          parent_id: 'msg_1',
          pinned: false,
          archived: false,
          stale: false
        }
      },
      messages: [
        {
          id: 'msg_1',
          role: 'user',
          content: '第一条消息',
          status: 'completed',
          timestamp: 1500,
          parent_id: null,
          pinned: false,
          archived: false,
          stale: false
        },
        {
          id: 'msg_2',
          role: 'assistant',
          content: '回复',
          status: 'completed',
          timestamp: 2000,
          parent_id: 'msg_1',
          pinned: false,
          archived: false,
          stale: false
        }
      ]
    })
    vi.mocked(updateConversationMessagePin).mockResolvedValueOnce({
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
      active_branch_id: 'branch_main',
      message_count: 2,
      created_at: 1000,
      updated_at: 2200,
      branches: [
        {
          id: 'branch_main',
          name: 'main',
          head_message_id: 'msg_2',
          base_message_id: 'msg_1'
        }
      ],
      message_nodes: {
        msg_1: {
          id: 'msg_1',
          role: 'user',
          content: '第一条消息',
          status: 'completed',
          timestamp: 1500,
          parent_id: null,
          pinned: false,
          archived: false,
          stale: false
        },
        msg_2: {
          id: 'msg_2',
          role: 'assistant',
          content: '回复',
          status: 'completed',
          timestamp: 2000,
          parent_id: 'msg_1',
          pinned: true,
          archived: false,
          stale: false
        }
      },
      messages: [
        {
          id: 'msg_1',
          role: 'user',
          content: '第一条消息',
          status: 'completed',
          timestamp: 1500,
          parent_id: null,
          pinned: false,
          archived: false,
          stale: false
        },
        {
          id: 'msg_2',
          role: 'assistant',
          content: '回复',
          status: 'completed',
          timestamp: 2000,
          parent_id: 'msg_1',
          pinned: true,
          archived: false,
          stale: false
        }
      ]
    })

    const { result } = renderHook(() => useChatSession(true))

    await waitFor(() => {
      expect(result.current.messages.map((message) => message.id)).toEqual(['msg_1', 'msg_2'])
    })

    await act(async () => {
      await result.current.toggleMessagePin('msg_2', true)
    })

    expect(updateConversationMessagePin).toHaveBeenCalledWith('conv_1', 'msg_2', true)
    expect(result.current.activeSession?.messageNodes.msg_2?.pinned).toBe(true)
    expect(result.current.messages[1]?.pinned).toBe(true)
  })
})
