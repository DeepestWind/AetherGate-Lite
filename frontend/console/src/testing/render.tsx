import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { type RenderOptions, render as rtlRender } from '@testing-library/react'
import type { PropsWithChildren, ReactElement } from 'react'

function TestProviders({ children }: PropsWithChildren) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false
      },
      mutations: {
        retry: false
      }
    }
  })

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
}

export function render(ui: ReactElement, options?: Omit<RenderOptions, 'wrapper'>) {
  return rtlRender(ui, {
    wrapper: TestProviders,
    ...options
  })
}
