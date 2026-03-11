import axios from 'axios'
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: (failureCount, error) => {
        if (axios.isAxiosError(error) && error.response?.status === 401) {
          return false
        }

        return failureCount < 1
      },
      refetchOnWindowFocus: false
    },
    mutations: {
      retry: 0
    }
  }
})
