import type { TreeNode } from '@/features/chat/chat-types'
import { TreeNodeView } from './tree-node'

type ConversationTreePanelProps = {
  tree: TreeNode[]
  focusedId: string | null
  onNodeClick: (node: TreeNode) => void
  onNodeHover: (node: TreeNode | null) => void
}

export function ConversationTreePanel({
  tree,
  focusedId,
  onNodeClick,
  onNodeHover
}: ConversationTreePanelProps) {
  if (tree.length === 0) {
    return <div className="px-4 py-3 text-xs text-ink-faint italic font-serif">no nodes yet</div>
  }
  return (
    <div className="py-2">
      {tree.map((node) => (
        <TreeNodeView
          key={node.id}
          node={node}
          isFocused={focusedId === node.id}
          onClick={onNodeClick}
          onMouseEnter={(n) => onNodeHover(n)}
          onMouseLeave={() => onNodeHover(null)}
        />
      ))}
    </div>
  )
}
