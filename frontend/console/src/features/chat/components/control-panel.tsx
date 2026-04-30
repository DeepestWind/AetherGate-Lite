import { useEffect, useMemo } from 'react'
import type {
  ChatCallInfo,
  ChatConfig,
  ChatStrategy,
  PromptTemplate
} from '@/features/chat/chat-types'
import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Select } from '@/shared/ui/select'
import { Separator } from '@/shared/ui/separator'
import { CallInfoPanel } from './call-info-panel'

type ControlPanelProps = {
  availableModels: string[]
  callInfo: ChatCallInfo | null
  className?: string
  config: ChatConfig
  onChange: <K extends keyof ChatConfig>(key: K, value: ChatConfig[K]) => void
  onVariablesChange: (variables: Record<string, string>) => void
  promptTemplates: PromptTemplate[]
}

const strategies: Array<{ description: string; label: string; value: ChatStrategy }> = [
  { value: 'balanced', label: '均衡', description: '默认推荐策略' }
]

export function ControlPanel({
  availableModels,
  callInfo,
  className,
  config,
  onChange,
  onVariablesChange,
  promptTemplates
}: ControlPanelProps) {
  const selectedTemplate = useMemo(
    () => promptTemplates.find((template) => template.promptId === config.promptId) ?? null,
    [config.promptId, promptTemplates]
  )

  useEffect(() => {
    const keys = selectedTemplate?.variables ?? []

    if (!keys.length) {
      if (Object.keys(config.variables).length > 0) {
        onVariablesChange({})
      }
      return
    }

    const normalized = Object.fromEntries(
      keys.map((key) => [key, config.variables[key] ? String(config.variables[key]) : ''])
    )

    if (JSON.stringify(normalized) !== JSON.stringify(config.variables)) {
      onVariablesChange(normalized)
    }
  }, [config.variables, onVariablesChange, selectedTemplate])

  return (
    <div className={cn('space-y-5', className)}>
      <section className="rounded-[24px] border border-border bg-panel p-5 shadow-card">
        <div className="mb-4">
          <div className="text-sm font-semibold text-foreground">模型与路由</div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            当前会话使用的逻辑模型、路由策略和温度参数。
          </p>
        </div>

        <div className="space-y-5">
          <div className="space-y-3">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
              路由策略
            </div>
            <div className="grid gap-2">
              {strategies.map((strategy) => (
                <button
                  key={strategy.value}
                  type="button"
                  onClick={() => onChange('strategy', strategy.value)}
                  className={`rounded-[18px] border px-4 py-3 text-left transition ${
                    config.strategy === strategy.value
                      ? 'border-accent/30 bg-accent/10 text-foreground'
                      : 'border-border bg-background text-muted-foreground hover:border-border-strong hover:text-foreground'
                  }`}
                >
                  <div className="text-sm font-medium">{strategy.label}</div>
                  <div className="mt-1 text-xs">{strategy.description}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                逻辑模型
              </div>
              {config.model ? (
                <Button variant="ghost" size="sm" onClick={() => onChange('model', '')}>
                  清空
                </Button>
              ) : null}
            </div>
            <Select
              value={config.model}
              onChange={(event) => onChange('model', event.target.value)}
            >
              <option value="">请选择逻辑模型</option>
              {availableModels.map((modelName) => (
                <option key={modelName} value={modelName}>
                  {modelName}
                </option>
              ))}
            </Select>
            <p className="text-xs text-muted-foreground">
              发送消息前需要先选定逻辑模型，对应 `/v1/models` 的返回值。
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Temperature
              </div>
              <span className="font-mono text-xs text-muted-foreground">
                {config.temperature.toFixed(1)}
              </span>
            </div>
            <input
              className="w-full accent-[var(--accent)]"
              type="range"
              min={0}
              max={2}
              step={0.1}
              value={config.temperature}
              onChange={(event) => onChange('temperature', Number(event.target.value))}
            />
            <p className="text-xs text-muted-foreground">更低的值更稳定，更高的值更发散。</p>
          </div>
        </div>
      </section>

      <section className="rounded-[24px] border border-border bg-panel p-5 shadow-card">
        <div className="mb-4">
          <div className="text-sm font-semibold text-foreground">Prompt 与变量</div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            需要时再注入模板，避免主聊天界面承载过多配置。
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
                Prompt 模板
              </div>
              {config.promptId ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    onChange('promptId', '')
                    onVariablesChange({})
                  }}
                >
                  清空
                </Button>
              ) : null}
            </div>
            <Select
              value={config.promptId}
              onChange={(event) => onChange('promptId', event.target.value)}
            >
              <option value="">不使用模板</option>
              {promptTemplates.map((template) => (
                <option key={template.promptId} value={template.promptId}>
                  {template.name}
                </option>
              ))}
            </Select>
          </div>

          {selectedTemplate?.variables.length ? (
            <div className="space-y-3 rounded-[20px] border border-border bg-background p-4">
              {selectedTemplate.variables.map((key) => (
                <div key={key} className="space-y-2">
                  <label
                    htmlFor={`chat-variable-${key}`}
                    className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground"
                  >
                    {key}
                  </label>
                  <Input
                    id={`chat-variable-${key}`}
                    value={config.variables[key] || ''}
                    onChange={(event) =>
                      onVariablesChange({
                        ...config.variables,
                        [key]: event.target.value
                      })
                    }
                    placeholder={`请输入 ${key}`}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-[20px] border border-dashed border-border bg-background px-4 py-5 text-sm text-muted-foreground">
              选择 Prompt 模板后，会在这里展示需要填写的变量。
            </div>
          )}
        </div>
      </section>

      <section className="rounded-[24px] border border-border bg-panel p-5 shadow-card">
        <div className="mb-4">
          <div className="text-sm font-semibold text-foreground">最近一次调用</div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            这里只保留最近一条助手消息的调用元信息。
          </p>
        </div>

        <Separator className="mb-4" />
        <CallInfoPanel callInfo={callInfo} showTitle={false} />
      </section>
    </div>
  )
}
