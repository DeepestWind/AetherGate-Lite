import type { ReactNode } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/shared/lib/cn'

type CollapseRailProps = {
  side: 'left' | 'right'
  onToggle: () => void
  children?: ReactNode
}

export function CollapseRail({ side, onToggle, children }: CollapseRailProps) {
  const Chevron = side === 'left' ? ChevronRight : ChevronLeft
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 py-3 bg-paper-warm',
        side === 'left' ? 'border-r border-rule' : 'border-l border-rule'
      )}
      style={{ width: 36 }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="size-6 rounded-md border border-rule bg-surface-card text-ink-faint hover:text-ink hover:border-sand transition-colors flex items-center justify-center"
        aria-label={side === 'left' ? '展开左栏' : '展开右栏'}
      >
        <Chevron className="size-3.5" />
      </button>
      {children}
    </div>
  )
}
