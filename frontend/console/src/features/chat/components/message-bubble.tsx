import dayjs from 'dayjs'
import { ChevronLeft, ChevronRight, Copy, GitBranch, Pencil, Pin, RotateCcw, Zap } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { ChatMessage } from '@/features/chat/chat-types'
import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/button'
import { Textarea } from '@/shared/ui/textarea'
import { ChatMarkdown } from './chat-markdown'

type MessageBubbleProps = {
  message: ChatMessage
  nextSiblingId: string | null
  onBranchMessage: (message: ChatMessage) => void | Promise<void>
  onEditMessage: (message: ChatMessage, content: string) => void | Promise<void>
  onRegenerateMessage: (message: ChatMessage) => void | Promise<void>
  onSelectSiblingMessage: (messageId: string) => void | Promise<void>
  onTogglePinMessage: (message: ChatMessage) => void
  previousSiblingId: string | null
  siblingCount: number
  siblingIndex: number
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
  message,
  nextSiblingId,
  onBranchMessage,
  onEditMessage,
  onRegenerateMessage,
  onSelectSiblingMessage,
  previousSiblingId,
  siblingCount,
  siblingIndex,
  onTogglePinMessage
}: MessageBubbleProps) {
  const { archived, callInfo, content, loading, modifiedFrom, pinned, role, stale, timestamp } =
    message
  const isUser = role === 'user'
  const isSummary = role === 'summary'
  const isStopped = message.status === 'stopped'
  const canToggleCallInfo = role === 'assistant' && !loading && Boolean(callInfo)
  const canRegenerate = role === 'assistant' && !loading
  const canBranch = role === 'assistant' && !loading
  const canEdit = !isSummary && !loading
  const canPin = !isSummary && !loading
  const hasSiblingPager = role === 'assistant' && siblingCount > 1
  const [callInfoOpen, setCallInfoOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [draftContent, setDraftContent] = useState(content)
  const canSaveEdit = draftContent.trim().length > 0

  useEffect(() => {
    if (!editing) {
      setDraftContent(content)
    }
  }, [content, editing])

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

  const handleSaveEdit = async () => {
    if (!canSaveEdit) {
      return
    }

    await onEditMessage(message, draftContent)
    setEditing(false)
  }

  const handleSelectSibling = async (siblingId: string | null) => {
    if (!siblingId) {
      return
    }

    await onSelectSiblingMessage(siblingId)
  }

  return (
    <div className={cn('group flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn('flex min-w-0 flex-col gap-2', isUser ? 'items-end' : 'w-full items-start')}
      >
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex items-center gap-2 px-1 text-xs text-muted-foreground">
            <span className="font-medium text-foreground-soft">
              {isUser ? '你' : isSummary ? '摘要' : '助手'}
            </span>
            <span>{dayjs(timestamp).format('HH:mm')}</span>
            {pinned ? (
              <span className="inline-flex items-center gap-1 text-accent" title="已标记">
                <Pin className="size-3" />
                已标记
              </span>
            ) : null}
            {message.pendingEdit ? <span className="text-warning">未提交修改</span> : null}
            {modifiedFrom ? <span className="text-warning">已改写</span> : null}
            {stale ? <span className="text-warning">旧分支</span> : null}
            {archived ? <span>已归档</span> : null}
            {isStopped ? <span className="text-warning">已停止</span> : null}
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
                : isSummary
                  ? 'w-full max-w-[760px] rounded-[18px] border border-border bg-panel px-4 py-3 text-foreground'
                  : 'w-full max-w-[760px] rounded-[18px] px-1 py-0.5 text-foreground',
              archived && 'opacity-60',
              stale && 'text-muted-foreground'
            )}
          >
            {editing ? (
              <div className="space-y-3 rounded-[18px] border border-border bg-panel px-3 py-3">
                <Textarea
                  value={draftContent}
                  onChange={(event) => setDraftContent(event.target.value)}
                  className="min-h-[120px] resize-y border-border bg-background text-[14px] leading-6"
                />

                <div className="flex flex-wrap items-center justify-end gap-2">
                  {message.pendingEdit && message.originalContent ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => setDraftContent(message.originalContent ?? '')}
                    >
                      恢复原文
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setDraftContent(content)
                      setEditing(false)
                    }}
                  >
                    取消
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void handleSaveEdit()}
                    disabled={!canSaveEdit}
                  >
                    保存修改
                  </Button>
                </div>
              </div>
            ) : loading && !content ? (
              <div className="flex min-h-8 items-center gap-2 px-3">
                <span className="size-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.2s]" />
                <span className="size-2 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.1s]" />
                <span className="size-2 animate-bounce rounded-full bg-muted-foreground" />
              </div>
            ) : (
              isUser ? (
                <div className="whitespace-pre-wrap break-words">{content}</div>
              ) : (
                <ChatMarkdown content={content} />
              )
            )}
          </div>

          {!editing && hasSiblingPager ? (
            <div className="flex items-center gap-1 px-1 text-xs text-muted-foreground">
              <button
                type="button"
                aria-label="上一条回复"
                className="inline-flex size-6 items-center justify-center rounded-full transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
                onClick={() => void handleSelectSibling(previousSiblingId)}
                disabled={!previousSiblingId}
              >
                <ChevronLeft className="size-3.5" />
              </button>
              <span className="min-w-12 text-center tabular-nums">
                {siblingIndex + 1} / {siblingCount}
              </span>
              <button
                type="button"
                aria-label="下一条回复"
                className="inline-flex size-6 items-center justify-center rounded-full transition hover:bg-secondary disabled:cursor-not-allowed disabled:opacity-40"
                onClick={() => void handleSelectSibling(nextSiblingId)}
                disabled={!nextSiblingId}
              >
                <ChevronRight className="size-3.5" />
              </button>
            </div>
          ) : null}
        </div>

        {!loading && !editing ? (
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
                {canPin ? (
                  <MessageActionButton
                    ariaLabel={pinned ? '取消标记消息' : '标记消息'}
                    icon={Pin}
                    onClick={() => onTogglePinMessage(message)}
                  />
                ) : null}
                {canRegenerate ? (
                  <MessageActionButton
                    ariaLabel="重新生成回复"
                    icon={RotateCcw}
                    onClick={() => onRegenerateMessage(message)}
                  />
                ) : null}
                {canBranch ? (
                  <MessageActionButton
                    ariaLabel="创建分支"
                    icon={GitBranch}
                    onClick={() => onBranchMessage(message)}
                  />
                ) : null}
                {canEdit ? (
                  <MessageActionButton
                    ariaLabel="编辑消息"
                    icon={Pencil}
                    onClick={() => setEditing(true)}
                  />
                ) : null}
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
                pinned && 'opacity-100 pointer-events-auto',
                isUser ? 'justify-end' : 'justify-start'
              )}
            >
              <MessageActionButton ariaLabel="复制消息" icon={Copy} onClick={handleCopy} />
              {canPin ? (
                <MessageActionButton
                  ariaLabel={pinned ? '取消标记消息' : '标记消息'}
                  icon={Pin}
                  onClick={() => onTogglePinMessage(message)}
                />
              ) : null}
              {canRegenerate ? (
                <MessageActionButton
                  ariaLabel="重新生成回复"
                  icon={RotateCcw}
                  onClick={() => onRegenerateMessage(message)}
                />
              ) : null}
              {canBranch ? (
                <MessageActionButton
                  ariaLabel="创建分支"
                  icon={GitBranch}
                  onClick={() => onBranchMessage(message)}
                />
              ) : null}
              {canEdit ? (
                <MessageActionButton
                  ariaLabel="编辑消息"
                  icon={Pencil}
                  onClick={() => setEditing(true)}
                />
              ) : null}
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
