import { beforeEach, describe, expect, it } from 'vitest'
import type { Bootstrap, Page, Session } from '../api/types'
import { setMockAsUser, writeMockSignIn } from './identity'
import { dispatchMockRequest } from './router'
import { getStore } from './store'
import { resetMockForTests, withAuth } from './test-utils'

function get(path: string): Promise<Response> {
  return dispatchMockRequest(withAuth(new Request(`http://localhost${path}`)))
}

async function sessionPage(path: string): Promise<Page<Session>> {
  return (await (await get(path)).json()) as Page<Session>
}

describe('mock session list', () => {
  beforeEach(() => {
    resetMockForTests()
  })

  it('returns 50 sessions per page with a cursor, then the rest', async () => {
    const first = await sessionPage('/api/sessions')
    expect(first.items).toHaveLength(50)
    expect(first.nextCursor).toBe('50')

    const second = await sessionPage('/api/sessions?cursor=50')
    expect(second.items.length).toBe(getStore().sessions.length - 50)
    expect(second.nextCursor).toBeNull()

    const ids = [...first.items, ...second.items].map((session) => session.sessionId)
    expect(new Set(ids).size).toBe(getStore().sessions.length)
  })

  it('orders sessions newest first across pages', async () => {
    const first = await sessionPage('/api/sessions')
    const stamps = first.items.map((session) => Date.parse(session.updatedAt))
    expect([...stamps].sort((a, b) => b - a)).toEqual(stamps)
  })

  it('filters by title with case-insensitive ?q= search', async () => {
    const page = await sessionPage('/api/sessions?q=BUDGET')
    expect(page.items.length).toBeGreaterThan(0)
    expect(page.items.every((session) => session.title.toLowerCase().includes('budget'))).toBe(true)
    expect(page.nextCursor).toBeNull()
  })

  it('returns no matches for a title that does not exist', async () => {
    const page = await sessionPage('/api/sessions?q=zzz-no-such-title')
    expect(page).toEqual({ items: [], nextCursor: null })
  })
})

describe('mock bootstrap and access', () => {
  beforeEach(() => {
    resetMockForTests()
  })

  it('returns usage and the admin pending count for the default admin', async () => {
    const body = (await (await get('/api/bootstrap')).json()) as Bootstrap
    expect(body.usage).toMatchObject({ used: 12, limit: 100 })
    expect(body.me).toMatchObject({ isAdmin: true, pendingCount: 2 })
    expect(body.models.every((model) => model.enabled)).toBe(true)
  })

  it('rejects calls without a bearer token', async () => {
    const response = await dispatchMockRequest(new Request('http://localhost/api/sessions'))
    expect(response.status).toBe(401)
  })

  it('hides admin routes from a non-admin and drops pendingCount', async () => {
    setMockAsUser(true)
    expect((await get('/api/admin/users')).status).toBe(403)
    const body = (await (await get('/api/bootstrap')).json()) as Bootstrap
    expect(body.me.isAdmin).toBe(false)
    expect(body.me.pendingCount).toBeUndefined()
  })

  it('blocks a pending account from every data route, bootstrap included, like the real API', async () => {
    writeMockSignIn({ email: 'pending.person@example.org', status: 'pending' })
    for (const path of ['/api/bootstrap', '/api/me', '/api/sessions']) {
      const blocked = await get(path)
      expect(blocked.status).toBe(403)
      expect(await blocked.json()).toMatchObject({ error: { code: 'PENDING_APPROVAL' } })
    }
  })

  it('answers an unknown route with the error contract', async () => {
    const response = await get('/api/not-a-route')
    expect(response.status).toBe(404)
    expect(await response.json()).toMatchObject({ error: { code: 'NOT_FOUND' } })
  })
})
