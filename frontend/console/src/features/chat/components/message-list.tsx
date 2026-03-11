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
    <div ref={listRef} className="flex-1 overflow-y-auto px-5 py-5">
      {messages.length === 0 ? (
        <div className="mx-auto flex min-h-full max-w-xl flex-col items-center justify-center gap-4 text-center">
          <div className="flex size-16 items-center justify-center rounded-full border border-border bg-panel-strong text-accent">
            <Sparkles className="size-7" />
          </div>
          <h2 className="text-2xl font-semibold">AetherGate 对话演示</h2>
          <p className="text-sm leading-6 text-muted-foreground">
            发送消息体验 AI 路由、缓存命中和模型切换。
          </p>
          <div className="flex flex-wrap justify-center gap-2 text-xs text-muted-foreground">
            {['缓存命中', '智能路由', 'Prompt 注入'].map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-border bg-panel-strong px-3 py-1.5"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {messages.map((message) => (
            <MessageBubble key={message.id} {...message} />
          ))}
        </div>
      )}
    </div>
  )
}
