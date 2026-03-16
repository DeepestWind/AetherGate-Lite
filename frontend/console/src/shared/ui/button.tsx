import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/shared/lib/cn'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-[14px] border text-[14px] font-medium transition disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/30',
  {
    variants: {
      variant: {
        default:
          'border-accent bg-accent text-white shadow-[0_14px_28px_-18px_rgba(223,90,79,0.72)] hover:border-accent-strong hover:bg-accent-strong',
        danger:
          'border-danger bg-danger text-white shadow-[0_14px_28px_-18px_rgba(213,78,78,0.54)] hover:border-danger/90 hover:bg-danger/90',
        secondary:
          'border-border bg-secondary text-foreground hover:border-border-strong hover:bg-elevated',
        ghost:
          'border-transparent bg-transparent text-muted-foreground hover:bg-secondary hover:text-foreground',
        outline:
          'border-border bg-panel-strong text-foreground hover:border-border-strong hover:bg-secondary'
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 rounded-xl px-3 text-[13px]',
        icon: 'size-9 rounded-[14px]'
      }
    },
    defaultVariants: {
      variant: 'default',
      size: 'default'
    }
  }
)

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }

export function Button({ asChild = false, className, size, variant, ...props }: ButtonProps) {
  const Comp = asChild ? Slot : 'button'

  return <Comp className={cn(buttonVariants({ variant, size }), className)} {...props} />
}
