import { Sparkles } from 'lucide-react'
import { useEffect, useRef } from 'react'
import type { ChatMessage } from '@/features/chat/chat-types'
import { MessageBubble } from './message-bubble'

type MessageListProps = {
  messages: ChatMessage[]
}

export function MessageList({ messages }: MessageListProps) {
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
        <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col items-center justify-center px-6 py-10 text-center">
          <div className="flex size-14 items-center justify-center rounded-full border border-border bg-panel text-accent shadow-card">
            <Sparkles className="size-6" />
          </div>
          <h2 className="mt-5 text-3xl font-semibold tracking-[-0.04em] text-foreground">
            开始一段新对话
          </h2>
          <p className="mt-2 max-w-lg text-sm leading-6 text-muted-foreground">
            在这里直接体验路由策略、Prompt
            注入、缓存命中和模型切换。左侧可以管理会话，底部输入区会一直保持在可见区域。
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
            {['多会话切换', '缓存命中', '智能路由', 'Prompt 注入'].map((tag) => (
              <span key={tag} className="rounded-full border border-border bg-panel px-3 py-1.5">
                {tag}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="mx-auto w-full max-w-4xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
          {messages.map((message) => (
            <MessageBubble key={message.id} {...message} />
          ))}
        </div>
      )}
    </div>
  )
}
