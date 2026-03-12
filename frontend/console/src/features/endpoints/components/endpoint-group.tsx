import { EndpointCard } from '@/features/endpoints/components/endpoint-card'
import type { Endpoint } from '@/features/endpoints/endpoint-types'

type EndpointGroupProps = {
  endpoints: Endpoint[]
  onDelete: (id: number) => void
  onEdit: (id: number) => void
  onToggleEnabled: (endpoint: Endpoint) => void
  onValidate: (id: number) => void
  title: string
  validatingId: number | null
}

export function EndpointGroup({
  endpoints,
  onDelete,
  onEdit,
  onToggleEnabled,
  onValidate,
  title,
  validatingId
}: EndpointGroupProps) {
  const primaryPriority = Math.min(...endpoints.map((endpoint) => endpoint.priority))
  const primaryEntries = endpoints.filter((endpoint) => endpoint.priority === primaryPriority)

  return (
    <section className="space-y-4">
      <header className="flex flex-wrap items-center gap-3">
        <div className="h-px w-5 bg-border" />
        <h3 className="font-mono text-[15px] font-semibold text-accent">{title}</h3>
        <span className="rounded-md border border-border bg-panel-strong px-2 py-1 text-[11px] text-muted-foreground">
          {endpoints.length} 个接入点
        </span>
        <div className="hidden h-px flex-1 bg-border md:block" />
        {primaryEntries.length > 1 ? (
          <div className="flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span>P{primaryPriority} 同级</span>
            {primaryEntries.map((endpoint) => (
              <span key={endpoint.id} className="font-mono">
                {endpoint.name}
              </span>
            ))}
          </div>
        ) : null}
      </header>

      <div className="grid gap-4 xl:grid-cols-2 2xl:grid-cols-3">
        {endpoints.map((endpoint) => (
          <EndpointCard
            key={endpoint.id}
            endpoint={endpoint}
            validating={validatingId === endpoint.id}
            onValidate={onValidate}
            onEdit={onEdit}
            onToggleEnabled={onToggleEnabled}
            onDelete={onDelete}
          />
        ))}
      </div>
    </section>
  )
}
