import dayjs from 'dayjs'
import { ServerCog, ShieldCheck, TimerReset } from 'lucide-react'
import { useMemo } from 'react'
import { CostTrendChart } from '@/features/dashboard/components/cost-trend-chart'
import { ModelDistributionChart } from '@/features/dashboard/components/model-distribution-chart'
import { RecentLogsTable } from '@/features/dashboard/components/recent-logs-table'
import { StatCard } from '@/features/dashboard/components/stat-card'
import { useDashboardLogsQuery } from '@/features/dashboard/queries/use-dashboard-logs-query'
import { useDashboardMetricsQuery } from '@/features/dashboard/queries/use-dashboard-metrics-query'
import { useDashboardStatsQuery } from '@/features/dashboard/queries/use-dashboard-stats-query'
import { useApiAccessState } from '@/shared/auth/use-api-access'
import { Button } from '@/shared/ui/button'
import { AuthRequiredState } from '@/shared/ui/auth-required-state'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'

export function DashboardPage() {
  const { hasHydrated, hasToken } = useApiAccessState()
  const metricsQuery = useDashboardMetricsQuery()
  const statsQuery = useDashboardStatsQuery(7)
  const logsQuery = useDashboardLogsQuery({ page: 0, size: 10 })

  if (!hasHydrated) {
    return <div className="h-[420px] animate-pulse rounded-[20px] bg-secondary" />
  }

  if (!hasToken) {
    return (
      <AuthRequiredState description="概览页依赖 /internal/metrics、/internal/stats 和 /internal/logs，请先配置 Bearer Token。" />
    )
  }

  const hasBlockingError = metricsQuery.isError && statsQuery.isError && logsQuery.isError

  const lastUpdatedLabel = useMemo(() => {
    const updatedAt = Math.max(
      metricsQuery.dataUpdatedAt || 0,
      statsQuery.dataUpdatedAt || 0,
      logsQuery.dataUpdatedAt || 0
    )

    return updatedAt > 0 ? dayjs(updatedAt).format('HH:mm:ss') : '等待首屏数据'
  }, [logsQuery.dataUpdatedAt, metricsQuery.dataUpdatedAt, statsQuery.dataUpdatedAt])

  const handleRefresh = async () => {
    await Promise.all([metricsQuery.refetch(), statsQuery.refetch(), logsQuery.refetch()])
  }

  return (
    <div className="space-y-6">
      {hasBlockingError ? (
        <Card className="border-danger/20 bg-[linear-gradient(135deg,rgba(213,78,78,0.08),rgba(213,78,78,0.03))]">
          <CardHeader>
            <CardTitle>Dashboard 数据加载失败</CardTitle>
            <CardDescription>
              当前三个查询都未成功返回。请确认后端已启动，并且本地代理能转发到当前配置的后端地址。
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleRefresh}>重试全部查询</Button>
          </CardContent>
        </Card>
      ) : null}

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          title="今日调用"
          value={metricsQuery.data?.formattedCalls ?? '--'}
          subtitle="次请求"
          statusTone="info"
          loading={metricsQuery.isLoading}
        />
        <StatCard
          title="今日花费"
          value={metricsQuery.data?.formattedCost ?? '--'}
          subtitle="美元"
          statusTone="accent"
          loading={metricsQuery.isLoading}
        />
        <StatCard
          title="平均延迟"
          value={metricsQuery.data?.formattedLatency ?? '--'}
          subtitle="端到端"
          statusTone="warning"
          loading={metricsQuery.isLoading}
        />
        <StatCard
          title="在线模型"
          value={String(metricsQuery.data?.modelDistribution.length ?? 0)}
          subtitle="逻辑模型"
          statusTone="success"
          loading={metricsQuery.isLoading}
        />
      </section>

      <div className="flex items-center justify-between gap-4">
        <div className="text-sm font-mono text-muted-foreground">更新于 {lastUpdatedLabel}</div>
        <Button
          onClick={handleRefresh}
          disabled={metricsQuery.isFetching || statsQuery.isFetching || logsQuery.isFetching}
        >
          刷新
        </Button>
      </div>

      <section className="grid gap-5 xl:grid-cols-[1.18fr_0.82fr]">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>费用趋势</CardTitle>
              <CardDescription>最近 7 天调用量与费用变化。</CardDescription>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-panel-strong px-4 py-2 text-sm text-muted-foreground">
              <ServerCog className="size-4 text-accent" />
              /internal/stats
            </div>
          </CardHeader>
          <CardContent>
            <CostTrendChart data={statsQuery.data ?? []} loading={statsQuery.isLoading} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>模型分布</CardTitle>
              <CardDescription>今日模型调用量占比。</CardDescription>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-panel-strong px-4 py-2 text-sm text-muted-foreground">
              <ShieldCheck className="size-4 text-success" />
              /internal/metrics
            </div>
          </CardHeader>
          <CardContent>
            <ModelDistributionChart
              data={metricsQuery.data?.modelDistribution ?? []}
              loading={metricsQuery.isLoading}
            />
          </CardContent>
        </Card>
      </section>

      <section>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <div>
              <CardTitle>最近调用</CardTitle>
              <CardDescription>最新 10 条请求日志。</CardDescription>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-panel-strong px-4 py-2 text-sm text-muted-foreground">
              <TimerReset className="size-4 text-accent" />
              更新于 {lastUpdatedLabel}
            </div>
          </CardHeader>
          <CardContent>
            <RecentLogsTable data={logsQuery.data?.content ?? []} loading={logsQuery.isLoading} />
          </CardContent>
        </Card>
      </section>
    </div>
  )
}
