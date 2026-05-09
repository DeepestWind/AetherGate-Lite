import type { ReactNode } from 'react'
import { cn } from '@/shared/lib/cn'

type PageHeaderProps = {
  title: ReactNode
  meta?: ReactNode
  actions?: ReactNode
  className?: string
}

export function PageHeader({ title, meta, actions, className }: PageHeaderProps) {
  return (
    <div
      className={cn(
        'border-b border-rule px-9 pt-7 pb-4 flex items-end justify-between gap-4',
        className
      )}
    >
      <div className="min-w-0">
        <h1 className="font-serif text-xl text-ink truncate">{title}</h1>
        {meta ? (
          <p className="font-serif italic text-xs text-ink-faint mt-1">{meta}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2 shrink-0">{actions}</div> : null}
    </div>
  )
}
