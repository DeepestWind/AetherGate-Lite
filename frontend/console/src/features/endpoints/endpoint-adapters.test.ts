import {
  buildCreateEndpointPayload,
  buildUpdateEndpointPayload,
  normalizeEndpoints
} from '@/features/endpoints/endpoint-adapters'

describe('endpoint adapters', () => {
  it('normalizes and sorts endpoint list', () => {
    const result = normalizeEndpoints([
      {
        id: 2,
        name: 'B',
        provider_type: 'openai_compatible',
        model_name: 'gpt-4o-mini',
        logical_model: 'gpt-4o',
        priority: 2,
        weight: 100,
        is_enabled: true,
        is_valid: true
      },
      {
        id: 1,
        name: 'A',
        providerType: 'openai_compatible',
        modelName: 'gpt-4o',
        logicalModel: 'gpt-4o',
        priority: 1,
        weight: 50,
        isEnabled: true,
        isValid: true
      }
    ])

    expect(result[0].id).toBe(1)
    expect(result[1].id).toBe(2)
  })

  it('builds create payload with trimmed base url and logical model fallback', () => {
    const payload = buildCreateEndpointPayload({
      providerType: 'openai_compatible',
      name: ' Primary ',
      baseUrl: 'https://api.example.com///',
      apiKey: ' sk-123 ',
      modelName: ' gpt-4o ',
      logicalModel: ' ',
      priority: 1,
      weight: 100,
      inputCostPer1k: 0.1,
      outputCostPer1k: 0.2,
      qualityScore: 7,
      remark: ' test '
    })

    expect(payload.base_url).toBe('https://api.example.com')
    expect(payload.logical_model).toBe('gpt-4o')
    expect(payload.api_key).toBe('sk-123')
  })

  it('builds update payload with optional api key and snake case fields', () => {
    const payload = buildUpdateEndpointPayload({
      providerType: 'openai_compatible',
      name: ' Primary ',
      baseUrl: 'https://api.openai.com/v1/',
      apiKey: 'sk-updated',
      modelName: ' gpt-4o-mini ',
      logicalModel: ' gpt-lite ',
      priority: 1,
      weight: 90,
      inputCostPer1k: 0.3,
      outputCostPer1k: 0.4,
      qualityScore: 8,
      remark: ' '
    })

    expect(payload).toEqual({
      name: 'Primary',
      base_url: 'https://api.openai.com/v1',
      model_name: 'gpt-4o-mini',
      logical_model: 'gpt-lite',
      priority: 1,
      weight: 90,
      input_cost_per_1k: 0.3,
      output_cost_per_1k: 0.4,
      quality_score: 8,
      remark: '',
      api_key: 'sk-updated'
    })
  })
})
