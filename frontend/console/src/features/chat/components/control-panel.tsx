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
import { ChevronRight } from 'lucide-react'
import { useConsoleUiStore } from '@/shared/stores/use-console-ui-store'
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
  const isOpen = useConsoleUiStore((s) => s.chatControlPanelOpen)
  const toggleOpen = useConsoleUiStore((s) => s.toggleChatControlPanel)

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
    <div className={cn('border-t border-rule bg-paper-shade', className)}>
      <button
        type="button"
        onClick={toggleOpen}
        className="w-full px-4 py-2.5 flex items-center justify-between hover:bg-paper-warm transition-colors text-left"
        aria-expanded={isOpen}
      >
        <div className="flex items-baseline gap-2 min-w-0">
          <ChevronRight
            className={cn('size-3 text-ink-faint shrink-0 transition-transform', isOpen && 'rotate-90')}
          />
          <span className="font-serif italic text-xs text-ink-soft">模型设置</span>
        </div>
        <span className="font-mono text-[10px] text-ink-faint truncate ml-2">
          {config.model || '—'} · {config.strategy} · {config.temperature.toFixed(1)}
        </span>
      </button>

      {isOpen ? (
        <div className="px-4 pb-4 pt-1 border-t border-dashed border-rule space-y-3">
          {/* Strategy */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-ink-faint mb-1">
              路由策略
            </label>
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

          {/* Model */}
          <div>
            <div className="flex items-center justify-between gap-3 mb-1">
              <label className="block text-[10px] uppercase tracking-wider text-ink-faint">
                逻辑模型
              </label>
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
            <p className="text-xs text-muted-foreground mt-1">
              发送消息前需要先选定逻辑模型，对应 `/v1/models` 的返回值。
            </p>
          </div>

          {/* Temperature */}
          <div>
            <div className="flex items-center justify-between gap-3 mb-1">
              <label className="block text-[10px] uppercase tracking-wider text-ink-faint">
                Temperature
              </label>
              <span className="font-mono text-xs text-ink-faint">
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
            <p className="text-xs text-muted-foreground mt-1">更低的值更稳定，更高的值更发散。</p>
          </div>

          {/* Prompt template */}
          <div>
            <div className="flex items-center justify-between gap-3 mb-1">
              <label className="block text-[10px] uppercase tracking-wider text-ink-faint">
                Prompt 模板
              </label>
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

          {/* Variables */}
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

          {/* Call info */}
          <Separator />
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-ink-faint mb-2">
              最近一次调用
            </label>
            <CallInfoPanel callInfo={callInfo} showTitle={false} />
          </div>
        </div>
      ) : null}
    </div>
  )
}
