import { QueryClient } from '@tanstack/react-query'
import { ApiError } from './errors'

const MAX_RETRIES = 2

// Client errors (4xx) are not retried: they will not succeed on a second try.
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        retry: (failureCount, error) => {
          if (error instanceof ApiError && error.status < 500) return false
          return failureCount < MAX_RETRIES
        },
      },
    },
  })
}
