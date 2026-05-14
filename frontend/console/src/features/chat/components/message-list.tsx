import { Sparkles } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { chatStarterPrompts } from '@/features/chat/chat-page-utils'
import type { ChatMessage } from '@/features/chat/chat-types'
import { MessageBubble } from './message-bubble'
import { SummaryNode } from './summary-node'

type MessageListProps = {
  messages: ChatMessage[]
  messageNodes: Record<string, ChatMessage>
  onBranchMessage: (message: ChatMessage) => void | Promise<void>
  onEditMessage: (message: ChatMessage, content: string) => void | Promise<void>
  onRegenerateMessage: (message: ChatMessage) => void | Promise<void>
  onSelectSiblingMessage: (messageId: string) => void | Promise<void>
  onStarterPromptSelect: (prompt: string) => void
  onTogglePinMessage: (message: ChatMessage) => void
}

type AssistantSiblingMeta = {
  index: number
  nextId: string | null
  previousId: string | null
  total: number
}

function buildAssistantSiblingMeta(messageNodes: Record<string, ChatMessage>) {
  const groups = new Map<string, ChatMessage[]>()

  for (const message of Object.values(messageNodes)) {
    if (message.role !== 'assistant' || message.archived) {
      continue
    }

    const groupKey = message.parentId ?? '__root__'
    const group = groups.get(groupKey)
    if (group) {
      group.push(message)
      continue
    }

    groups.set(groupKey, [message])
  }

  const metadata: Record<string, AssistantSiblingMeta> = {}

  for (const siblings of groups.values()) {
    const orderedSiblings = [...siblings].sort((left, right) => {
      if (left.timestamp !== right.timestamp) {
        return left.timestamp - right.timestamp
      }
      return left.id.localeCompare(right.id)
    })

    if (orderedSiblings.length <= 1) {
      continue
    }

    orderedSiblings.forEach((message, index) => {
      metadata[message.id] = {
        index,
        previousId: orderedSiblings[index - 1]?.id ?? null,
        nextId: orderedSiblings[index + 1]?.id ?? null,
        total: orderedSiblings.length
      }
    })
  }

  return metadata
}

export function MessageList({
  messages,
  messageNodes,
  onBranchMessage,
  onEditMessage,
  onRegenerateMessage,
  onSelectSiblingMessage,
  onStarterPromptSelect,
  onTogglePinMessage
}: MessageListProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const siblingMeta = useMemo(() => buildAssistantSiblingMeta(messageNodes), [messageNodes])
  const stickToBottomRef = useRef(true)
  const lastMessageSignature = useMemo(() => {
    const lastMessage = messages[messages.length - 1]
    if (!lastMessage) {
      return 'empty'
    }

    return `${lastMessage.id}:${lastMessage.status}:${lastMessage.content.length}`
  }, [messages])

  useEffect(() => {
    if (!listRef.current) {
      return
    }

    if (lastMessageSignature === 'empty') {
      listRef.current.scrollTop = 0
      return
    }

    if (!stickToBottomRef.current) {
      return
    }

    listRef.current.scrollTop = listRef.current.scrollHeight
  }, [lastMessageSignature])

  return (
    <div
      ref={listRef}
      data-chat-message-list
      className="h-full min-h-0 flex-1 overflow-y-auto"
      onScroll={(event) => {
        const element = event.currentTarget
        const remaining = element.scrollHeight - element.scrollTop - element.clientHeight
        stickToBottomRef.current = remaining < 72
      }}
    >
      {messages.length === 0 ? (
        <div className="mx-auto flex min-h-full w-full max-w-[820px] flex-col items-center justify-center px-6 py-12 text-center">
          <div className="flex size-12 items-center justify-center rounded-full border border-border bg-panel text-accent">
            <Sparkles className="size-6" />
          </div>
          <h2 className="mt-5 text-4xl font-semibold tracking-[-0.05em] text-foreground">
            今天想聊点什么？
          </h2>
          <p className="mt-3 max-w-xl text-sm leading-6 text-muted-foreground">
            选择一个会话或直接开始提问。高级参数默认收起，主界面只保留对话本身。
          </p>

          <div className="mt-8 grid w-full gap-3 sm:grid-cols-2">
            {chatStarterPrompts.map((prompt) => (
              <button
                key={prompt}
                type="button"
                className="rounded-2xl border border-border bg-panel px-4 py-4 text-left text-sm text-foreground transition hover:border-border-strong hover:bg-secondary"
                onClick={() => onStarterPromptSelect(prompt)}
              >
                {prompt}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-[820px] space-y-8 px-4 py-8 sm:px-6">
          {messages.map((message) => {
            if (message.kind === 'summary') {
              const archivedMessages = (message.archivedNodeIds ?? [])
                .map((id) => messageNodes[id])
                .filter((value): value is ChatMessage => Boolean(value))
              return (
                <SummaryNode
                  key={message.id}
                  message={message}
                  archivedMessages={archivedMessages}
                />
              )
            }
            return (
              <MessageBubble
                key={message.id}
                message={message}
                onBranchMessage={onBranchMessage}
                onEditMessage={onEditMessage}
                onRegenerateMessage={onRegenerateMessage}
                onSelectSiblingMessage={onSelectSiblingMessage}
                siblingIndex={siblingMeta[message.id]?.index ?? 0}
                siblingCount={siblingMeta[message.id]?.total ?? 1}
                previousSiblingId={siblingMeta[message.id]?.previousId ?? null}
                nextSiblingId={siblingMeta[message.id]?.nextId ?? null}
                onTogglePinMessage={onTogglePinMessage}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}
