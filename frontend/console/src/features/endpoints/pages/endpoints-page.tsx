import { BadgeCheck, DatabaseZap, Layers2, Plus, Power } from 'lucide-react'
import { useDeferredValue, useMemo } from 'react'
import { EndpointDialog } from '@/features/endpoints/components/endpoint-dialog'
import { EndpointFilterBar } from '@/features/endpoints/components/endpoint-filter-bar'
import { EndpointGroup } from '@/features/endpoints/components/endpoint-group'
import { EndpointOverviewCard } from '@/features/endpoints/components/endpoint-overview-card'
import type { Endpoint, EndpointFormValues } from '@/features/endpoints/endpoint-types'
import { useCreateEndpointMutation } from '@/features/endpoints/mutations/use-create-endpoint-mutation'
import { useDeleteEndpointMutation } from '@/features/endpoints/mutations/use-delete-endpoint-mutation'
import { useToggleEndpointMutation } from '@/features/endpoints/mutations/use-toggle-endpoint-mutation'
import { useUpdateEndpointMutation } from '@/features/endpoints/mutations/use-update-endpoint-mutation'
import { useValidateEndpointMutation } from '@/features/endpoints/mutations/use-validate-endpoint-mutation'
import { useEndpointsQuery } from '@/features/endpoints/queries/use-endpoints-query'
import { useEndpointsUiStore } from '@/features/endpoints/stores/use-endpoints-ui-store'
import { useApiAccessState } from '@/shared/auth/use-api-access'
import { AuthRequiredState } from '@/shared/ui/auth-required-state'
import { Button } from '@/shared/ui/button'
import { CardDescription, CardTitle } from '@/shared/ui/card'

function resolveLogicalModel(endpoint: Endpoint) {
  return endpoint.logicalModel || endpoint.modelName || '未命名模型'
}

export function EndpointsPage() {
  const { hasHydrated, hasToken } = useApiAccessState()
  const query = useEndpointsQuery()
  const createMutation = useCreateEndpointMutation()
  const updateMutation = useUpdateEndpointMutation()
  const deleteMutation = useDeleteEndpointMutation()
  const toggleMutation = useToggleEndpointMutation()
  const validateMutation = useValidateEndpointMutation()

  const {
    filters,
    dialogMode,
    editingEndpointId,
    isDialogOpen,
    setFilter,
    resetFilters,
    openCreateDialog,
    openEditDialog,
    closeDialog
  } = useEndpointsUiStore()

  const deferredKeyword = useDeferredValue(filters.keyword.trim().toLowerCase())
  const endpoints = query.data ?? []

  const logicalModelOptions = useMemo(
    () => Array.from(new Set(endpoints.map((endpoint) => resolveLogicalModel(endpoint)))),
    [endpoints]
  )

  const filteredEndpoints = useMemo(() => {
    return endpoints.filter((endpoint) => {
      if (filters.providerType && endpoint.providerType !== filters.providerType) {
        return false
      }

      const logicalModel = resolveLogicalModel(endpoint)
      if (filters.logicalModel && logicalModel !== filters.logicalModel) {
        return false
      }

      if (filters.status === 'enabled' && !endpoint.isEnabled) {
        return false
      }
      if (filters.status === 'disabled' && endpoint.isEnabled) {
        return false
      }
      if (filters.status === 'valid' && !endpoint.isValid) {
        return false
      }
      if (filters.status === 'invalid' && endpoint.isValid) {
        return false
      }

      if (deferredKeyword && !endpoint.name.toLowerCase().includes(deferredKeyword)) {
        return false
      }

      return true
    })
  }, [deferredKeyword, endpoints, filters.logicalModel, filters.providerType, filters.status])

  const groupedEndpoints = useMemo(() => {
    const grouped = new Map<string, Endpoint[]>()

    for (const endpoint of filteredEndpoints) {
      const logicalModel = resolveLogicalModel(endpoint)
      const currentGroup = grouped.get(logicalModel) ?? []
      currentGroup.push(endpoint)
      grouped.set(logicalModel, currentGroup)
    }

    return Array.from(grouped.entries()).map(([logicalModel, entries]) => ({
      logicalModel,
      endpoints: [...entries].sort(
        (left, right) => left.priority - right.priority || right.weight - left.weight
      )
    }))
  }, [filteredEndpoints])

  const enabledCount = endpoints.filter((endpoint) => endpoint.isEnabled).length
  const validCount = endpoints.filter((endpoint) => endpoint.isValid).length

  const editingEndpoint =
    dialogMode === 'edit'
      ? (endpoints.find((endpoint) => endpoint.id === editingEndpointId) ?? null)
      : null

  const handleDialogSubmit = async (values: EndpointFormValues) => {
    if (dialogMode === 'edit' && editingEndpoint) {
      await updateMutation.mutateAsync({
        id: editingEndpoint.id,
        providerType: editingEndpoint.providerType,
        values
      })
    } else {
      await createMutation.mutateAsync(values)
    }

    closeDialog()
  }

  if (!hasHydrated) {
    return <div className="h-[420px] animate-pulse rounded-[20px] bg-secondary" />
  }

  if (!hasToken) {
    return (
      <AuthRequiredState description="Endpoint 管理页需要访问 /api/endpoints，请先配置 Bearer Token。" />
    )
  }

  return (
    <div className="space-y-6">
      <section className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <CardTitle className="text-[26px] tracking-[-0.04em]">Endpoint 管理</CardTitle>
          <CardDescription className="max-w-3xl">
            管理 AI 模型接入点，保持 URL、Key、模型映射和调度策略的一致配置。
          </CardDescription>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="size-4" />
          新增 Endpoint
        </Button>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <EndpointOverviewCard
          title="全部接入点"
          value={endpoints.length}
          subtitle="当前 Endpoint 总数"
          icon={<DatabaseZap className="size-5" />}
        />
        <EndpointOverviewCard
          title="启用中"
          value={enabledCount}
          subtitle="参与调度的接入点"
          icon={<Power className="size-5" />}
        />
        <EndpointOverviewCard
          title="Key 有效"
          value={validCount}
          subtitle="最近一次验证成功"
          icon={<BadgeCheck className="size-5" />}
        />
        <EndpointOverviewCard
          title="逻辑模型"
          value={logicalModelOptions.length}
          subtitle="按 logicalModel 去重"
          icon={<Layers2 className="size-5" />}
        />
      </section>

      <EndpointFilterBar
        filters={filters}
        logicalModelOptions={logicalModelOptions}
        onChange={setFilter}
        onReset={resetFilters}
        resultCount={filteredEndpoints.length}
      />

      <section className="rounded-[20px] border border-border bg-panel p-5 shadow-panel">
        {query.isLoading ? (
          <div className="h-[280px] animate-pulse rounded-[18px] bg-secondary" />
        ) : query.isError ? (
          <div className="flex min-h-[280px] flex-col items-center justify-center gap-4 text-center">
            <div className="text-lg font-medium">Endpoint 列表加载失败</div>
            <p className="max-w-lg text-sm leading-6 text-muted-foreground">
              请确认后端接口 `/api/endpoints` 可访问，或检查当前本地开发代理配置。
            </p>
            <Button onClick={() => query.refetch()}>重试</Button>
          </div>
        ) : groupedEndpoints.length === 0 ? (
          <div className="flex min-h-[280px] flex-col items-center justify-center gap-4 text-center">
            <div className="text-lg font-medium">暂无符合筛选条件的 Endpoint</div>
            <p className="max-w-lg text-sm leading-6 text-muted-foreground">
              你可以清空筛选条件，或者直接创建新的接入点配置。
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={resetFilters}>
                清空筛选
              </Button>
              <Button onClick={openCreateDialog}>
                <Plus className="size-4" />
                新增 Endpoint
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {groupedEndpoints.map((group) => (
              <EndpointGroup
                key={group.logicalModel}
                title={group.logicalModel}
                endpoints={group.endpoints}
                validatingId={
                  validateMutation.isPending ? (validateMutation.variables ?? null) : null
                }
                onValidate={(id) => validateMutation.mutate(id)}
                onEdit={openEditDialog}
                onToggleEnabled={(endpoint) =>
                  toggleMutation.mutate({
                    id: endpoint.id,
                    enabled: !endpoint.isEnabled
                  })
                }
                onDelete={(id) => deleteMutation.mutate(id)}
              />
            ))}
          </div>
        )}
      </section>

      <EndpointDialog
        open={isDialogOpen}
        mode={dialogMode}
        endpoint={editingEndpoint}
        pending={createMutation.isPending || updateMutation.isPending}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) {
            closeDialog()
          }
        }}
        onSubmit={handleDialogSubmit}
      />
    </div>
  )
}
