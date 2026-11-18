import { beforeEach, describe, expect, it } from 'vitest'
import type { Bootstrap, HintsResponse, RewriteResponse } from '../api/types'
import { writeMockSignIn } from './identity'
import { dispatchMockRequest } from './router'
import { initialSettings } from './seed-catalog'
import { resetMockForTests, withAuth } from './test-utils'

function call(method: string, path: string, body?: unknown): Promise<Response> {
  return dispatchMockRequest(
    withAuth(new Request(`http://localhost${path}`, { method, ...(body === undefined ? {} : { body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } }) })),
  )
}

describe('mock hints', () => {
  beforeEach(resetMockForTests)

  it('starts a brand-new person with no hints, so they see the first-run screen', async () => {
    const boot = (await (await call('GET', '/api/bootstrap')).json()) as Bootstrap
    expect(boot.me.hints).toEqual([])
  })

  it('records each hint once and keeps the list per person', async () => {
    await call('POST', '/api/me/hints', { hint: 'welcome' })
    const again = (await (await call('POST', '/api/me/hints', { hint: 'welcome' })).json()) as HintsResponse
    expect(again.hints).toEqual(['welcome'])
    writeMockSignIn({ email: 'someone.new@example.org', status: 'active' })
    expect(((await (await call('GET', '/api/me')).json()) as { hints: string[] }).hints).toEqual([])
  })

  it('rejects an unknown hint and clears on DELETE', async () => {
    expect((await call('POST', '/api/me/hints', { hint: 'nope' })).status).toBe(400)
    await call('POST', '/api/me/hints', { hint: 'attach' })
    const cleared = (await (await call('DELETE', '/api/me/hints')).json()) as HintsResponse
    expect(cleared.hints).toEqual([])
  })

  it('matches the backend welcome defaults', () => {
    expect(initialSettings()).toMatchObject({ welcomeTitle: 'How can I help today?', welcomeMessage: '' })
  })
})

describe('mock rewrite', () => {
  beforeEach(resetMockForTests)

  it('is deterministic and says what it added', async () => {
    const send = async () => (await (await call('POST', '/api/assist/rewrite', { text: 'write an email about the snow ban' })).json()) as RewriteResponse
    const first = await send()
    expect(await send()).toEqual(first)
    expect(first.text).toContain('[who will read this]')
    expect(first.changes.length).toBeGreaterThan(1)
  })

  it('does not add what is already there', async () => {
    const body = (await (await call('POST', '/api/assist/rewrite', { text: 'Write a short email for a resident because they asked about permits' })).json()) as RewriteResponse
    expect(body.text).not.toContain('[who will read this]')
    expect(body.text).not.toContain('Background:')
    expect(body.text).not.toContain('Format:')
  })

  it('returns the contract errors', async () => {
    expect((await call('POST', '/api/assist/rewrite', { text: ' ' })).status).toBe(400)
    const limit = await call('POST', '/api/assist/rewrite', { text: 'hit the limit now' })
    expect(limit.status).toBe(429)
    expect(((await limit.json()) as { error: { code: string } }).error.code).toBe('LIMIT_REACHED')
    expect((await call('POST', '/api/assist/rewrite', { text: 'please fail' })).status).toBe(502)
    expect((await call('POST', '/api/assist/rewrite', { text: 'so busy today' })).status).toBe(503)
  })
})
