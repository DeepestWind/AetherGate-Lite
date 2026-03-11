import dayjs from 'dayjs'
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
    <div className={cn('flex gap-3', isUser ? 'flex-row-reverse' : 'flex-row')}>
      <div
        className={cn(
          'flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold',
          isUser
            ? 'bg-accent text-white'
            : 'border border-border bg-panel-strong text-muted-foreground'
        )}
      >
        {isUser ? 'U' : 'A'}
      </div>

      <div className={cn('flex min-w-0 flex-col gap-2', isUser ? 'items-end' : 'items-start')}>
        <div
          className={cn(
            'relative max-w-[78%] rounded-[22px] px-4 py-3 text-sm leading-7',
            isUser
              ? 'rounded-tr-md bg-accent text-white'
              : 'rounded-tl-md border border-border bg-panel-strong text-foreground'
          )}
        >
          {loading ? (
            <div className="flex min-h-6 items-center gap-2">
              <span className="size-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.2s]" />
              <span className="size-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.1s]" />
              <span className="size-2 animate-bounce rounded-full bg-muted-foreground" />
            </div>
          ) : (
            <div className="whitespace-pre-wrap break-words">{content}</div>
          )}

          {!isUser && callInfo?.cacheHit ? (
            <div className="absolute -right-2 -top-2 flex size-6 items-center justify-center rounded-full border border-success/40 bg-background text-[11px] text-success">
              ⚡
            </div>
          ) : null}
        </div>

        {!loading ? (
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>{dayjs(timestamp).format('HH:mm')}</span>
            {!isUser && callInfo?.cacheHit ? <span className="text-success">缓存命中</span> : null}
            {!isUser ? (
              <span className="font-mono">
                {formatLatency({ callInfo, content, loading, role, timestamp })}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}
