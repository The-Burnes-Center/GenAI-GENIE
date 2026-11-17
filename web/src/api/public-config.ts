import { useQuery } from '@tanstack/react-query'
import { toApiError } from './client'
import { publicConfigKey } from './query-keys'
import type { PublicConfig } from './types'

const PUBLIC_CONFIG_STALE_MS = 60_000
const PUBLIC_CONFIG_PATH = '/api/public-config'

// Unauthenticated on purpose: the sign-in screen needs it before anyone has a token.
export async function fetchPublicConfig(): Promise<PublicConfig> {
  const response = await fetch(PUBLIC_CONFIG_PATH, { headers: { Accept: 'application/json' } })
  if (!response.ok) throw await toApiError(response)
  return (await response.json()) as PublicConfig
}

export function usePublicConfig() {
  return useQuery({
    queryKey: publicConfigKey,
    queryFn: fetchPublicConfig,
    staleTime: PUBLIC_CONFIG_STALE_MS,
  })
}
