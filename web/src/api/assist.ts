import { useMutation } from '@tanstack/react-query'
import { apiFetch } from './client'
import type { RewriteInput, RewriteResponse } from './types'

export function rewriteRequest(text: string): Promise<RewriteResponse> {
  const body: RewriteInput = { text }
  return apiFetch<RewriteResponse>('/api/assist/rewrite', { method: 'POST', body })
}

// "Help me ask": one call, no caching. The panel holds the result.
export function useRewrite() {
  return useMutation({ mutationFn: rewriteRequest })
}
