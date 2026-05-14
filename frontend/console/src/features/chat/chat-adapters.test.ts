import {
  buildTreeView,
  normalizeAvailableModels,
  normalizeChatResponse,
  normalizeChatSession,
  normalizePromptTemplates
} from '@/features/chat/chat-adapters'
import type { ChatMessage } from '@/features/chat/chat-types'

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

  describe('summary archivedNodeIds adaptation', () => {
    it('maps source_node_ids to archivedNodeIds on summary visible messages', () => {
      const session = normalizeChatSession({
        id: 'conv_2',
        title: '摘要测试',
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
            head_message_id: 'msg_3',
            base_message_id: 'msg_1'
          }
        ],
        message_nodes: {
          msg_1: {
            id: 'msg_1',
            role: 'user',
            content: 'q1',
            status: 'completed',
            timestamp: 1000,
            parent_id: null
          },
          msg_2: {
            id: 'msg_2',
            role: 'assistant',
            content: 'a1',
            status: 'completed',
            timestamp: 2000,
            parent_id: 'msg_1'
          },
          msg_3: {
            id: 'msg_3',
            role: 'user',
            content: 'q2',
            status: 'completed',
            timestamp: 3000,
            parent_id: 'msg_2'
          }
        },
        visible_messages: [
          {
            virtual_id: 'summary:branch_main:msg_3:0',
            kind: 'summary',
            role: 'summary',
            content: '摘要内容',
            source_node_id: null,
            source_node_ids: ['msg_a', 'msg_b', 'msg_c'],
            timestamp: 1500
          },
          {
            virtual_id: 'msg_3',
            kind: 'node',
            role: 'user',
            content: 'q2',
            source_node_id: 'msg_3',
            source_node_ids: null,
            timestamp: 3000
          }
        ]
      })

      const summaryMessage = session.messages[0]
      expect(summaryMessage?.kind).toBe('summary')
      expect(summaryMessage?.archivedNodeIds).toEqual(['msg_a', 'msg_b', 'msg_c'])
    })

    it('leaves archivedNodeIds undefined when source_node_ids is null', () => {
      const session = normalizeChatSession({
        id: 'conv_3',
        title: '空摘要测试',
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
            head_message_id: 'msg_2',
            base_message_id: 'msg_1'
          }
        ],
        message_nodes: {
          msg_1: {
            id: 'msg_1',
            role: 'user',
            content: 'q1',
            status: 'completed',
            timestamp: 1000,
            parent_id: null
          },
          msg_2: {
            id: 'msg_2',
            role: 'assistant',
            content: 'a1',
            status: 'completed',
            timestamp: 2000,
            parent_id: 'msg_1'
          }
        },
        visible_messages: [
          {
            virtual_id: 'summary:branch_main:msg_2:0',
            kind: 'summary',
            role: 'summary',
            content: '摘要',
            source_node_id: null,
            source_node_ids: null,
            timestamp: 1500
          },
          {
            virtual_id: 'msg_2',
            kind: 'node',
            role: 'assistant',
            content: 'a1',
            source_node_id: 'msg_2',
            timestamp: 2000
          }
        ]
      })

      const summaryMessage = session.messages[0]
      expect(summaryMessage?.kind).toBe('summary')
      expect(summaryMessage?.archivedNodeIds).toBeUndefined()
    })

    it('leaves archivedNodeIds undefined on node-kind visible messages', () => {
      const session = normalizeChatSession({
        id: 'conv_4',
        title: '节点测试',
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
            head_message_id: 'msg_1',
            base_message_id: 'msg_1'
          }
        ],
        message_nodes: {
          msg_1: {
            id: 'msg_1',
            role: 'user',
            content: 'q1',
            status: 'completed',
            timestamp: 1000,
            parent_id: null
          }
        },
        visible_messages: [
          {
            virtual_id: 'msg_1',
            kind: 'node',
            role: 'user',
            content: 'q1',
            source_node_id: 'msg_1',
            source_node_ids: null,
            timestamp: 1000
          }
        ]
      })

      const nodeMessage = session.messages[0]
      expect(nodeMessage?.kind).toBe('node')
      expect(nodeMessage?.archivedNodeIds).toBeUndefined()
    })
  })

  describe('buildTreeView', () => {
    function makeNode(overrides: Partial<ChatMessage> = {}): ChatMessage {
      return {
        id: 'node',
        kind: 'node',
        role: 'user',
        content: '',
        parentId: null,
        modifiedFrom: null,
        stale: false,
        archived: false,
        pinned: false,
        status: 'completed',
        timestamp: 1000,
        callInfo: null,
        errorMessage: null,
        sourceNodeId: null,
        ...overrides
      }
    }

    it('marks current branch path as current', () => {
      const nodeA = makeNode({ id: 'A', role: 'user', content: 'msg A', parentId: null })
      const nodeB = makeNode({ id: 'B', role: 'assistant', content: 'msg B', parentId: 'A' })
      const nodeC = makeNode({ id: 'C', role: 'user', content: 'msg C', parentId: 'B' })

      const messageNodes: Record<string, ChatMessage> = { A: nodeA, B: nodeB, C: nodeC }

      const result = buildTreeView({
        messageNodes,
        visibleMessages: [nodeA, nodeB, nodeC],
        activeBranchHeadId: 'C'
      })

      expect(result.map((n) => ({ id: n.id, state: n.state }))).toEqual([
        { id: 'A', state: 'current' },
        { id: 'B', state: 'current' },
        { id: 'C', state: 'current' }
      ])
    })

    it('includes sibling nodes at fork points', () => {
      const nodeA = makeNode({ id: 'A', role: 'user', content: 'msg A', parentId: null })
      const nodeB = makeNode({ id: 'B', role: 'assistant', content: 'msg B', parentId: 'A' })
      const nodeBprime = makeNode({
        id: 'Bprime',
        role: 'assistant',
        content: 'msg B prime',
        parentId: 'A',
        modifiedFrom: 'B'
      })

      const messageNodes: Record<string, ChatMessage> = { A: nodeA, B: nodeB, Bprime: nodeBprime }

      const result = buildTreeView({
        messageNodes,
        visibleMessages: [nodeA, nodeB],
        activeBranchHeadId: 'B'
      })

      const ids = result.map((n) => n.id)
      expect(ids).toContain('B')
      expect(ids).toContain('Bprime')

      const bNode = result.find((n) => n.id === 'B')
      const bPrimeNode = result.find((n) => n.id === 'Bprime')
      expect(bNode?.state).toBe('current')
      expect(bPrimeNode?.state).toBe('sibling')
    })

    it('marks stale nodes as stale', () => {
      const nodeA = makeNode({ id: 'A', role: 'user', content: 'msg A', parentId: null })
      const nodeB = makeNode({
        id: 'B',
        role: 'assistant',
        content: 'msg B',
        parentId: 'A',
        stale: true
      })

      const messageNodes: Record<string, ChatMessage> = { A: nodeA, B: nodeB }

      const result = buildTreeView({
        messageNodes,
        visibleMessages: [nodeA],
        activeBranchHeadId: 'A'
      })

      // A is on current path, B is a sibling (stale) at the fork after A
      const bNode = result.find((n) => n.id === 'B')
      expect(bNode?.state).toBe('stale')
    })

    it('inserts summary nodes inline', () => {
      const nodeA = makeNode({ id: 'A', role: 'user', content: 'msg A', parentId: null })
      const nodeB = makeNode({ id: 'B', role: 'assistant', content: 'msg B', parentId: 'A' })
      const summaryNode = makeNode({
        id: 'sum-1',
        kind: 'summary',
        role: 'summary',
        content: 'Summary of earlier messages',
        parentId: null,
        sourceNodeId: null
      })
      // visibleMessages: summary then B (B's sourceNodeId = 'B' references the real node)
      const visibleB = { ...nodeB, id: 'B', sourceNodeId: 'B' }

      const messageNodes: Record<string, ChatMessage> = { A: nodeA, B: nodeB }

      const result = buildTreeView({
        messageNodes,
        visibleMessages: [summaryNode, visibleB],
        activeBranchHeadId: 'B'
      })

      const kinds = result.map((n) => n.kind)
      expect(kinds).toContain('summary')

      const summaryEntry = result.find((n) => n.kind === 'summary')
      expect(summaryEntry?.id).toBe('sum-1')
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
