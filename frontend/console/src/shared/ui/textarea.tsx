import { forwardRef, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/shared/lib/cn'

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => {
  return (
    <textarea
      ref={ref}
      className={cn(
        'flex min-h-28 w-full rounded-2xl border border-border bg-panel-strong px-4 py-3 text-sm text-foreground outline-none transition focus:border-accent/35 focus:ring-2 focus:ring-accent/15',
        className
      )}
      {...props}
    />
  )
})

Textarea.displayName = 'Textarea'
