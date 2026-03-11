import { FilterX, Search } from 'lucide-react'
import {
  providerTypeFilterOptions,
  statusFilterOptions
} from '@/features/endpoints/endpoint-constants'
import type { EndpointListFilters } from '@/features/endpoints/endpoint-types'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Select } from '@/shared/ui/select'

type EndpointFilterBarProps = {
  filters: EndpointListFilters
  logicalModelOptions: string[]
  onChange: <K extends keyof EndpointListFilters>(key: K, value: EndpointListFilters[K]) => void
  onReset: () => void
  resultCount: number
}

export function EndpointFilterBar({
  filters,
  logicalModelOptions,
  onChange,
  onReset,
  resultCount
}: EndpointFilterBarProps) {
  return (
    <div className="grid gap-3 rounded-[20px] border border-border bg-panel p-4 shadow-panel lg:grid-cols-[repeat(3,minmax(0,1fr))_1.2fr_auto_auto] lg:items-center">
      <Select
        value={filters.providerType}
        onChange={(event) => onChange('providerType', event.target.value)}
      >
        {providerTypeFilterOptions.map((option) => (
          <option key={option.value || 'all-provider'} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>

      <Select
        value={filters.logicalModel}
        onChange={(event) => onChange('logicalModel', event.target.value)}
      >
        <option value="">全部模型</option>
        {logicalModelOptions.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </Select>

      <Select value={filters.status} onChange={(event) => onChange('status', event.target.value)}>
        {statusFilterOptions.map((option) => (
          <option key={option.value || 'all-status'} value={option.value}>
            {option.label}
          </option>
        ))}
      </Select>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={filters.keyword}
          onChange={(event) => onChange('keyword', event.target.value)}
          placeholder="搜索接入名称"
          className="pl-10"
        />
      </div>

      <Button onClick={onReset} variant="outline" className="min-w-[120px]">
        <FilterX className="size-4" />
        清空筛选
      </Button>

      <div className="justify-self-start text-sm text-muted-foreground lg:justify-self-end">
        共 {resultCount} 个接入点
      </div>
    </div>
  )
}
