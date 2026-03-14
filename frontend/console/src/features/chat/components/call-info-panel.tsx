import type { ChatCallInfo } from '@/features/chat/chat-types'
import { cn } from '@/shared/lib/cn'
import { Badge } from '@/shared/ui/badge'

type CallInfoPanelProps = {
  callInfo: ChatCallInfo | null
  showTitle?: boolean
}

function formatLatency(callInfo: ChatCallInfo | null) {
  if (!callInfo) {
    return '-'
  }

  if (callInfo.cacheHit && callInfo.latencyMs < 10) {
    return '<10ms'
  }

  return `${callInfo.latencyMs}ms`
}

function tokenSummary(callInfo: ChatCallInfo | null) {
  if (!callInfo) {
    return '-'
  }

  return `${callInfo.promptTokens}+${callInfo.completionTokens}=${callInfo.totalTokens}`
}

export function CallInfoPanel({ callInfo, showTitle = true }: CallInfoPanelProps) {
  return (
    <div className="space-y-4">
      {showTitle ? (
        <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          本次调用
        </div>
      ) : null}

      {!callInfo ? (
        <div className="rounded-[20px] border border-dashed border-border bg-background px-4 py-6 text-center text-sm text-muted-foreground">
          发送消息后查看调用详情
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2">
            <Badge variant={callInfo.cacheHit ? 'accent' : 'outline'} className="tracking-[0.12em]">
              {callInfo.cacheHit ? 'CACHE HIT' : 'CACHE MISS'}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {callInfo.cacheHit ? '本次响应来自缓存。' : '本次响应来自实时调用。'}
            </span>
          </div>

          <div className="divide-y divide-border overflow-hidden rounded-[20px] border border-border bg-background">
            {[
              ['模型', callInfo.model || '-'],
              ['平台', callInfo.provider || '-'],
              ['Endpoint', callInfo.endpointId || '-'],
              ['延迟', formatLatency(callInfo)],
              ['Tokens', tokenSummary(callInfo)],
              ['策略', callInfo.strategy || '-'],
              ['路由原因', callInfo.routeReason || '-'],
              ['Fallback', String(callInfo.fallbackCount)]
            ].map(([label, value]) => (
              <div key={label} className="flex items-start justify-between gap-4 px-4 py-3 text-sm">
                <span className="text-muted-foreground">{label}</span>
                <span
                  className={cn(
                    'max-w-[150px] break-all text-right font-mono text-xs text-foreground',
                    label === '延迟' && callInfo.latencyMs < 100 && 'text-success',
                    label === '延迟' && callInfo.latencyMs > 3000 && 'text-warning'
                  )}
                >
                  {value}
                </span>
              </div>
            ))}
          </div>

          {callInfo.status === 'error' ? (
            <div className="rounded-[20px] border border-danger/30 bg-danger/10 px-4 py-3 text-sm text-danger">
              调用失败，请检查 Endpoint 配置和鉴权信息。
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
