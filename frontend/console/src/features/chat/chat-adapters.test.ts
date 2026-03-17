import {
  normalizeAvailableModels,
  normalizeChatResponse,
  normalizeChatSession,
  normalizePromptTemplates
} from '@/features/chat/chat-adapters'

describe('chat adapters', () => {
  it('normalizes available model list payload', () => {
    expect(
      normalizeAvailableModels({
        data: [{ id: 'gpt-4o' }, { model: 'claude-sonnet-4' }]
      })
    ).toEqual(['gpt-4o', 'claude-sonnet-4'])
  })

  it('normalizes prompt templates and variable declarations', () => {
    const result = normalizePromptTemplates([
      {
        id: 1,
        prompt_id: 'rewrite',
        name: 'Rewrite',
        description: 'Rewrite input',
        content: 'Rewrite {topic} in a {tone} voice.',
        variables: '["topic","tone"]',
        is_active: true
      }
    ])

    expect(result[0]).toEqual({
      id: '1',
      promptId: 'rewrite',
      name: 'Rewrite',
      description: 'Rewrite input',
      isActive: true,
      variables: ['topic', 'tone']
    })
  })

  it('normalizes chat response and call info', () => {
    const result = normalizeChatResponse(
      {
        model: 'gpt-4o',
        choices: [{ message: { content: 'hello' } }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 15,
          total_tokens: 25
        }
      },
      {
        'x-request-id': 'req-1',
        'x-branchat-provider': 'openai',
        'x-branchat-route-reason': 'balanced',
        'x-branchat-cache': 'hit',
        'x-branchat-endpoint': '12',
        'x-branchat-fallbacks': '1'
      },
      8,
      'balanced'
    )

    expect(result).toEqual({
      content: 'hello',
      callInfo: {
        requestId: 'req-1',
        provider: 'openai',
        model: 'gpt-4o',
        routeReason: 'balanced',
        cacheHit: true,
        endpointId: '12',
        fallbackCount: 1,
        latencyMs: 8,
        promptTokens: 10,
        completionTokens: 15,
        totalTokens: 25,
        costUsd: 0,
        strategy: 'balanced',
        status: 'fallback'
      }
    })
  })

  it('prefers visible_messages for the main chat list while keeping raw nodes intact', () => {
    const session = normalizeChatSession({
      id: 'conv_1',
      title: '测试会话',
      draft_config: {
        model: 'gpt-lite',
        prompt_id: '',
        strategy: 'balanced',
        temperature: 0,
        variables: {}
      },
      active_branch_id: 'branch_main',
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
          content: '第一问',
          status: 'completed',
          timestamp: 1000,
          parent_id: null
        },
        msg_2: {
          id: 'msg_2',
          role: 'assistant',
          content: '第一答',
          status: 'completed',
          timestamp: 2000,
          parent_id: 'msg_1'
        },
        msg_3: {
          id: 'msg_3',
          role: 'user',
          content: '第二问',
          status: 'completed',
          timestamp: 3000,
          parent_id: 'msg_2'
        },
        msg_4: {
          id: 'msg_4',
          role: 'assistant',
          content: '第二答',
          status: 'completed',
          timestamp: 4000,
          parent_id: 'msg_3'
        }
      },
      visible_messages: [
        {
          virtual_id: 'summary:branch_main:msg_4:0',
          kind: 'summary',
          role: 'summary',
          content: '压缩摘要',
          source_node_id: null,
          timestamp: 2000
        },
        {
          virtual_id: 'msg_3',
          kind: 'node',
          role: 'user',
          content: '第二问',
          source_node_id: 'msg_3',
          timestamp: 3000
        },
        {
          virtual_id: 'msg_4',
          kind: 'node',
          role: 'assistant',
          content: '第二答',
          source_node_id: 'msg_4',
          timestamp: 4000
        }
      ]
    })

    expect(session.messages.map((message) => message.id)).toEqual([
      'summary:branch_main:msg_4:0',
      'msg_3',
      'msg_4'
    ])
    expect(session.messages[0]).toMatchObject({
      role: 'summary',
      content: '压缩摘要',
      pinned: false
    })
    expect(session.messageNodes.msg_2?.content).toBe('第一答')
  })
})
