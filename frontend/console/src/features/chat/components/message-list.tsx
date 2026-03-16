import { Sparkles } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { chatStarterPrompts } from '@/features/chat/chat-page-utils'
import type { ChatMessage } from '@/features/chat/chat-types'
import { MessageBubble } from './message-bubble'

type MessageListProps = {
  pinnedMessageIds: Set<string>
  messages: ChatMessage[]
  onBranchMessage: (message: ChatMessage) => void | Promise<void>
  onEditMessage: (message: ChatMessage) => void
  onStarterPromptSelect: (prompt: string) => void
  onTogglePinMessage: (message: ChatMessage) => void
}

export function MessageList({
  pinnedMessageIds,
  messages,
  onBranchMessage,
  onEditMessage,
  onStarterPromptSelect,
  onTogglePinMessage
}: MessageListProps) {
  const listRef = useRef<HTMLDivElement>(null)
  const messageCount = messages.length

  useEffect(() => {
    if (!listRef.current) {
      return
    }

    if (messageCount === 0) {
      listRef.current.scrollTop = 0
      return
    }

    listRef.current.scrollTop = listRef.current.scrollHeight
  }, [messageCount])

  return (
    <div ref={listRef} data-chat-message-list className="h-full min-h-0 flex-1 overflow-y-auto">
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
          {messages.map((message) => (
            <MessageBubble
              key={message.id}
              isPinned={pinnedMessageIds.has(message.id)}
              message={message}
              onBranchMessage={onBranchMessage}
              onEditMessage={onEditMessage}
              onTogglePinMessage={onTogglePinMessage}
            />
          ))}
        </div>
      )}
    </div>
  )
}
