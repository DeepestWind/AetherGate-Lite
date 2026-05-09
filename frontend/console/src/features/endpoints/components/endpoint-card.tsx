import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import { ArrowRight, PencilLine, Power, ShieldCheck, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { providerColorMap } from '@/features/endpoints/endpoint-constants'
import type { Endpoint } from '@/features/endpoints/endpoint-types'
import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'
import { ConfirmationDialog } from '@/shared/ui/confirmation-dialog'

dayjs.extend(relativeTime)

type EndpointCardProps = {
  endpoint: Endpoint
  onDelete: (id: number) => void
  onEdit: (id: number) => void
  onToggleEnabled: (endpoint: Endpoint) => void
  onValidate: (id: number) => void
  validating: boolean
}

function StateDot({ enabled, valid }: { enabled: boolean; valid: boolean | null }) {
  let cls = 'bg-ink-faint'
  let label = 'disabled'
  if (enabled && valid) {
    cls = 'bg-sand'
    label = 'enabled'
  } else if (enabled && valid === false) {
    cls = 'bg-terracotta'
    label = 'failed validation'
  } else if (enabled && valid === null) {
    cls = 'bg-sand/50'
    label = 'unvalidated'
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-ink-soft" title={label}>
      <span className={`size-1.5 rounded-full ${cls}`}></span>
      {label}
    </span>
  )
}

function resolveLogicalModel(endpoint: Endpoint) {
  return endpoint.logicalModel || endpoint.modelName || '-'
}

export function EndpointCard({
  endpoint,
  onDelete,
  onEdit,
  onToggleEnabled,
  onValidate,
  validating
}: EndpointCardProps) {
  const [confirmOpen, setConfirmOpen] = useState(false)

  return (
    <>
      <Card className="transition hover:border-border-strong hover:shadow-[0_20px_44px_-30px_rgba(34,34,38,0.28)]">
        <CardContent className="space-y-4 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="truncate text-lg font-semibold">{endpoint.name}</span>
                <StateDot enabled={endpoint.isEnabled} valid={endpoint.isValid} />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span
                  className={cn(
                    'inline-flex rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.14em]',
                    providerColorMap[endpoint.providerType] ??
                      'border-border bg-secondary text-muted-foreground'
                  )}
                >
                  {endpoint.providerType}
                </span>
              </div>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onEdit(endpoint.id)}>
              <PencilLine className="size-4" />
              编辑
            </Button>
          </div>

          <div className="grid gap-3 text-sm leading-6 text-muted-foreground">
            <div className="grid grid-cols-[80px_minmax(0,1fr)] gap-3">
              <span>接口地址</span>
              <span className="min-w-0 truncate font-mono text-xs text-foreground">
                {endpoint.baseUrl || '-'}
              </span>
            </div>
            <div className="grid grid-cols-[80px_minmax(0,1fr)] gap-3">
              <span>API Key</span>
              <span
                className="min-w-0 break-all font-mono text-xs text-foreground"
                title={endpoint.maskedKey || '未设置'}
              >
                {endpoint.maskedKey || '未设置'}
              </span>
            </div>
            <div className="grid grid-cols-[80px_minmax(0,1fr)] gap-3">
              <span>模型映射</span>
              <span className="min-w-0 flex flex-wrap items-center gap-2 font-mono text-xs text-foreground">
                {endpoint.modelName || '-'}
                <ArrowRight className="size-3 text-muted-foreground" />
                {resolveLogicalModel(endpoint)}
              </span>
            </div>
            <div className="grid grid-cols-[80px_minmax(0,1fr)] gap-3">
              <span>优先级</span>
              <span className="min-w-0 font-mono text-xs text-foreground">
                P{endpoint.priority}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap gap-2 border-t border-border pt-4">
            <Button
              variant="secondary"
              size="sm"
              disabled={validating}
              onClick={() => onValidate(endpoint.id)}
            >
              <ShieldCheck className="size-4" />
              {validating ? '验证中' : '验证'}
            </Button>
            <Button
              variant={endpoint.isEnabled ? 'outline' : 'secondary'}
              size="sm"
              onClick={() => onToggleEnabled(endpoint)}
            >
              <Power className="size-4" />
              {endpoint.isEnabled ? '禁用' : '启用'}
            </Button>
            <Button variant="outline" size="sm" onClick={() => setConfirmOpen(true)}>
              <Trash2 className="size-4" />
              删除
            </Button>
          </div>
          {dayjs(endpoint.lastValidatedAt).isValid() && endpoint.lastValidatedAt ? (
            <p className="font-serif italic text-xs text-ink-faint mt-2">
              validated {dayjs(endpoint.lastValidatedAt).fromNow()}
            </p>
          ) : null}
        </CardContent>
      </Card>

      <ConfirmationDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title="删除这个 Endpoint？"
        description={`Endpoint“${endpoint.name}”会被永久删除，相关配置无法恢复。`}
        confirmLabel="删除 Endpoint"
        tone="danger"
        onConfirm={() => onDelete(endpoint.id)}
      />
    </>
  )
}
