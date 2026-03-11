export const endpointQueryKeys = {
  all: ['endpoints'] as const,
  list: () => [...endpointQueryKeys.all, 'list'] as const
}
