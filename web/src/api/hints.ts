import { useMutation, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { mergeHints, withHint } from '../chat/hints'
import { apiFetch } from './client'
import { addOverlayHint, clearOverlay, overlayFor } from './hint-overlay'
import { bootstrapKey } from './query-keys'
import type { Bootstrap, HintId, HintInput, HintsResponse } from './types'

const SAVE_RETRIES = 1
const RETRY_DELAY_MS = 1500

export function postHint(hint: HintId): Promise<HintsResponse> {
  const body: HintInput = { hint }
  return apiFetch<HintsResponse>('/api/me/hints', { method: 'POST', body })
}

export function clearHints(): Promise<HintsResponse> {
  return apiFetch<HintsResponse>('/api/me/hints', { method: 'DELETE' })
}

function patchHints(client: QueryClient, update: (hints: HintId[]) => HintId[]): void {
  client.setQueryData<Bootstrap>(bootstrapKey, (old) => (old ? { ...old, me: { ...old.me, hints: update(old.me.hints) } } : old))
}

// What the server said plus what was dismissed in this tab.
export function seenHints(client: QueryClient): HintId[] {
  const me = client.getQueryData<Bootstrap>(bootstrapKey)?.me
  return mergeHints(me?.hints ?? [], overlayFor(me?.email ?? ''))
}

// Marks a tip seen. The local overlay and the cache change first, so the tip is gone on the next render. The
// save retries once. If it still fails the overlay keeps the tip dismissed for this visit.
export function useMarkHint() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: postHint,
    retry: SAVE_RETRIES,
    retryDelay: RETRY_DELAY_MS,
    onMutate: (hint) => {
      addOverlayHint(client.getQueryData<Bootstrap>(bootstrapKey)?.me.email ?? '', hint)
      patchHints(client, (hints) => withHint(hints, hint))
    },
    onSuccess: (response) => patchHints(client, (hints) => mergeHints(hints, response.hints)),
    onError: (error) => console.error('Could not save that tip as seen', error),
  })
}

// "Show tips again": clears the list on the server, then locally.
export function useResetHints() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: clearHints,
    onSuccess: (response) => {
      clearOverlay()
      patchHints(client, () => response.hints)
    },
  })
}
