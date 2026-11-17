import { useQuery } from '@tanstack/react-query'
import { apiFetch } from './client'
import { bootstrapKey } from './query-keys'
import type { Bootstrap, Me } from './types'

const BOOTSTRAP_STALE_MS = 5 * 60_000

export function fetchBootstrap(): Promise<Bootstrap> {
  return apiFetch<Bootstrap>('/api/bootstrap')
}

export function fetchMe(): Promise<Me> {
  return apiFetch<Me>('/api/me')
}

// Settings, enabled models, enabled templates and the current user, shared by the shell and pages.
export function useBootstrap() {
  return useQuery({
    queryKey: bootstrapKey,
    queryFn: fetchBootstrap,
    staleTime: BOOTSTRAP_STALE_MS,
  })
}
