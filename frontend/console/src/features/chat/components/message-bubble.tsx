import dayjs from 'dayjs'
import { ChevronDown, Zap } from 'lucide-react'
import type { ChatMessage } from '@/features/chat/chat-types'
import { cn } from '@/shared/lib/cn'

type MessageBubbleProps = Pick<
  ChatMessage,
  'callInfo' | 'content' | 'loading' | 'role' | 'timestamp'
>

function formatLatency(message: MessageBubbleProps) {
  if (!message.callInfo) {
    return '--'
  }

  if (message.callInfo.cacheHit && message.callInfo.latencyMs < 10) {
    return '<10ms'
  }

  return `${message.callInfo.latencyMs}ms`
}

export function MessageBubble({ callInfo, content, loading, role, timestamp }: MessageBubbleProps) {
  const isUser = role === 'user'

  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn('flex min-w-0 flex-col gap-2', isUser ? 'items-end' : 'w-full items-start')}
      >
        <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
          <span className="font-medium text-foreground-soft">{isUser ? '你' : '助手'}</span>
          <span>{dayjs(timestamp).format('HH:mm')}</span>
          {!isUser && callInfo?.cacheHit ? (
            <span className="inline-flex items-center gap-1 text-success">
              <Zap className="size-3" />
              缓存命中
            </span>
          ) : null}
        </div>

        <div
          className={cn(
            'relative text-sm leading-7',
            isUser
              ? 'w-fit max-w-[min(78%,680px)] rounded-[22px] rounded-br-md bg-accent-soft px-4 py-3 text-left text-foreground'
              : 'w-full max-w-[760px] rounded-[18px] px-1 py-0.5 text-foreground'
          )}
        >
          {loading ? (
            <div className="flex min-h-8 items-center gap-2 px-3">
              <span className="size-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.2s]" />
              <span className="size-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.1s]" />
              <span className="size-2 animate-bounce rounded-full bg-muted-foreground" />
            </div>
          ) : (
            <div className="whitespace-pre-wrap break-words">{content}</div>
          )}
        </div>

        {!isUser && !loading && callInfo ? (
          <details className="group w-full max-w-[760px] rounded-2xl border border-border bg-background">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-3">
                <span>调用详情</span>
                <span className="font-mono">
                  {formatLatency({ callInfo, content, loading, role, timestamp })}
                </span>
                <span>{callInfo.provider || 'provider'}</span>
                <span>{callInfo.model || 'model'}</span>
              </span>
              <ChevronDown className="size-4 transition group-open:rotate-180" />
            </summary>

            <div className="grid gap-3 border-t border-border px-4 py-4 text-xs text-muted-foreground sm:grid-cols-2">
              {[
                ['策略', callInfo.strategy],
                ['路由原因', callInfo.routeReason || '-'],
                ['Endpoint', callInfo.endpointId || '-'],
                ['Tokens', `${callInfo.promptTokens}+${callInfo.completionTokens}`],
                ['总 Tokens', String(callInfo.totalTokens)],
                ['Fallback', String(callInfo.fallbackCount)]
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-panel px-3 py-2">
                  <div>{label}</div>
                  <div className="mt-1 break-all font-mono text-foreground">{value}</div>
                </div>
              ))}
            </div>
          </details>
        ) : null}
      </div>
    </div>
  )
}
