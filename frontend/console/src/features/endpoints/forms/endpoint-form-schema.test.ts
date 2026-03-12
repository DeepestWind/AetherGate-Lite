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
      inputCostPer1k: null,
      outputCostPer1k: null,
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
      inputCostPer1k: null,
      outputCostPer1k: null,
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
      inputCostPer1k: null,
      outputCostPer1k: null,
      qualityScore: 0,
      remark: ''
    })

    expect(result.success).toBe(true)
  })

  it('allows empty costs to remain null', () => {
    const schema = createEndpointFormSchema('create')
    const result = schema.safeParse({
      providerType: 'openai_compatible',
      name: 'OpenAI',
      baseUrl: 'https://api.openai.com/v1',
      apiKey: 'sk-test',
      modelName: 'gpt-4o',
      logicalModel: '',
      priority: 100,
      inputCostPer1k: null,
      outputCostPer1k: null,
      qualityScore: 0,
      remark: ''
    })

    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data.inputCostPer1k).toBeNull()
      expect(result.data.outputCostPer1k).toBeNull()
    }
  })
})
