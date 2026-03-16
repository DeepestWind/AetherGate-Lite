import dayjs from 'dayjs'
import { Copy, GitBranch, Pencil, Pin, Zap } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import type { ChatMessage } from '@/features/chat/chat-types'
import { cn } from '@/shared/lib/cn'

type MessageBubbleProps = {
  isPinned: boolean
  message: ChatMessage
  onBranchMessage: (message: ChatMessage) => void | Promise<void>
  onEditMessage: (message: ChatMessage) => void
  onTogglePinMessage: (message: ChatMessage) => void
}

function formatLatency(callInfo: ChatMessage['callInfo']) {
  if (!callInfo) {
    return '--'
  }

  if (callInfo.cacheHit && callInfo.latencyMs < 10) {
    return '<10ms'
  }

  return `${callInfo.latencyMs}ms`
}

async function copyText(content: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(content)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = content
  textarea.setAttribute('readonly', 'true')
  textarea.style.position = 'absolute'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()
  document.execCommand('copy')
  document.body.removeChild(textarea)
}

function MessageActionButton({
  ariaLabel,
  icon: Icon,
  onClick
}: {
  ariaLabel: string
  icon: typeof Copy
  onClick: () => void | Promise<void>
}) {
  return (
    <button
      type="button"
      aria-label={ariaLabel}
      title={ariaLabel}
      className="flex size-8 items-center justify-center rounded-full text-muted-foreground transition hover:bg-secondary hover:text-foreground"
      onClick={(event) => {
        event.stopPropagation()
        void onClick()
      }}
    >
      <Icon className="size-[15px]" />
    </button>
  )
}

export function MessageBubble({
  isPinned,
  message,
  onBranchMessage,
  onEditMessage,
  onTogglePinMessage
}: MessageBubbleProps) {
  const { callInfo, content, loading, role, timestamp } = message
  const isUser = role === 'user'
  const canToggleCallInfo = !isUser && !loading && Boolean(callInfo)
  const [callInfoOpen, setCallInfoOpen] = useState(false)

  const handleCopy = async () => {
    try {
      await copyText(content)
      toast.success('已复制消息内容')
    } catch {
      toast.error('复制失败，请稍后重试')
    }
  }

  const handleToggleCallInfo = () => {
    if (!canToggleCallInfo) {
      return
    }

    setCallInfoOpen((current) => !current)
  }

  return (
    <div className={cn('group flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn('flex min-w-0 flex-col gap-2', isUser ? 'items-end' : 'w-full items-start')}
      >
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
            <span className="font-medium text-foreground-soft">{isUser ? '你' : '助手'}</span>
            <span>{dayjs(timestamp).format('HH:mm')}</span>
            {isPinned ? (
              <span className="inline-flex items-center gap-1 text-accent" title="已标记">
                <Pin className="size-3" />
                已标记
              </span>
            ) : null}
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
        </div>

        {!loading ? (
          canToggleCallInfo ? (
            <div
              className={cn(
                'flex w-full max-w-[760px] items-center justify-between rounded-full px-1.5 py-0.5 opacity-0 transition duration-150 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto',
                'hover:bg-secondary/70',
                callInfoOpen && 'bg-secondary/70 opacity-100 pointer-events-auto'
              )}
            >
              <div className="flex items-center gap-1">
                <MessageActionButton ariaLabel="复制消息" icon={Copy} onClick={handleCopy} />
                <MessageActionButton
                  ariaLabel={isPinned ? '取消标记消息' : '标记消息'}
                  icon={Pin}
                  onClick={() => onTogglePinMessage(message)}
                />
                <MessageActionButton
                  ariaLabel="创建分支"
                  icon={GitBranch}
                  onClick={() => onBranchMessage(message)}
                />
                <MessageActionButton
                  ariaLabel="编辑消息"
                  icon={Pencil}
                  onClick={() => onEditMessage(message)}
                />
              </div>

              <button
                type="button"
                aria-expanded={callInfoOpen}
                className="flex min-w-0 flex-1 items-center justify-end rounded-full px-2 py-1 text-xs font-medium text-accent transition hover:text-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/20"
                onClick={handleToggleCallInfo}
              >
                调用详情
              </button>
            </div>
          ) : (
            <div
              className={cn(
                'flex items-center gap-1 px-0.5 opacity-0 transition duration-150 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto',
                isPinned && 'opacity-100 pointer-events-auto',
                isUser ? 'justify-end' : 'justify-start'
              )}
            >
              <MessageActionButton ariaLabel="复制消息" icon={Copy} onClick={handleCopy} />
              <MessageActionButton
                ariaLabel={isPinned ? '取消标记消息' : '标记消息'}
                icon={Pin}
                onClick={() => onTogglePinMessage(message)}
              />
              <MessageActionButton
                ariaLabel="创建分支"
                icon={GitBranch}
                onClick={() => onBranchMessage(message)}
              />
              <MessageActionButton
                ariaLabel="编辑消息"
                icon={Pencil}
                onClick={() => onEditMessage(message)}
              />
            </div>
          )
        ) : null}

        {!isUser && !loading && callInfoOpen && callInfo ? (
          <div className="w-full max-w-[760px] rounded-[22px] border border-border bg-panel px-4 py-4 shadow-[0_18px_40px_-36px_rgba(15,23,42,0.28)]">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground">原始调用详情</span>
              <span className="font-mono">{formatLatency(callInfo)}</span>
              <span>{callInfo.provider || 'provider'}</span>
              <span>{callInfo.model || 'model'}</span>
            </div>

            <div className="mt-4 grid gap-3 text-xs text-muted-foreground sm:grid-cols-2">
              {[
                ['策略', callInfo.strategy],
                ['状态', callInfo.status],
                ['路由原因', callInfo.routeReason || '-'],
                ['Endpoint', callInfo.endpointId || '-'],
                ['请求 ID', callInfo.requestId || '-'],
                ['Tokens', `${callInfo.promptTokens}+${callInfo.completionTokens}`],
                ['总 Tokens', String(callInfo.totalTokens)],
                ['Fallback', String(callInfo.fallbackCount)]
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-border bg-background px-3 py-3"
                >
                  <div>{label}</div>
                  <div className="mt-1 break-all font-mono text-foreground">{value}</div>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
