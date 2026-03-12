export type ProviderType = 'openai_compatible' | 'ollama'

export type Endpoint = {
  baseUrl: string
  createdAt: string
  id: number
  inputCostPer1k: number | null
  isEnabled: boolean
  isValid: boolean
  lastValidatedAt: string
  logicalModel: string
  maskedKey: string
  modelName: string
  name: string
  outputCostPer1k: number | null
  priority: number
  providerType: ProviderType
  qualityScore: number
  remark: string
}

export type EndpointFormValues = {
  apiKey: string
  baseUrl: string
  inputCostPer1k: number | null
  logicalModel: string
  modelName: string
  name: string
  outputCostPer1k: number | null
  priority: number
  providerType: ProviderType
  qualityScore: number
  remark: string
}

export type EndpointListFilters = {
  keyword: string
  logicalModel: string
  providerType: string
  status: string
}

export type EndpointGroup = {
  endpoints: Endpoint[]
  logicalModel: string
}
