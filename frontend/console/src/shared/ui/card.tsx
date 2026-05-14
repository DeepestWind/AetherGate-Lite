import type { HTMLAttributes } from 'react'
import { cn } from '@/shared/lib/cn'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <section className={cn('bg-paper-warm border border-rule rounded-lg', className)} {...props} />
  )
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('space-y-1 p-4', className)} {...props} />
}

export function CardTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2
      className={cn('text-xl font-semibold tracking-tight text-foreground', className)}
      {...props}
    />
  )
}

export function CardDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn('text-[14px] leading-6 text-muted-foreground', className)} {...props} />
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('px-4 pb-4', className)} {...props} />
}
