import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo } from 'react'
import { type Resolver, useForm } from 'react-hook-form'
import { toPromptFormValues } from '@/features/prompts/prompt-adapters'
import { promptFormSchema } from '@/features/prompts/forms/prompt-form-schema'
import type { PromptFormValues, PromptTemplateRecord } from '@/features/prompts/prompt-types'
import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'
import { Textarea } from '@/shared/ui/textarea'

type PromptDialogProps = {
  mode: 'create' | 'edit'
  onOpenChange: (open: boolean) => void
  onSubmit: (values: PromptFormValues) => Promise<void>
  open: boolean
  pending: boolean
  prompt?: PromptTemplateRecord | null
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null
  }

  return <div className="mt-2 text-xs text-danger">{message}</div>
}

export function PromptDialog({
  mode,
  onOpenChange,
  onSubmit,
  open,
  pending,
  prompt
}: PromptDialogProps) {
  const defaultValues = useMemo(() => toPromptFormValues(prompt), [prompt])
  const resolver = zodResolver(promptFormSchema) as Resolver<PromptFormValues>

  const {
    formState: { errors },
    handleSubmit,
    register,
    reset
  } = useForm<PromptFormValues>({
    resolver,
    defaultValues
  })

  useEffect(() => {
    if (open) {
      reset(defaultValues)
    }
  }, [defaultValues, open, reset])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'edit' ? '编辑 Prompt 模板' : '新增 Prompt 模板'}</DialogTitle>
          <DialogDescription>Prompt ID 供网关请求中的 `prompt_id` 直接引用。</DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-5"
          onSubmit={handleSubmit(async (values) => {
            await onSubmit(values)
          })}
        >
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label htmlFor="prompt-id" className="text-sm font-medium">
                Prompt ID
              </label>
              <Input id="prompt-id" className="mt-2" {...register('promptId')} />
              <FieldError message={errors.promptId?.message} />
            </div>

            <div>
              <label htmlFor="prompt-name" className="text-sm font-medium">
                模板名称
              </label>
              <Input id="prompt-name" className="mt-2" {...register('name')} />
              <FieldError message={errors.name?.message} />
            </div>
          </div>

          <div>
            <label htmlFor="prompt-description" className="text-sm font-medium">
              描述
            </label>
            <Textarea
              id="prompt-description"
              className="mt-2 min-h-[96px]"
              placeholder="描述模板用途和适用场景"
              {...register('description')}
            />
            <FieldError message={errors.description?.message} />
          </div>

          <div>
            <label htmlFor="prompt-content" className="text-sm font-medium">
              模板内容
            </label>
            <Textarea
              id="prompt-content"
              className="mt-2 min-h-[220px] font-mono text-sm"
              placeholder="例如：你是一个帮助 {name} 的助手。"
              {...register('content')}
            />
            <FieldError message={errors.content?.message} />
          </div>

          <div className="grid gap-5 md:grid-cols-[1fr_160px]">
            <div>
              <label htmlFor="prompt-variables" className="text-sm font-medium">
                变量
              </label>
              <Textarea
                id="prompt-variables"
                className="mt-2 min-h-[120px] font-mono text-sm"
                placeholder={'每行一个变量名，例如：\nname\nscene'}
                {...register('variablesText')}
              />
              <FieldError message={errors.variablesText?.message} />
            </div>

            <label className="flex items-center gap-3 rounded-[20px] border border-border bg-panel-strong px-4 py-4 text-sm font-medium">
              <input type="checkbox" {...register('isActive')} />
              启用模板
            </label>
          </div>

          <DialogFooter className="border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? '提交中' : mode === 'edit' ? '保存变更' : '创建模板'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

