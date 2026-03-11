export type ProviderType = 'openai_compatible' | 'ollama'

export type Endpoint = {
  baseUrl: string
  createdAt: string
  id: number
  inputCostPer1k: number
  isEnabled: boolean
  isValid: boolean
  lastValidatedAt: string
  logicalModel: string
  maskedKey: string
  modelName: string
  name: string
  outputCostPer1k: number
  priority: number
  providerType: ProviderType
  qualityScore: number
  remark: string
  weight: number
}

export type EndpointFormValues = {
  apiKey: string
  baseUrl: string
  inputCostPer1k: number
  logicalModel: string
  modelName: string
  name: string
  outputCostPer1k: number
  priority: number
  providerType: ProviderType
  qualityScore: number
  remark: string
  weight: number
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
