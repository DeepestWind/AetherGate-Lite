import dayjs from 'dayjs'
import type { DashboardLogRow } from '@/features/dashboard/dashboard-types'
import { cn } from '@/shared/lib/cn'
import { Badge } from '@/shared/ui/badge'
import { CardDescription } from '@/shared/ui/card'

type RecentLogsTableProps = {
  data: DashboardLogRow[]
  loading?: boolean
}

function getStatusTone(status: string) {
  const normalized = status.toLowerCase()

  if (normalized === 'success') {
    return 'text-success border-success/30 bg-success/10'
  }
  if (normalized === 'fallback') {
    return 'text-warning border-warning/30 bg-warning/10'
  }
  if (normalized === 'error') {
    return 'text-danger border-danger/30 bg-danger/10'
  }

  return 'text-muted-foreground border-border bg-secondary'
}

function getLatencyTone(latencyMs: number) {
  if (latencyMs < 500) {
    return 'text-success'
  }
  if (latencyMs > 2_000) {
    return 'text-warning'
  }

  return 'text-foreground'
}

export function RecentLogsTable({ data, loading = false }: RecentLogsTableProps) {
  if (loading) {
    return <div className="h-[360px] animate-pulse rounded-[24px] bg-secondary" />
  }

  if (data.length === 0) {
    return (
      <div className="flex h-[240px] items-center justify-center rounded-[24px] border border-dashed border-border">
        <CardDescription>暂无调用记录。</CardDescription>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-[24px] border border-border">
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-secondary text-xs uppercase tracking-[0.18em] text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">时间</th>
              <th className="px-4 py-3 font-medium">模型</th>
              <th className="px-4 py-3 font-medium">状态</th>
              <th className="px-4 py-3 text-right font-medium">Token</th>
              <th className="px-4 py-3 text-right font-medium">费用</th>
              <th className="px-4 py-3 text-right font-medium">延迟</th>
              <th className="px-4 py-3 text-center font-medium">缓存</th>
            </tr>
          </thead>
          <tbody>
            {data.map((row, index) => (
              <tr
                key={row.id}
                className={cn(
                  'border-t border-border',
                  index % 2 === 0 ? 'bg-panel-strong' : 'bg-elevated/70'
                )}
              >
                <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                  {dayjs(row.timestamp).isValid()
                    ? dayjs(row.timestamp).format('HH:mm:ss')
                    : '--:--:--'}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-accent">{row.actualModel}</td>
                <td className="px-4 py-3">
                  <span
                    className={cn(
                      'inline-flex rounded-full border px-2.5 py-1 text-[11px] uppercase tracking-[0.14em]',
                      getStatusTone(row.status)
                    )}
                  >
                    {row.status}
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs text-muted-foreground">
                  {row.totalTokens.toLocaleString()}
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs text-foreground">
                  ${row.costUsd.toFixed(6)}
                </td>
                <td
                  className={cn(
                    'px-4 py-3 text-right font-mono text-xs',
                    getLatencyTone(row.latencyMs)
                  )}
                >
                  {row.latencyMs}ms
                </td>
                <td className="px-4 py-3 text-center">
                  <Badge variant={row.cacheHit ? 'accent' : 'outline'}>
                    {row.cacheHit ? 'HIT' : 'MISS'}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
