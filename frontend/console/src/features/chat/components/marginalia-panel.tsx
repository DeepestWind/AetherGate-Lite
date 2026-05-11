import { ChevronRight } from 'lucide-react'
import type { ChatMessage, TreeNode } from '@/features/chat/chat-types'
import { ConversationTreePanel } from './conversation-tree-panel'

type MarginaliaPanelProps = {
  tree: TreeNode[]
  pinnedMessages: ChatMessage[]
  focusedId: string | null
  onCollapse: () => void
  onNodeClick: (node: TreeNode) => void
  onNodeHover: (node: TreeNode | null) => void
}

export function MarginaliaPanel({
  tree,
  pinnedMessages,
  focusedId,
  onCollapse,
  onNodeClick,
  onNodeHover
}: MarginaliaPanelProps) {
  return (
    <div className="h-full flex flex-col">
      <div className="px-3.5 pt-3 pb-2 border-b border-rule-soft flex items-center justify-between">
        <span className="font-serif italic text-xs text-ink-soft">树形检视</span>
        <button
          type="button"
          onClick={onCollapse}
          className="text-ink-faint hover:text-ink"
          aria-label="收起树形检视"
        >
          <ChevronRight className="size-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <ConversationTreePanel
          tree={tree}
          focusedId={focusedId}
          onNodeClick={onNodeClick}
          onNodeHover={onNodeHover}
        />
      </div>

      {pinnedMessages.length > 0 ? (
        <div className="border-t border-dashed border-rule px-3.5 py-3">
          <div className="font-serif italic text-[11px] text-ink-soft mb-1.5">Pinned</div>
          {pinnedMessages.map((message) => (
            <div key={message.id} className="text-[11px] text-ink-soft pl-3 relative truncate">
              <span className="absolute left-0 text-[10px] opacity-60">📎</span>
              {message.content.slice(0, 40)}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  )
}
