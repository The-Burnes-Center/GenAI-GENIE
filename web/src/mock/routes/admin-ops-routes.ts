import type { AuditEntry, FeedbackRecord, Page, Rating, ReviewFeedbackInput, ReviewFeedbackResponse, UsageReport } from '../../api/types'
import { json, MockHttpError, paginate, readJson } from '../http'
import { getStore } from '../store'
import type { MockRoute } from '../route-types'
import type { MockIdentity } from '../identity'
import { recordAudit } from './shared'

function usageInRange(url: URL): UsageReport {
  const from = url.searchParams.get('from') ?? ''
  const to = url.searchParams.get('to') ?? ''
  const { usage } = getStore()
  const byDay = usage.byDay.filter((row) => (from === '' || row.day >= from) && (to === '' || row.day <= to))
  const totals = byDay.reduce(
    (sum, row) => ({
      requests: sum.requests + row.requests,
      inputTokens: sum.inputTokens + row.inputTokens,
      outputTokens: sum.outputTokens + row.outputTokens,
    }),
    { requests: 0, inputTokens: 0, outputTokens: 0 },
  )
  return { from, to, totals: { key: 'all', ...totals }, byDay, byModel: usage.byModel, byUser: usage.byUser }
}

function feedbackFilter(url: URL): (record: FeedbackRecord) => boolean {
  const rating = url.searchParams.get('rating')
  const modelId = url.searchParams.get('modelId')
  const reviewed = url.searchParams.get('reviewed')
  return (record) =>
    (!rating || record.rating === (rating as Rating)) &&
    (!modelId || record.modelId === modelId) &&
    (reviewed === null || reviewed === '' || String(record.reviewed) === reviewed)
}

async function markReviewed(id: string, request: Request, identity: MockIdentity): Promise<Response> {
  const body = await readJson<Partial<Record<keyof ReviewFeedbackInput, unknown>>>(request)
  if (typeof body.reviewed !== 'boolean') throw new MockHttpError(400, 'BAD_REQUEST', 'Set reviewed to true or false.')
  const record = getStore().feedback.find((item) => item.id === id)
  if (!record) throw new MockHttpError(404, 'NOT_FOUND', 'That feedback could not be found.')
  record.reviewed = body.reviewed
  recordAudit(identity, body.reviewed ? 'Marked feedback reviewed' : 'Marked feedback not reviewed', record.userEmail, record.id)
  return json<ReviewFeedbackResponse>({ id: record.id, reviewed: record.reviewed })
}

export const adminOpsRoutes: MockRoute[] = [
  { method: 'GET', path: '/api/admin/usage', access: 'admin', handle: ({ url }) => json<UsageReport>(usageInRange(url)) },
  {
    method: 'GET',
    path: '/api/admin/feedback',
    access: 'admin',
    handle: ({ url }) => {
      const matches = getStore().feedback.filter(feedbackFilter(url))
      return json<Page<FeedbackRecord>>(paginate(matches, url.searchParams.get('cursor')))
    },
  },
  {
    method: 'PATCH',
    path: '/api/admin/feedback/:id',
    access: 'admin',
    handle: ({ params, request, identity }) => markReviewed(params.id, request, identity),
  },
  {
    method: 'GET',
    path: '/api/admin/audit',
    access: 'admin',
    handle: ({ url }) => json<Page<AuditEntry>>(paginate(getStore().audit, url.searchParams.get('cursor'))),
  },
]
