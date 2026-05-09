import { cva, type VariantProps } from 'class-variance-authority'
import type { HTMLAttributes } from 'react'
import { cn } from '@/shared/lib/cn'

const badgeVariants = cva(
  'inline-flex items-center rounded-md px-2 py-0.5 text-xs font-sans font-medium',
  {
    variants: {
      variant: {
        default: 'bg-paper-shade text-ink-soft border border-rule',
        accent: 'bg-moss/10 text-moss border border-moss/20',
        sand: 'bg-sand/10 text-sand border border-sand/20',
        moss: 'bg-moss/10 text-moss border border-moss/20',
        terracotta: 'bg-terracotta/10 text-terracotta border border-terracotta/30',
        outline: 'bg-transparent text-ink-soft border border-rule'
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
