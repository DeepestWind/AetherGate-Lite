import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { type Resolver, useForm } from 'react-hook-form'
import { toEndpointFormValues } from '@/features/endpoints/endpoint-adapters'
import { officialProviderBaseUrls, providerOptions } from '@/features/endpoints/endpoint-constants'
import type { Endpoint, EndpointFormValues } from '@/features/endpoints/endpoint-types'
import { createEndpointFormSchema } from '@/features/endpoints/forms/endpoint-form-schema'
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
import { Select } from '@/shared/ui/select'
import { Textarea } from '@/shared/ui/textarea'

type EndpointDialogProps = {
  endpoint?: Endpoint | null
  mode: 'create' | 'edit'
  onOpenChange: (open: boolean) => void
  onSubmit: (values: EndpointFormValues) => Promise<void>
  open: boolean
  pending: boolean
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null
  }

  return <div className="mt-2 text-xs text-danger">{message}</div>
}

function FieldHint({ children }: { children: React.ReactNode }) {
  return <div className="mt-2 text-xs leading-5 text-muted-foreground">{children}</div>
}

function parseNullableNumber(value: unknown) {
  if (value === null || value === undefined) {
    return null
  }

  if (typeof value !== 'string') {
    return value
  }

  const normalized = value.trim()
  if (!normalized) {
    return null
  }

  const next = Number(normalized)
  return Number.isFinite(next) ? next : value
}

export function EndpointDialog({
  endpoint,
  mode,
  onOpenChange,
  onSubmit,
  open,
  pending
}: EndpointDialogProps) {
  const [showKey, setShowKey] = useState(false)
  const schema = useMemo(() => createEndpointFormSchema(mode), [mode])
  const defaultValues = useMemo(() => toEndpointFormValues(endpoint), [endpoint])
  const resolver = zodResolver(schema) as Resolver<EndpointFormValues>

  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors }
  } = useForm<EndpointFormValues>({
    resolver,
    defaultValues
  })

  useEffect(() => {
    if (open) {
      reset(defaultValues)
      setShowKey(false)
    }
  }, [defaultValues, open, reset])

  const providerType = watch('providerType')
  const defaultBaseUrl = officialProviderBaseUrls[providerType]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === 'edit' ? '编辑 Endpoint' : '新增 Endpoint'}</DialogTitle>
          <DialogDescription>配置 URL、Key、模型和调度参数。</DialogDescription>
        </DialogHeader>

        <form
          className="grid gap-5"
          onSubmit={handleSubmit(async (values) => {
            await onSubmit(values)
          })}
        >
          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label htmlFor="endpoint-provider-type" className="text-sm font-medium">
                协议类型
              </label>
              <Select
                id="endpoint-provider-type"
                className="mt-2"
                disabled={mode === 'edit'}
                {...register('providerType')}
              >
                {providerOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
              <FieldError message={errors.providerType?.message} />
            </div>

            <div>
              <label htmlFor="endpoint-name" className="text-sm font-medium">
                接入名称
              </label>
              <Input id="endpoint-name" className="mt-2" {...register('name')} />
              <FieldError message={errors.name?.message} />
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label htmlFor="endpoint-base-url" className="text-sm font-medium">
                接口地址
              </label>
              <Input
                id="endpoint-base-url"
                className="mt-2"
                placeholder={defaultBaseUrl}
                {...register('baseUrl')}
              />
              <FieldHint>留空默认走官方地址。</FieldHint>
              <FieldError message={errors.baseUrl?.message} />
            </div>

            <div>
              <label htmlFor="endpoint-model-name" className="text-sm font-medium">
                实际模型名
              </label>
              <Input id="endpoint-model-name" className="mt-2" {...register('modelName')} />
              <FieldError message={errors.modelName?.message} />
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-2">
            <div>
              <label htmlFor="endpoint-api-key" className="text-sm font-medium">
                API Key
              </label>
              <div className="relative mt-2">
                <Input
                  id="endpoint-api-key"
                  type={showKey ? 'text' : 'password'}
                  disabled={providerType === 'ollama'}
                  placeholder={providerType === 'ollama' ? '无需 Key' : '请输入 API Key'}
                  className="pr-11"
                  {...register('apiKey')}
                />
                {providerType !== 'ollama' ? (
                  <button
                    type="button"
                    onClick={() => setShowKey((current) => !current)}
                    aria-label={showKey ? '隐藏 API Key' : '显示 API Key'}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition hover:text-foreground"
                  >
                    {showKey ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                  </button>
                ) : null}
              </div>
              <FieldHint>
                {providerType === 'ollama'
                  ? 'Ollama 无需 Key。'
                  : mode === 'edit'
                    ? '留空保持原 Key。'
                    : '创建时必填。'}
              </FieldHint>
              <FieldError message={errors.apiKey?.message} />
            </div>

            <div>
              <label htmlFor="endpoint-logical-model" className="text-sm font-medium">
                逻辑模型名
              </label>
              <Input
                id="endpoint-logical-model"
                className="mt-2"
                placeholder="留空默认跟随实际模型名"
                {...register('logicalModel')}
              />
              <FieldError message={errors.logicalModel?.message} />
            </div>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <div>
              <label htmlFor="endpoint-priority" className="text-sm font-medium">
                优先级
              </label>
              <Input
                id="endpoint-priority"
                className="mt-2"
                type="number"
                min={1}
                step={1}
                {...register('priority', { valueAsNumber: true })}
              />
              <FieldError message={errors.priority?.message} />
            </div>
            <div>
              <label htmlFor="endpoint-input-cost" className="text-sm font-medium">
                Input 成本
              </label>
              <Input
                id="endpoint-input-cost"
                className="mt-2"
                type="number"
                min={0}
                step="0.000001"
                placeholder="留空保存为 null"
                {...register('inputCostPer1k', { setValueAs: parseNullableNumber })}
              />
              <FieldHint>留空时保存为 null，不会被当成 0 成本。</FieldHint>
              <FieldError message={errors.inputCostPer1k?.message} />
            </div>
            <div>
              <label htmlFor="endpoint-output-cost" className="text-sm font-medium">
                Output 成本
              </label>
              <Input
                id="endpoint-output-cost"
                className="mt-2"
                type="number"
                min={0}
                step="0.000001"
                placeholder="留空保存为 null"
                {...register('outputCostPer1k', { setValueAs: parseNullableNumber })}
              />
              <FieldHint>留空时保存为 null，不会被当成 0 成本。</FieldHint>
              <FieldError message={errors.outputCostPer1k?.message} />
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-[180px_1fr]">
            <div>
              <label htmlFor="endpoint-quality-score" className="text-sm font-medium">
                质量评分
              </label>
              <Input
                id="endpoint-quality-score"
                className="mt-2"
                type="number"
                min={0}
                max={10}
                step={1}
                {...register('qualityScore', { valueAsNumber: true })}
              />
              <FieldError message={errors.qualityScore?.message} />
            </div>

            <div>
              <label htmlFor="endpoint-remark" className="text-sm font-medium">
                备注
              </label>
              <Textarea
                id="endpoint-remark"
                className="mt-2 min-h-[120px]"
                placeholder="记录定价、用途或供应商说明"
                {...register('remark')}
              />
              <FieldError message={errors.remark?.message} />
            </div>
          </div>

          <DialogFooter className="border-t border-border pt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              取消
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? '提交中' : mode === 'edit' ? '保存变更' : '创建 Endpoint'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
