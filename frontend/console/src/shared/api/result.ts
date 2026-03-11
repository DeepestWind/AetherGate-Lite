type Primitive = null | undefined | string | number | boolean | bigint | symbol

type ApiEnvelope<T> = {
  code?: number
  data?: T
  message?: string
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function camelize(key: string) {
  return key.replace(/[_-]([a-z])/g, (_, character: string) => character.toUpperCase())
}

export function isResultEnvelope<T>(value: unknown): value is ApiEnvelope<T> {
  return isRecord(value) && 'data' in value && 'code' in value
}

export function toCamelCaseDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => toCamelCaseDeep(item)) as T
  }

  if (!isRecord(value)) {
    return value
  }

  const next: Record<string, unknown> = {}

  for (const [key, item] of Object.entries(value)) {
    next[camelize(key)] = toCamelCaseDeep(item)
  }

  return next as T
}

export function isPrimitive(value: unknown): value is Primitive {
  return value === null || (typeof value !== 'object' && typeof value !== 'function')
}
