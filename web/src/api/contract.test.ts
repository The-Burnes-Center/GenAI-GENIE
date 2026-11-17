import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchPublicConfig } from './public-config'
import { deleteChatBatch } from './history'
import { getAdminSettings, listAdminTemplates, upsertTemplate } from './admin-content'
import { inviteUser, updateAdminUser } from './admin-users'
import { renameSession, submitFeedback } from './sessions'
import { addWorkspaceDocument, createWorkspace } from './workspaces'
import type { Template, WorkspaceDocument } from './types'
import { listFeedback, markFeedbackReviewed } from './admin-ops'
import { forkSession } from './sessions'
import { retryWorkspaceDocument } from './workspaces'

vi.mock('aws-amplify/auth', () => ({
  fetchAuthSession: vi.fn(async () => ({ tokens: { idToken: { toString: () => 'test-id-token' } } })),
}))

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } })
}

const DOCUMENT: WorkspaceDocument = {
  docId: 'd5',
  workspaceId: 'w1',
  name: 'a.pdf',
  contentType: 'application/pdf',
  size: 1,
  s3Key: 'workspaces/w1/d5/source.pdf',
  status: 'indexing',
  createdAt: '2026-11-17T10:00:00.000Z',
}

const TEMPLATE: Template = {
  templateId: 'plain-language',
  title: 'Plain language',
  description: '',
  category: 'Writing',
  systemPrompt: '',
  starterPrompt: '',
  enabled: true,
  sortOrder: 1,
}

describe('API contract additions', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('reads public config without an Authorization header', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ appName: 'Genie', signupMode: 'open', allowedEmailDomains: ['example.org'], emailOtp: true }),
    )
    const config = await fetchPublicConfig()
    expect(config.signupMode).toBe('open')
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(fetchMock.mock.calls[0][0]).toBe('/api/public-config')
    expect((init.headers as Record<string, string>).Authorization).toBeUndefined()
  })

  it('sends feedback filters and cursor as query parameters, skipping unset ones', async () => {
    fetchMock.mockImplementation(async () => jsonResponse({ items: [], nextCursor: null }))
    await listFeedback({ rating: 'down', modelId: 'openai.gpt-oss-120b-1:0', reviewed: false }, 'c2')
    expect(fetchMock.mock.calls[0][0]).toBe(
      '/api/admin/feedback?rating=down&modelId=openai.gpt-oss-120b-1%3A0&reviewed=false&cursor=c2',
    )
    await listFeedback({})
    expect(fetchMock.mock.calls[1][0]).toBe('/api/admin/feedback')
  })

  it('marks feedback reviewed with a PATCH body', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ id: 'f1', reviewed: true }))
    await markFeedbackReviewed('f1', true)
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/admin/feedback/f1')
    expect(init.method).toBe('PATCH')
    expect(init.body).toBe('{"reviewed":true}')
  })

  it('forks a session for one model and returns the new session id', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ sessionId: 's9' }))
    const result = await forkSession('s1', { modelId: 'us.anthropic.claude-sonnet-5-5' })
    expect(result.sessionId).toBe('s9')
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/sessions/s1/fork')
    expect(init.method).toBe('POST')
    expect(init.body).toBe('{"modelId":"us.anthropic.claude-sonnet-5-5"}')
  })

  it('retries a failed workspace document', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ document: DOCUMENT }))
    const document = await retryWorkspaceDocument('w1', 'd5')
    expect(document.docId).toBe('d5')
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/workspaces/w1/documents/d5/retry')
    expect(init.method).toBe('POST')
  })
  it('unwraps the { session }, { feedback } and { deleted, remaining } bodies the server sends', async () => {
    const session = { sessionId: 's1', title: 'New title', mode: 'chat', modelId: 'm', createdAt: 't', updatedAt: 't', messageCount: 0 }
    fetchMock.mockResolvedValueOnce(jsonResponse({ session }))
    expect((await renameSession('s1', 'New title')).sessionId).toBe('s1')
    fetchMock.mockResolvedValueOnce(jsonResponse({ feedback: { rating: 'up', at: 't' } }))
    expect(await submitFeedback('s1', 'm1', { rating: 'up' })).toEqual({ rating: 'up', at: 't' })
    fetchMock.mockResolvedValueOnce(jsonResponse({ deleted: 20, remaining: 5 }))
    expect(await deleteChatBatch()).toEqual({ deleted: 20, remaining: 5 })
  })

  it('unwraps { workspace } and { document } bodies and sends only what the schema takes', async () => {
    const workspace = { workspaceId: 'w9', name: 'W', description: '', visibility: 'personal', ownerSub: 's', ownerEmail: 'e', createdAt: 't', docCount: 0 }
    fetchMock.mockResolvedValueOnce(jsonResponse({ workspace }))
    expect((await createWorkspace({ name: 'W' })).workspaceId).toBe('w9')
    fetchMock.mockResolvedValueOnce(jsonResponse({ document: DOCUMENT }))
    expect((await addWorkspaceDocument('w1', { key: 'staging/s/u', name: 'a.pdf' })).docId).toBe('d5')
  })

  it('unwraps admin bodies: settings, templates, invited user, and the { updated } acknowledgement', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ settings: { appName: 'Genie' }, help: { timezone: 'x' } }))
    expect((await getAdminSettings()).appName).toBe('Genie')
    fetchMock.mockResolvedValueOnce(jsonResponse({ templates: [TEMPLATE] }))
    expect(await listAdminTemplates()).toEqual([TEMPLATE])
    fetchMock.mockResolvedValueOnce(jsonResponse({ template: TEMPLATE }))
    expect((await upsertTemplate(TEMPLATE)).templateId).toBe('plain-language')
    const [url, init] = fetchMock.mock.calls.at(-1) as [string, RequestInit]
    expect(url).toBe('/api/admin/templates/plain-language')
    expect(JSON.parse(init.body as string)).not.toHaveProperty('templateId')
    fetchMock.mockResolvedValueOnce(jsonResponse({ user: { username: 'u', sub: 's', email: 'a@x.org' } }))
    expect((await inviteUser({ email: 'a@x.org' })).username).toBe('u')
    fetchMock.mockResolvedValueOnce(jsonResponse({ updated: true }))
    expect(await updateAdminUser('u', { status: 'active' })).toEqual({ updated: true })
  })
})
