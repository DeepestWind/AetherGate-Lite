import type { ReactNode } from 'react'
import { Card, CardContent } from '@/shared/ui/card'

type EndpointOverviewCardProps = {
  icon: ReactNode
  subtitle: string
  title: string
  value: string | number
}

export function EndpointOverviewCard({ icon, subtitle, title, value }: EndpointOverviewCardProps) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="text-[12px] font-medium text-muted-foreground">{title}</div>
          <div className="rounded-[16px] border border-border bg-secondary p-2.5 text-accent">
            {icon}
          </div>
        </div>
        <div className="mt-4 text-[34px] font-semibold tracking-[-0.05em]">{value}</div>
        <div className="mt-2 text-sm text-muted-foreground">{subtitle}</div>
      </CardContent>
    </Card>
  )
}
