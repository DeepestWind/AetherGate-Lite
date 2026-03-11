import { cva, type VariantProps } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'
import { cn } from '@/shared/lib/cn'

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium tracking-[0.16em] uppercase',
  {
    variants: {
      variant: {
        accent: 'border-accent/25 bg-accent-soft text-accent',
        outline: 'border-border bg-panel-strong text-muted-foreground'
      }
    },
    defaultVariants: {
      variant: 'outline'
    }
  }
)

type BadgeProps = HTMLAttributes<HTMLDivElement> & VariantProps<typeof badgeVariants>

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />
}
