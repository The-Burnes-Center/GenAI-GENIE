import type { QueryClient } from '@tanstack/react-query'
import { sessionKeys } from '../api/query-keys'
import type { SessionDetail } from '../api/types'

// Applies a generated title to the open chat right away. The sidebar list refreshes on settle.
export function applyGeneratedTitle(queryClient: QueryClient, sessionId: string, title: string): void {
  queryClient.setQueryData<SessionDetail>(sessionKeys.detail(sessionId), (detail) =>
    detail ? { ...detail, session: { ...detail.session, title } } : detail,
  )
  void queryClient.invalidateQueries({ queryKey: sessionKeys.all })
}
