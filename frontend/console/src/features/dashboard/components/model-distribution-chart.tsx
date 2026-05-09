import type { EChartsOption } from 'echarts'
import { PieChart } from 'echarts/charts'
import { GraphicComponent, LegendComponent, TooltipComponent } from 'echarts/components'
import * as echarts from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import { CardDescription } from '@/shared/ui/card'

echarts.use([PieChart, GraphicComponent, LegendComponent, TooltipComponent, CanvasRenderer])

type ModelDistributionChartProps = {
  data: Array<{ name: string; value: number }>
  loading?: boolean
}

const NOTEBOOK_PALETTE = {
  primary: '#94785a',   // sand
  secondary: '#7d9477', // moss
  tertiary: '#6b5d44',  // ink-soft
  grid: '#e8dfce',      // rule
  text: '#6b5d44'       // ink-soft
}

function buildOption(data: Array<{ name: string; value: number }>): EChartsOption {
  return {
    backgroundColor: 'transparent',
    color: [NOTEBOOK_PALETTE.primary, NOTEBOOK_PALETTE.secondary, NOTEBOOK_PALETTE.tertiary, '#b5956a', '#a3b89c', '#8f7d5e'],
    tooltip: {
      trigger: 'item',
      formatter: '{b}: {c} 次 ({d}%)'
    },
    legend: {
      bottom: 0,
      left: 'center',
      textStyle: { color: NOTEBOOK_PALETTE.text }
    },
    graphic: [
      {
        type: 'text',
        left: 'center',
        top: '39%',
        silent: true,
        style: {
          text: '模型分布',
          fill: NOTEBOOK_PALETTE.text,
          fontSize: 12,
          fontFamily: 'var(--font-sans)'
        }
      }
    ],
    series: [
      {
        name: '模型分布',
        type: 'pie',
        radius: ['46%', '72%'],
        center: ['50%', '42%'],
        avoidLabelOverlap: true,
        data,
        label: {
          show: true,
          position: 'outside',
          formatter: '{b}\n{d}%',
          fontSize: 11,
          color: NOTEBOOK_PALETTE.text
        },
        itemStyle: {
          borderColor: '#f4f2ee',
          borderWidth: 2
        },
        labelLine: {
          lineStyle: {
            color: 'rgba(32,32,38,0.12)'
          }
        }
      }
    ]
  }
}

export function ModelDistributionChart({ data, loading = false }: ModelDistributionChartProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0)

  if (loading) {
    return <div className="h-[280px] animate-pulse rounded-[24px] bg-secondary" />
  }

  if (data.length === 0 || total <= 0) {
    return (
      <div className="flex h-[280px] items-center justify-center rounded-[24px] border border-dashed border-border">
        <CardDescription>今日还没有模型调用数据。</CardDescription>
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
