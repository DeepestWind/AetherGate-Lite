import type { EChartsOption, TooltipComponentFormatterCallbackParams } from 'echarts'
import { LineChart } from 'echarts/charts'
import { GridComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import type { DashboardStatPoint } from '@/features/dashboard/dashboard-types'
import { CardDescription } from '@/shared/ui/card'

echarts.use([LineChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer])

type CostTrendChartProps = {
  data: DashboardStatPoint[]
  loading?: boolean
}

type AxisTooltipRow = {
  axisValue?: number | string
  marker?: string
  seriesName?: string
  value?: unknown
}

const NOTEBOOK_PALETTE = {
  primary: '#94785a',   // sand
  secondary: '#7d9477', // moss
  tertiary: '#6b5d44',  // ink-soft
  grid: '#e8dfce',      // rule
  text: '#6b5d44'       // ink-soft
}

function buildOption(data: DashboardStatPoint[]): EChartsOption {
  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'axis',
      backgroundColor: '#ffffff',
      borderColor: 'rgba(32,32,38,0.12)',
      textStyle: { color: '#2b2f38' },
      formatter: (params: TooltipComponentFormatterCallbackParams) => {
        const rows = (Array.isArray(params) ? params : [params]) as AxisTooltipRow[]
        const title = rows[0]?.axisValue ?? ''

        return rows.reduce((markup, row) => {
          const value = Number(row.value ?? 0)
          const formatted =
            row.seriesName === '费用' ? `$${value.toFixed(4)}` : `${value.toLocaleString()} 次`

          return `${markup}<div>${row.marker}${row.seriesName}：${formatted}</div>`
        }, `<div style="margin-bottom:6px;font-weight:600">${title}</div>`)
      }
    },
    legend: {
      right: 0,
      textStyle: { color: NOTEBOOK_PALETTE.text }
    },
    grid: {
      left: 56,
      right: 48,
      top: 40,
      bottom: 30
    },
    xAxis: {
      type: 'category',
      data: data.map((point) => point.dateLabel),
      axisLine: { lineStyle: { color: NOTEBOOK_PALETTE.grid } },
      axisTick: { show: false },
      axisLabel: { color: NOTEBOOK_PALETTE.text }
    },
    yAxis: [
      {
        type: 'value',
        name: '费用(USD)',
        nameTextStyle: { color: NOTEBOOK_PALETTE.text },
        axisLabel: {
          color: NOTEBOOK_PALETTE.text,
          formatter: (value: number) => `$${Number(value).toFixed(4)}`
        },
        splitLine: {
          lineStyle: {
            color: NOTEBOOK_PALETTE.grid,
            type: 'dashed'
          }
        }
      },
      {
        type: 'value',
        name: '调用次数',
        nameTextStyle: { color: NOTEBOOK_PALETTE.text },
        axisLabel: { color: NOTEBOOK_PALETTE.text },
        splitLine: { show: false }
      }
    ],
    series: [
      {
        name: '费用',
        type: 'line',
        smooth: true,
        yAxisIndex: 0,
        data: data.map((point) => point.totalCostUsd),
        lineStyle: { width: 3, color: NOTEBOOK_PALETTE.primary },
        itemStyle: { color: NOTEBOOK_PALETTE.primary },
        symbolSize: 7,
        areaStyle: {
          color: {
            type: 'linear',
            x: 0,
            y: 0,
            x2: 0,
            y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(148,120,90,0.24)' },
              { offset: 1, color: 'rgba(148,120,90,0.02)' }
            ]
          }
        }
      },
      {
        name: '调用次数',
        type: 'line',
        smooth: true,
        yAxisIndex: 1,
        data: data.map((point) => point.totalCalls),
        lineStyle: { width: 3, color: NOTEBOOK_PALETTE.secondary },
        itemStyle: { color: NOTEBOOK_PALETTE.secondary },
        symbolSize: 7
      }
    ]
  }
}

export function CostTrendChart({ data, loading = false }: CostTrendChartProps) {
  if (loading) {
    return <div className="h-[280px] animate-pulse rounded-[24px] bg-secondary" />
  }

  if (data.length === 0) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-[24px] border border-dashed border-border">
        <CardDescription>最近 7 天暂无统计数据。</CardDescription>
      </div>
    )
  }

  return (
    <ReactEChartsCore
      echarts={echarts}
      option={buildOption(data)}
      notMerge
      lazyUpdate
      style={{ height: 280, width: '100%' }}
    />
  )
}
