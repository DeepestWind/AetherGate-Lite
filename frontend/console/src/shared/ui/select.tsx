import type { SelectHTMLAttributes } from 'react'
import { cn } from '@/shared/lib/cn'

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        'flex h-11 w-full rounded-2xl border border-border bg-panel-strong px-4 py-2 text-sm text-foreground outline-none transition focus:border-accent/35 focus:ring-2 focus:ring-accent/15',
        className
      )}
      {...props}
    />
  )
}
