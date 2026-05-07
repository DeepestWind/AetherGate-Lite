import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/shared/lib/cn'

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 rounded-md border text-[14px] font-medium transition disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sand/30',
  {
    variants: {
      variant: {
        default:
          'border-sand bg-sand text-white hover:border-sand-hover hover:bg-sand-hover',
        danger:
          'border-terracotta bg-terracotta text-white hover:opacity-90',
        secondary:
          'border-rule bg-paper text-ink hover:border-sand hover:text-sand',
        ghost:
          'border-transparent bg-transparent text-ink-soft hover:bg-paper-shade hover:text-ink',
        outline:
          'border-rule bg-transparent text-ink hover:bg-paper-shade'
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-[13px]',
        icon: 'size-9 rounded-md'
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
