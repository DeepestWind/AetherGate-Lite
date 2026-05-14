import dayjs from 'dayjs'
import { ChevronLeft, ChevronRight, Copy, Pencil, Pin, RotateCcw, Zap } from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { ChatMessage } from '@/features/chat/chat-types'
import { cn } from '@/shared/lib/cn'
import { Button } from '@/shared/ui/button'
import { Textarea } from '@/shared/ui/textarea'
import { BranchPill } from './branch-pill'
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

function roleLabel(message: ChatMessage): string {
  if (message.role === 'user') return 'You'
  if (message.role === 'summary') return '摘要'
  if (message.role === 'assistant') {
    return message.callInfo?.model ? `Assistant · ${message.callInfo.model}` : 'Assistant'
  }
  return message.role
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
      className="flex size-8 items-center justify-center rounded-full text-ink-faint transition hover:bg-paper-shade hover:text-ink-soft"
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
  const isError = message.status === 'error'
  // A message is considered the current leaf when it has no siblings (siblingCount === 1)
  // or is the last sibling shown — this drives action visibility rules
  const isCurrentLeaf = siblingCount <= 1 || siblingIndex === siblingCount - 1
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
    <div data-message-id={message.id} className={cn('group mb-[18px]', stale && 'opacity-70')}>
      {/* Role label row */}
      <div className="font-serif italic text-xs text-ink-soft mb-1 flex items-center gap-2 px-1">
        <span>
          {roleLabel(message)}
          {stale ? ' · 旧分支' : ''}
          {loading && content ? ' · 生成中…' : ''}
          {isError ? ' · 错误' : ''}
          {isStopped && !isError ? ' · 已停止' : ''}
        </span>
        <span className="not-italic font-sans">{dayjs(timestamp).format('HH:mm')}</span>
        {pinned ? (
          <span
            className="not-italic font-sans inline-flex items-center gap-1 text-sand"
            title="已标记"
          >
            <Pin className="size-3" />
            已标记
          </span>
        ) : null}
        {message.pendingEdit ? (
          <span className="not-italic font-sans text-terracotta">未提交修改</span>
        ) : null}
        {modifiedFrom ? <span className="not-italic font-sans text-terracotta">已改写</span> : null}
        {archived ? <span className="not-italic font-sans text-ink-faint">已归档</span> : null}
        {!isUser && callInfo?.cacheHit ? (
          <span className="not-italic font-sans inline-flex items-center gap-1 text-moss">
            <Zap className="size-3" />
            缓存命中
          </span>
        ) : null}
      </div>

      {/* Content area */}
      {editing ? (
        <div className="mb-2">
          <div className="font-serif italic text-xs text-ink-faint mb-1 px-1">
            {roleLabel(message)} · 编辑中
          </div>
          <div className="space-y-3 rounded-[18px] border border-rule bg-paper-warm px-3 py-3">
            <Textarea
              value={draftContent}
              onChange={(event) => setDraftContent(event.target.value)}
              className="min-h-[120px] resize-y border-rule bg-paper text-[14px] leading-6"
              autoFocus
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
        </div>
      ) : (
        <>
          <div
            className={cn(
              'relative text-sm leading-7',
              isUser
                ? 'w-fit max-w-[min(78%,680px)] rounded-[22px] rounded-br-md bg-paper-shade px-4 py-3 text-left text-ink'
                : isSummary
                  ? 'w-full max-w-[760px] rounded-[18px] border border-rule bg-paper-warm px-4 py-3 text-ink'
                  : cn(
                      'w-full max-w-[760px] rounded-[18px] px-1 py-0.5',
                      stale ? 'text-ink-faint' : 'text-ink',
                      isError && 'border-l-2 border-terracotta pl-3'
                    ),
              archived && 'opacity-60'
            )}
          >
            {loading && !content ? (
              <div className="flex min-h-8 items-center gap-2 px-3">
                <span className="size-2 animate-bounce rounded-full bg-ink-faint [animation-delay:-0.2s]" />
                <span className="size-2 animate-bounce rounded-full bg-ink-faint [animation-delay:-0.1s]" />
                <span className="size-2 animate-bounce rounded-full bg-ink-faint" />
              </div>
            ) : isUser ? (
              <div className="whitespace-pre-wrap break-words">{content}</div>
            ) : (
              <ChatMarkdown content={content} />
            )}
            {/* Streaming cursor */}
            {loading && content ? (
              <span
                className="inline-block w-1.5 h-3.5 bg-sand align-text-bottom ml-0.5 animate-pulse"
                aria-hidden
              />
            ) : null}
          </div>

          {/* Error message row */}
          {isError && message.errorMessage ? (
            <div className="mt-2 px-1 text-xs text-terracotta">
              {message.errorMessage}
              {canRegenerate ? (
                <button
                  type="button"
                  onClick={() => void onRegenerateMessage(message)}
                  className="ml-3 underline text-sand hover:text-sand-hover"
                >
                  重试
                </button>
              ) : null}
            </div>
          ) : null}

          {/* Sibling pager */}
          {hasSiblingPager ? (
            <div className="flex items-center gap-1 px-1 mt-1 text-xs text-ink-faint">
              <button
                type="button"
                aria-label="上一条回复"
                className="inline-flex size-6 items-center justify-center rounded-full transition hover:bg-paper-shade disabled:cursor-not-allowed disabled:opacity-40"
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
                className="inline-flex size-6 items-center justify-center rounded-full transition hover:bg-paper-shade disabled:cursor-not-allowed disabled:opacity-40"
                onClick={() => void handleSelectSibling(nextSiblingId)}
                disabled={!nextSiblingId}
              >
                <ChevronRight className="size-3.5" />
              </button>
            </div>
          ) : null}

          {/* Actions bar */}
          {!loading ? (
            canToggleCallInfo ? (
              <div
                className={cn(
                  'mt-1 flex w-full max-w-[760px] items-center justify-between rounded-full px-1.5 py-0.5 transition duration-150 pointer-events-none',
                  isCurrentLeaf
                    ? 'opacity-100 pointer-events-auto'
                    : 'opacity-0 group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto',
                  'hover:bg-paper-shade/70',
                  callInfoOpen && 'bg-paper-shade/70 opacity-100 pointer-events-auto'
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
                    <BranchPill
                      variant={isCurrentLeaf ? 'primary' : 'outline'}
                      onClick={(e) => {
                        e.stopPropagation()
                        void onBranchMessage(message)
                      }}
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
                  className="flex min-w-0 flex-1 items-center justify-end rounded-full px-2 py-1 text-xs font-medium text-sand transition hover:text-sand-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sand/20"
                  onClick={handleToggleCallInfo}
                >
                  调用详情
                </button>
              </div>
            ) : (
              <div
                className={cn(
                  'mt-1 flex items-center gap-1 px-0.5 transition duration-150 pointer-events-none',
                  isCurrentLeaf
                    ? 'opacity-100 pointer-events-auto'
                    : 'opacity-0 group-hover:opacity-100 group-hover:pointer-events-auto group-focus-within:opacity-100 group-focus-within:pointer-events-auto',
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
                  <BranchPill
                    variant={isCurrentLeaf ? 'primary' : 'outline'}
                    onClick={(e) => {
                      e.stopPropagation()
                      void onBranchMessage(message)
                    }}
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
        </>
      )}

      {/* Call info panel */}
      {!isUser && !loading && callInfoOpen && callInfo ? (
        <div className="mt-2 w-full max-w-[760px] rounded-[22px] border border-rule bg-paper-warm px-4 py-4 shadow-[0_18px_40px_-36px_rgba(44,37,25,0.18)]">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-ink-faint">
            <span className="font-medium text-ink">原始调用详情</span>
            <span className="font-mono">{formatLatency(callInfo)}</span>
            <span>{callInfo.provider || 'provider'}</span>
            <span>{callInfo.model || 'model'}</span>
          </div>

          <div className="mt-4 grid gap-3 text-xs text-ink-faint sm:grid-cols-2">
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
              <div key={label} className="rounded-2xl border border-rule bg-paper px-3 py-3">
                <div>{label}</div>
                <div className="mt-1 break-all font-mono text-ink">{value}</div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  )
}
