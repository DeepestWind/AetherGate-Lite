import { Eye } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { usePreviewPromptMutation } from '@/features/prompts/mutations/use-preview-prompt-mutation'
import type { PromptTemplateRecord } from '@/features/prompts/prompt-types'
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

type PromptPreviewDialogProps = {
  onOpenChange: (open: boolean) => void
  open: boolean
  prompt?: PromptTemplateRecord | null
}

export function PromptPreviewDialog({ onOpenChange, open, prompt }: PromptPreviewDialogProps) {
  const previewMutation = usePreviewPromptMutation()
  const [variables, setVariables] = useState<Record<string, string>>({})

  const variableKeys = useMemo(() => prompt?.variables ?? [], [prompt?.id, prompt?.variables])
  const variableKeysSignature = variableKeys.join('\n')

  useEffect(() => {
    if (!open || !prompt) {
      setVariables((current) => (Object.keys(current).length > 0 ? {} : current))
      previewMutation.reset()
      return
    }

    const nextVariables = Object.fromEntries((prompt.variables ?? []).map((key) => [key, '']))
    setVariables((current) => {
      const currentKeys = Object.keys(current)
      if (
        currentKeys.length === variableKeys.length &&
        variableKeys.every((key) => current[key] === '')
      ) {
        return current
      }

      return nextVariables
    })
    previewMutation.reset()
  }, [open, previewMutation.reset, prompt?.id, variableKeysSignature])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>预览 Prompt 模板</DialogTitle>
          <DialogDescription>
            {prompt ? `当前模板：${prompt.promptId}` : '请选择一个已保存的 Prompt 模板'}
          </DialogDescription>
        </DialogHeader>

        {prompt ? (
          <div className="space-y-5">
            {variableKeys.length ? (
              <div className="grid gap-4 md:grid-cols-2">
                {variableKeys.map((key) => (
                  <div key={key}>
                    <label htmlFor={`preview-${key}`} className="text-sm font-medium">
                      {key}
                    </label>
                    <Input
                      id={`preview-${key}`}
                      className="mt-2"
                      value={variables[key] ?? ''}
                      onChange={(event) =>
                        setVariables((current) => ({
                          ...current,
                          [key]: event.target.value
                        }))
                      }
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-[20px] border border-dashed border-border px-4 py-5 text-sm text-muted-foreground">
                当前模板没有声明变量，可直接点击预览。
              </div>
            )}

            <div>
              <div className="mb-2 text-sm font-medium">渲染结果</div>
              <Textarea
                className="min-h-[260px] font-mono text-sm"
                value={previewMutation.data ?? ''}
                readOnly
                placeholder="点击“生成预览”查看渲染结果"
              />
            </div>

            {previewMutation.isError ? (
              <div className="rounded-[20px] border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
                预览失败，请检查变量是否填写完整。
              </div>
            ) : null}
          </div>
        ) : null}

        <DialogFooter className="border-t border-border pt-4">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            关闭
          </Button>
          <Button
            type="button"
            disabled={!prompt || previewMutation.isPending}
            onClick={() => {
              if (!prompt) {
                return
              }
              previewMutation.mutate({ id: prompt.id, variables })
            }}
          >
            <Eye className="size-4" />
            {previewMutation.isPending ? '生成中' : '生成预览'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
