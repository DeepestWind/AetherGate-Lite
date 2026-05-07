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
        'w-full min-h-28 bg-paper-warm border border-rule rounded-md px-3 py-2 text-ink placeholder:text-ink-faint focus:border-sand focus:outline-none focus:ring-1 focus:ring-sand/20 disabled:opacity-60 disabled:cursor-not-allowed font-sans text-sm',
        className
      )}
      {...props}
    />
  )
})

Textarea.displayName = 'Textarea'
