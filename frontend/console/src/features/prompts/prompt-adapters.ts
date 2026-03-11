import type { PromptFormValues, PromptTemplateRecord } from '@/features/prompts/prompt-types'

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

function normalizeVariables(payload: unknown): string[] {
  if (!payload) {
    return []
  }

  let source = payload
  if (typeof source === 'string') {
    const rawText = source
    try {
      source = JSON.parse(source)
    } catch {
      source = rawText.split(/[\n,，]/)
    }
  }

  if (Array.isArray(source)) {
    return source
      .map((item) => {
        if (typeof item === 'string') {
          return item.trim()
        }
        if (isRecord(item)) {
          return String(readValue(item, ['name', 'key', 'variable'], '')).trim()
        }
        return ''
      })
      .filter(Boolean)
  }

  if (isRecord(source)) {
    return Object.keys(source)
  }

  return []
}

export function parseVariablesText(value: string) {
  return Array.from(
    new Set(
      value
        .split(/[\n,，]/)
        .map((item) => item.trim())
        .filter(Boolean)
    )
  )
}

export function normalizePromptTemplate(payload: unknown, index: number): PromptTemplateRecord {
  const row = isRecord(payload) ? payload : {}

  return {
    id: toNumber(readValue(row, ['id'], index)),
    promptId: String(readValue(row, ['promptId', 'prompt_id'], `prompt-${index}`)),
    name: String(readValue(row, ['name'], '')),
    description: String(readValue(row, ['description'], '')),
    content: String(readValue(row, ['content'], '')),
    variables: normalizeVariables(readValue(row, ['variables'], [])),
    useCount: toNumber(readValue(row, ['useCount', 'use_count'], 0)),
    isActive: toBoolean(readValue(row, ['isActive', 'is_active'], true), true),
    createdAt: String(readValue(row, ['createdAt', 'created_at'], '')),
    updatedAt: String(readValue(row, ['updatedAt', 'updated_at'], ''))
  }
}

export function normalizePromptTemplates(payload: unknown): PromptTemplateRecord[] {
  const source = Array.isArray(payload) ? payload : []

  return source
    .map((item, index) => normalizePromptTemplate(item, index))
    .sort((left, right) => left.promptId.localeCompare(right.promptId))
}

export function toPromptFormValues(prompt?: PromptTemplateRecord | null): PromptFormValues {
  if (!prompt) {
    return {
      promptId: '',
      name: '',
      description: '',
      content: '',
      variablesText: '',
      isActive: true
    }
  }

  return {
    promptId: prompt.promptId,
    name: prompt.name,
    description: prompt.description,
    content: prompt.content,
    variablesText: prompt.variables.join('\n'),
    isActive: prompt.isActive
  }
}

export function buildCreatePromptPayload(values: PromptFormValues) {
  return {
    prompt_id: values.promptId.trim(),
    name: values.name.trim(),
    description: values.description.trim(),
    content: values.content,
    variables: parseVariablesText(values.variablesText),
    is_active: values.isActive
  }
}

export function buildUpdatePromptPayload(values: PromptFormValues) {
  return {
    prompt_id: values.promptId.trim(),
    name: values.name.trim(),
    description: values.description.trim(),
    content: values.content,
    variables: parseVariablesText(values.variablesText),
    is_active: values.isActive
  }
}

export function normalizePromptPreview(payload: unknown) {
  const row = isRecord(payload) ? payload : {}
  return String(readValue(row, ['rendered'], ''))
}
