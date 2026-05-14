import type { TreeNode } from '@/features/chat/chat-types'
import { cn } from '@/shared/lib/cn'

type TreeNodeViewProps = {
  node: TreeNode
  isFocused: boolean
  onClick: (node: TreeNode) => void
  onMouseEnter: (node: TreeNode) => void
  onMouseLeave: () => void
}

export function TreeNodeView({
  node,
  isFocused,
  onClick,
  onMouseEnter,
  onMouseLeave
}: TreeNodeViewProps) {
  const dotColor = node.kind === 'summary' ? 'bg-moss' : 'bg-sand'
  return (
    <button
      type="button"
      onClick={() => onClick(node)}
      onMouseEnter={() => onMouseEnter(node)}
      onMouseLeave={onMouseLeave}
      style={{ paddingLeft: 12 + node.depth * 10 }}
      className={cn(
        'w-full text-left text-xs leading-7 relative pr-2',
        'hover:bg-paper-shade transition-colors',
        node.state === 'current' && 'text-ink font-semibold',
        node.state === 'sibling' && 'text-ink-soft',
        node.state === 'stale' && 'text-ink-faint line-through opacity-70',
        node.kind === 'summary' && 'text-moss italic font-serif',
        isFocused && 'bg-paper-shade'
      )}
    >
      <span
        className={cn(
          'absolute size-1.5 rounded-full top-[14px]',
          dotColor,
          node.state === 'current' ? 'opacity-100 ring-2 ring-sand/20' : 'opacity-50'
        )}
        style={{ left: 8 + node.depth * 10 - 2 }}
        aria-hidden
      />
      <span className="ml-3">
        {node.kind === 'summary' ? '📦 ' : ''}
        {node.preview}
      </span>
    </button>
  )
}
