import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch } from './client'
import { sessionKeys } from './query-keys'
import type { DeleteAllSessionsResponse } from './types'

export type DeleteBatchResult = DeleteAllSessionsResponse

const MAX_BATCHES = 500

// One call removes a batch of chats and reports how many are left.
export function deleteChatBatch(): Promise<DeleteBatchResult> {
  return apiFetch<DeleteBatchResult>('/api/sessions', { method: 'DELETE' })
}

// Calls the batch deleter until nothing remains. maxBatches stops a server that never reports progress.
export async function deleteAllChats(
  callOnce: () => Promise<DeleteBatchResult>,
  onProgress: (deletedSoFar: number) => void,
  maxBatches: number = MAX_BATCHES,
): Promise<number> {
  let total = 0
  for (let batch = 0; batch < maxBatches; batch += 1) {
    const result = await callOnce()
    total += result.deleted
    onProgress(total)
    if (result.remaining <= 0) return total
  }
  throw new Error('Some chats could not be deleted. Try again.')
}

export function useDeleteAllChats() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (onProgress: (deletedSoFar: number) => void) => deleteAllChats(deleteChatBatch, onProgress),
    onSettled: () => queryClient.invalidateQueries({ queryKey: sessionKeys.all }),
  })
}
