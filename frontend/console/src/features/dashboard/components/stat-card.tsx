import { cn } from '@/shared/lib/cn'
import { Badge } from '@/shared/ui/badge'
import { Card, CardContent } from '@/shared/ui/card'

type StatCardProps = {
  loading?: boolean
  statusTone?: 'accent' | 'info' | 'success' | 'warning'
  subtitle: string
  title: string
  value: string
}

const toneClasses: Record<NonNullable<StatCardProps['statusTone']>, string> = {
  accent: 'from-accent-soft to-transparent text-accent',
  info: 'from-accent-strong/10 to-transparent text-accent-strong',
  success: 'from-success/10 to-transparent text-success',
  warning: 'from-warning/12 to-transparent text-warning'
}

export function StatCard({
  loading = false,
  statusTone = 'info',
  subtitle,
  title,
  value
}: StatCardProps) {
  return (
    <Card className="overflow-hidden">
      <CardContent className="relative p-[18px]">
        <div
          className={cn(
            'pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b opacity-95',
            toneClasses[statusTone]
          )}
        />
        <div className="relative space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[14px] font-medium text-muted-foreground">{title}</div>
            <Badge variant="outline">{subtitle}</Badge>
          </div>
          {loading ? (
            <div className="space-y-2">
              <div className="h-9 w-28 animate-pulse rounded-2xl bg-secondary" />
              <div className="h-4 w-20 animate-pulse rounded-full bg-secondary" />
            </div>
          ) : (
            <div>
              <div className="text-[36px] font-semibold tracking-[-0.05em] text-foreground">
                {value}
              </div>
              <div className="mt-2 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                Live metric
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
