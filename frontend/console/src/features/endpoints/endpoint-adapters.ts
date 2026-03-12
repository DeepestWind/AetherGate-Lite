import { officialProviderBaseUrls } from '@/features/endpoints/endpoint-constants'
import type {
  Endpoint,
  EndpointFormValues,
  ProviderType
} from '@/features/endpoints/endpoint-types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function readValue(
  source: Record<string, unknown> | null | undefined,
  keys: string[],
  fallback: unknown
) {
  for (const key of keys) {
    const value = source?.[key]
    if (value !== undefined && value !== null && value !== '') {
      return value
    }
  }

  return fallback
}

function toNumber(value: unknown, fallback = 0) {
  const next = Number(value)
  return Number.isFinite(next) ? next : fallback
}

function toNullableNumber(value: unknown) {
  if (value === undefined || value === null || value === '') {
    return null
  }

  const next = Number(value)
  return Number.isFinite(next) ? next : null
}

function toBoolean(value: unknown, fallback = false) {
  if (typeof value === 'boolean') {
    return value
  }
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase()
    if (normalized === 'true' || normalized === '1') {
      return true
    }
    if (normalized === 'false' || normalized === '0') {
      return false
    }
  }
  if (typeof value === 'number') {
    return value === 1
  }

  return fallback
}

function trimTrailingSlashes(value: string) {
  return value.replace(/\/+$/, '')
}

function resolveLogicalModel(logicalModel: string, modelName: string) {
  const normalizedLogicalModel = logicalModel.trim()
  return normalizedLogicalModel || modelName.trim()
}

export function normalizeEndpoint(payload: unknown, index: number): Endpoint {
  const source = isRecord(payload) ? payload : {}

  return {
    id: toNumber(readValue(source, ['id'], index)),
    name: String(readValue(source, ['name'], '')),
    providerType: String(
      readValue(source, ['providerType', 'provider_type'], 'openai_compatible')
    ) as ProviderType,
    baseUrl: String(readValue(source, ['baseUrl', 'base_url'], '')),
    maskedKey: String(readValue(source, ['maskedKey', 'masked_key'], '未设置')),
    modelName: String(readValue(source, ['modelName', 'model_name'], '')),
    logicalModel: String(readValue(source, ['logicalModel', 'logical_model'], '')),
    priority: toNumber(readValue(source, ['priority'], 100), 100),
    inputCostPer1k: toNullableNumber(
      readValue(source, ['inputCostPer1k', 'input_cost_per_1k'], null)
    ),
    outputCostPer1k: toNullableNumber(
      readValue(source, ['outputCostPer1k', 'output_cost_per_1k'], null)
    ),
    qualityScore: toNumber(readValue(source, ['qualityScore', 'quality_score'], 5), 5),
    isEnabled: toBoolean(readValue(source, ['isEnabled', 'is_enabled'], false)),
    isValid: toBoolean(readValue(source, ['isValid', 'is_valid'], false)),
    lastValidatedAt: String(readValue(source, ['lastValidatedAt', 'last_validated_at'], '')),
    remark: String(readValue(source, ['remark'], '')),
    createdAt: String(readValue(source, ['createdAt', 'created_at'], ''))
  }
}

export function normalizeEndpoints(payload: unknown): Endpoint[] {
  const source = Array.isArray(payload) ? payload : []

  return source
    .map((item, index) => normalizeEndpoint(item, index))
    .sort((left, right) => {
      const logicalModelCompare = resolveLogicalModel(
        left.logicalModel,
        left.modelName
      ).localeCompare(resolveLogicalModel(right.logicalModel, right.modelName))
      if (logicalModelCompare !== 0) {
        return logicalModelCompare
      }

      if (left.priority !== right.priority) {
        return left.priority - right.priority
      }

      return left.id - right.id
    })
}

export function toEndpointFormValues(endpoint?: Endpoint | null): EndpointFormValues {
  if (!endpoint) {
    return {
      providerType: 'openai_compatible',
      name: '',
      baseUrl: officialProviderBaseUrls.openai_compatible,
      apiKey: '',
      modelName: '',
      logicalModel: '',
      priority: 100,
      inputCostPer1k: null,
      outputCostPer1k: null,
      qualityScore: 0,
      remark: ''
    }
  }

  return {
    providerType: endpoint.providerType,
    name: endpoint.name,
    baseUrl: endpoint.baseUrl,
    apiKey: '',
    modelName: endpoint.modelName,
    logicalModel: endpoint.logicalModel,
    priority: endpoint.priority,
    inputCostPer1k: endpoint.inputCostPer1k,
    outputCostPer1k: endpoint.outputCostPer1k,
    qualityScore: endpoint.qualityScore,
    remark: endpoint.remark
  }
}

export function buildCreateEndpointPayload(values: EndpointFormValues) {
  const baseUrl =
    trimTrailingSlashes(values.baseUrl.trim()) || officialProviderBaseUrls[values.providerType]

  return {
    provider_type: values.providerType,
    name: values.name.trim(),
    base_url: baseUrl,
    api_key: values.providerType === 'ollama' ? '' : values.apiKey.trim(),
    model_name: values.modelName.trim(),
    logical_model: resolveLogicalModel(values.logicalModel, values.modelName),
    priority: values.priority,
    input_cost_per_1k: values.inputCostPer1k,
    output_cost_per_1k: values.outputCostPer1k,
    quality_score: values.qualityScore,
    remark: values.remark.trim()
  }
}

export function buildUpdateEndpointPayload(values: EndpointFormValues) {
  const payload: Record<string, string | number | null> = {
    name: values.name.trim(),
    base_url:
      trimTrailingSlashes(values.baseUrl.trim()) || officialProviderBaseUrls[values.providerType],
    model_name: values.modelName.trim(),
    logical_model: resolveLogicalModel(values.logicalModel, values.modelName),
    priority: values.priority,
    input_cost_per_1k: values.inputCostPer1k,
    output_cost_per_1k: values.outputCostPer1k,
    quality_score: values.qualityScore,
    remark: values.remark.trim()
  }

  const nextApiKey = values.apiKey.trim()
  if (nextApiKey) {
    payload.api_key = nextApiKey
  }

  return payload
}
