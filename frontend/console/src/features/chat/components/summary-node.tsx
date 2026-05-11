import { useState } from 'react'
import { ChevronDown, ChevronUp, Package } from 'lucide-react'
import type { ChatMessage } from '@/features/chat/chat-types'
import { cn } from '@/shared/lib/cn'

type SummaryNodeProps = {
  message: ChatMessage  // kind === 'summary'
  archivedMessages: ChatMessage[]  // resolved from archivedNodeIds against messageNodes
}

export function SummaryNode({ message, archivedMessages }: SummaryNodeProps) {
  const [expanded, setExpanded] = useState(false)
  const canExpand = archivedMessages.length > 0

  return (
    <div
      data-message-id={message.id}
      className={cn(
        'mb-[18px] rounded-r-md border-l-[3px] border-moss px-4 py-3 transition-shadow',
        expanded ? 'bg-surface-card shadow-panel' : 'bg-paper-warm'
      )}
    >
      <div className="flex items-baseline justify-between gap-3">
        <div className="font-serif italic text-xs text-moss flex items-center gap-1.5">
          <Package className="size-3" />
          已压缩 {archivedMessages.length} 条消息
        </div>
        {canExpand ? (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            className="text-[11px] text-moss hover:opacity-80 inline-flex items-center gap-1"
          >
            {expanded ? <>收起 <ChevronUp className="size-3" /></> : <>展开原始内容 <ChevronDown className="size-3" /></>}
          </button>
        ) : null}
      </div>

      <p className="text-xs text-ink-soft leading-relaxed mt-1">{message.content}</p>

      {expanded && canExpand ? (
        <div className="mt-3 pt-3 border-t border-dashed border-rule space-y-2.5">
          {archivedMessages.map((entry) => (
            <div key={entry.id} className="pl-3 border-l-2 border-rule">
              <span className="font-serif italic text-[11px] text-ink-soft mr-1.5">
                {entry.role === 'user' ? 'You' : 'AI'}
              </span>
              <span className="text-xs text-ink-faint leading-relaxed">{entry.content}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
