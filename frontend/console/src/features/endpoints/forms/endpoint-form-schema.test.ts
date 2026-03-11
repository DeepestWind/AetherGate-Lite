import { createEndpointFormSchema } from '@/features/endpoints/forms/endpoint-form-schema'

describe('endpoint form schema', () => {
  it('requires api key for create mode when provider is not ollama', () => {
    const schema = createEndpointFormSchema('create')
    const result = schema.safeParse({
      providerType: 'openai_compatible',
      name: 'OpenAI',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      modelName: 'gpt-4o',
      logicalModel: '',
      priority: 100,
      weight: 1,
      inputCostPer1k: 0,
      outputCostPer1k: 0,
      qualityScore: 0,
      remark: ''
    })

    expect(result.success).toBe(false)
  })

  it('allows empty base url and falls back to provider default later', () => {
    const schema = createEndpointFormSchema('create')
    const result = schema.safeParse({
      providerType: 'openai_compatible',
      name: 'OpenAI',
      baseUrl: '',
      apiKey: 'sk-test',
      modelName: 'gpt-4o',
      logicalModel: '',
      priority: 100,
      weight: 1,
      inputCostPer1k: 0,
      outputCostPer1k: 0,
      qualityScore: 0,
      remark: ''
    })

    expect(result.success).toBe(true)
  })

  it('allows empty api key for edit mode', () => {
    const schema = createEndpointFormSchema('edit')
    const result = schema.safeParse({
      providerType: 'openai_compatible',
      name: 'OpenAI',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: '',
      modelName: 'gpt-4o',
      logicalModel: '',
      priority: 100,
      weight: 1,
      inputCostPer1k: 0,
      outputCostPer1k: 0,
      qualityScore: 0,
      remark: ''
    })

    expect(result.success).toBe(true)
  })
})
