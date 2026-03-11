import dayjs from 'dayjs'
import {
  ArrowRight,
  CheckCircle2,
  CircleOff,
  PencilLine,
  Power,
  ShieldCheck,
  Trash2
} from 'lucide-react'
import { providerColorMap } from '@/features/endpoints/endpoint-constants'
import type { Endpoint } from '@/features/endpoints/endpoint-types'
import { cn } from '@/shared/lib/cn'
import { Badge } from '@/shared/ui/badge'
import { Button } from '@/shared/ui/button'
import { Card, CardContent } from '@/shared/ui/card'

type EndpointCardProps = {
  endpoint: Endpoint
  onDelete: (id: number) => void
  onEdit: (id: number) => void
  onToggleEnabled: (endpoint: Endpoint) => void
  onValidate: (id: number) => void
  validating: boolean
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
  return (
    <Card className="transition hover:border-border-strong hover:shadow-[0_20px_44px_-30px_rgba(34,34,38,0.28)]">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="truncate text-lg font-semibold">{endpoint.name}</div>
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
              <Badge variant={endpoint.isEnabled ? 'accent' : 'outline'}>
                {endpoint.isEnabled ? '启用中' : '已禁用'}
              </Badge>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => onEdit(endpoint.id)}>
            <PencilLine className="size-4" />
            编辑
          </Button>
        </div>

        <div className="grid gap-3 text-sm leading-6 text-muted-foreground">
          <div className="grid grid-cols-[80px_1fr] gap-3">
            <span>接口地址</span>
            <span className="truncate font-mono text-xs text-foreground">
              {endpoint.baseUrl || '-'}
            </span>
          </div>
          <div className="grid grid-cols-[80px_1fr] gap-3">
            <span>API Key</span>
            <span className="font-mono text-xs text-foreground">
              {endpoint.maskedKey || '未设置'}
            </span>
          </div>
          <div className="grid grid-cols-[80px_1fr] gap-3">
            <span>模型映射</span>
            <span className="flex flex-wrap items-center gap-2 font-mono text-xs text-foreground">
              {endpoint.modelName || '-'}
              <ArrowRight className="size-3 text-muted-foreground" />
              {resolveLogicalModel(endpoint)}
            </span>
          </div>
          <div className="grid grid-cols-[80px_1fr] gap-3">
            <span>调度参数</span>
            <span className="font-mono text-xs text-foreground">
              priority: {endpoint.priority} · weight: {endpoint.weight}
            </span>
          </div>
          <div className="grid grid-cols-[80px_1fr] gap-3">
            <span>最近验证</span>
            <span className="font-mono text-xs text-foreground">
              {dayjs(endpoint.lastValidatedAt).isValid()
                ? dayjs(endpoint.lastValidatedAt).format('YYYY-MM-DD HH:mm:ss')
                : '暂无'}
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.14em]',
              endpoint.isValid
                ? 'border-success/30 bg-success/10 text-success'
                : 'border-danger/30 bg-danger/10 text-danger'
            )}
          >
            {endpoint.isValid ? (
              <ShieldCheck className="size-3.5" />
            ) : (
              <CircleOff className="size-3.5" />
            )}
            {endpoint.isValid ? '有效' : '无效'}
          </span>
          <span className="inline-flex items-center gap-1 rounded-full border border-border bg-secondary px-2.5 py-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground">
            <CheckCircle2 className="size-3.5" />Q{endpoint.qualityScore}
          </span>
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (window.confirm('确认删除该 Endpoint 吗？')) {
                onDelete(endpoint.id)
              }
            }}
          >
            <Trash2 className="size-4" />
            删除
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
