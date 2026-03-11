import {
  normalizeAvailableModels,
  normalizeChatResponse,
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
        'x-aethergate-provider': 'openai',
        'x-aethergate-route-reason': 'balanced',
        'x-aethergate-cache': 'hit',
        'x-aethergate-endpoint': '12',
        'x-aethergate-fallbacks': '1'
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
})
