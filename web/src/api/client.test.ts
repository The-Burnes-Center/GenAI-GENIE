import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiFetch, withQuery } from './client'
import { ApiError } from './errors'

vi.mock('aws-amplify/auth', () => ({
  fetchAuthSession: vi.fn(async () => ({ tokens: { idToken: { toString: () => 'test-id-token' } } })),
}))

describe('apiFetch', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('injects the ID token as a bearer header and parses the JSON body', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ sub: 'u1', email: 'a@b.c', isAdmin: false })))
    const me = await apiFetch<{ sub: string }>('/api/me')
    expect(me.sub).toBe('u1')
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-id-token')
  })

  it('turns the { error: { code, message } } shape into an ApiError', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'FORBIDDEN', message: 'Admins only.' } }), { status: 403 }),
    )
    const error = await apiFetch('/api/admin/users').catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 403, code: 'FORBIDDEN', message: 'Admins only.' })
  })

  it('falls back to a status message when the error body is not the contract shape', async () => {
    fetchMock.mockResolvedValue(new Response('<html>Bad gateway</html>', { status: 502 }))
    const error = await apiFetch('/api/sessions').catch((caught: unknown) => caught)
    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ status: 502, code: 'HTTP_502' })
  })

  it('sends a JSON body with a content type for writes', async () => {
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ id: 's1' })))
    await apiFetch('/api/sessions/s1', { method: 'PATCH', body: { title: 'New' } })
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init.method).toBe('PATCH')
    expect(init.body).toBe('{"title":"New"}')
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('application/json')
  })
})

describe('withQuery', () => {
  it('drops empty optional values', () => {
    expect(withQuery('/api/sessions', { q: '', cursor: undefined, limit: 5 })).toBe('/api/sessions?limit=5')
    expect(withQuery('/api/sessions', { q: 'x y' })).toBe('/api/sessions?q=x+y')
  })
})
