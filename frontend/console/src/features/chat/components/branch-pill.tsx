import { GitBranch } from 'lucide-react'
import type { MouseEvent, ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'

type BranchPillProps = {
  variant?: 'primary' | 'outline'
  onClick: (event: MouseEvent<HTMLButtonElement>) => void
  children?: ReactNode
}

export function BranchPill({
  variant = 'primary',
  onClick,
  children = '从这里分叉'
}: BranchPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-sans transition-colors',
        variant === 'primary'
          ? 'bg-sand text-white hover:bg-sand-hover'
          : 'border border-sand text-sand hover:bg-sand/5'
      )}
    >
      <GitBranch className="size-3" />
      {children}
    </button>
  )
}
