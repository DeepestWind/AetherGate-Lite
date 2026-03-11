import type { InputHTMLAttributes } from 'react'
import { cn } from '@/shared/lib/cn'

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'flex h-10 w-full rounded-[14px] border border-border bg-panel-strong px-4 py-2 text-[14px] text-foreground outline-none transition focus:border-accent/35 focus:ring-2 focus:ring-accent/15',
        className
      )}
      {...props}
    />
  )
}
