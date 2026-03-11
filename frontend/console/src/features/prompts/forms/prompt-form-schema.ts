import { z } from 'zod'

function requiredTrimmedText(message: string, maxLength: number) {
  return z.string().trim().min(1, message).max(maxLength, `长度不能超过 ${maxLength} 个字符`)
}

export const promptFormSchema = z.object({
  promptId: requiredTrimmedText('请输入 Prompt ID', 120),
  name: requiredTrimmedText('请输入模板名称', 120),
  description: z.string().trim().max(1000, '描述长度不能超过 1000 个字符'),
  content: requiredTrimmedText('请输入模板内容', 20000),
  variablesText: z.string().trim(),
  isActive: z.boolean()
})

export type PromptFormSchema = typeof promptFormSchema

