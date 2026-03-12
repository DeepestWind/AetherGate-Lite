import { z } from 'zod'

const providerTypeSchema = z.enum(['openai_compatible', 'ollama'])

function requiredTrimmedText(message: string, maxLength: number) {
  return z.string().trim().min(1, message).max(maxLength, `长度不能超过 ${maxLength} 个字符`)
}

const positiveInteger = (label: string) =>
  z.coerce.number().int(`${label}必须为整数`).min(1, `${label}必须大于 0`)

const nullableNonNegativeNumber = (label: string) =>
  z.preprocess((value) => {
    if (value === undefined || value === null) {
      return null
    }

    if (typeof value === 'string') {
      const normalized = value.trim()
      if (!normalized) {
        return null
      }

      const next = Number(normalized)
      return Number.isFinite(next) ? next : value
    }

    return value
  }, z.number().min(0, `${label}不能小于 0`).nullable())

export function createEndpointFormSchema(mode: 'create' | 'edit') {
  return z
    .object({
      providerType: providerTypeSchema,
      name: requiredTrimmedText('请输入接入名称', 100),
      baseUrl: z.string().trim().max(500, '长度不能超过 500 个字符'),
      apiKey: z.string().trim(),
      modelName: requiredTrimmedText('请输入实际模型名', 100),
      logicalModel: z.string().trim().max(100, '长度不能超过 100 个字符'),
      priority: positiveInteger('优先级'),
      inputCostPer1k: nullableNonNegativeNumber('Input 成本'),
      outputCostPer1k: nullableNonNegativeNumber('Output 成本'),
      qualityScore: z.coerce.number().min(0, '质量评分范围为 0-10').max(10, '质量评分范围为 0-10'),
      remark: z.string().trim().max(500, '备注长度不能超过 500 个字符')
    })
    .superRefine((value, context) => {
      if (value.providerType === 'ollama') {
        return
      }

      if (mode === 'create' && !value.apiKey.trim()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['apiKey'],
          message: '请输入 API Key'
        })
      }
    })
}

export type EndpointFormSchema = ReturnType<typeof createEndpointFormSchema>
