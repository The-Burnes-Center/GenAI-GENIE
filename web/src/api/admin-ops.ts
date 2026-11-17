import { useQuery } from '@tanstack/react-query'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch, segment, withQuery } from './client'
import { flattenPages, usePagedQuery } from './paging'
import { adminKeys } from './query-keys'
import type {
  AuditEntry,
  FeedbackFilters,
  FeedbackRecord,
  Page,
  ReviewFeedbackInput,
  ReviewFeedbackResponse,
  UsageReport,
} from './types'

export function getUsage(from: string, to: string): Promise<UsageReport> {
  return apiFetch<UsageReport>(withQuery('/api/admin/usage', { from, to }))
}

export function listFeedback(filters: FeedbackFilters, cursor?: string): Promise<Page<FeedbackRecord>> {
  return apiFetch<Page<FeedbackRecord>>(
    withQuery('/api/admin/feedback', {
      rating: filters.rating,
      modelId: filters.modelId,
      reviewed: filters.reviewed === undefined ? undefined : String(filters.reviewed),
      cursor,
    }),
  )
}

export function markFeedbackReviewed(id: string, reviewed: boolean): Promise<ReviewFeedbackResponse> {
  const body: ReviewFeedbackInput = { reviewed }
  return apiFetch<ReviewFeedbackResponse>(`/api/admin/feedback/${segment(id)}`, { method: 'PATCH', body })
}

export function listAudit(cursor?: string): Promise<Page<AuditEntry>> {
  return apiFetch<Page<AuditEntry>>(withQuery('/api/admin/audit', { cursor }))
}

// Dates are yyyy-mm-dd. The query stays disabled until both bounds are set.
export function useAdminUsage(from: string, to: string) {
  return useQuery({
    queryKey: adminKeys.usage(from, to),
    queryFn: () => getUsage(from, to),
    enabled: from !== '' && to !== '',
  })
}

export function useAdminFeedback(filters: FeedbackFilters = {}) {
  const query = usePagedQuery(adminKeys.feedback(filters), (cursor) => listFeedback(filters, cursor))
  return { ...query, items: flattenPages(query.data) }
}

// Refreshes every admin view, since the triage state shows in the feedback list and the filters.
export function useMarkFeedbackReviewed() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, reviewed }: { id: string; reviewed: boolean }) => markFeedbackReviewed(id, reviewed),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: adminKeys.all }),
  })
}

export function useAdminAudit() {
  const query = usePagedQuery(adminKeys.audit(), (cursor) => listAudit(cursor))
  return { ...query, items: flattenPages(query.data) }
}
