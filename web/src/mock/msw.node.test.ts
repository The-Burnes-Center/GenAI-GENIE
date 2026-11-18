// Smoke test: the same handler list that setupWorker uses in the browser, run through msw's Node server.
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { setupServer } from 'msw/node'
import { readNdjson } from '../chat/ndjson'
import { parseChatEventLine } from '../chat/events'
import type { ChatEvent } from '../chat/types'
import type { AdminUser, Bootstrap, Page } from '../api/types'
import { mockHandlers } from './handlers'
import { MOCK_TOKEN } from './identity'
import { resetMockForTests } from './test-utils'

const server = setupServer(...mockHandlers)
const origin = window.location.origin

function auth(): HeadersInit {
  return { Authorization: `Bearer ${MOCK_TOKEN}`, Accept: 'application/json' }
}

describe('mock handlers under msw/node', () => {
  beforeAll(() => {
    server.listen({ onUnhandledFrame: 'error' })
  })

  afterAll(() => {
    server.close()
  })

  beforeEach(() => {
    resetMockForTests()
  })

  it('serves bootstrap, sessions, admin users and a streamed chat reply', async () => {
    const bootstrap = await fetch(`${origin}/api/bootstrap`, { headers: auth() })
    expect(bootstrap.status).toBe(200)
    const body = (await bootstrap.json()) as Bootstrap
    expect(body.usage.limit).toBe(100)

    const sessions = await fetch(`${origin}/api/sessions`, { headers: auth() })
    expect(sessions.status).toBe(200)
    expect(((await sessions.json()) as Page<unknown>).items.length).toBe(50)

    const users = await fetch(`${origin}/api/admin/users`, { headers: auth() })
    expect(users.status).toBe(200)
    const pending = (await (await fetch(`${origin}/api/admin/users?status=pending`, { headers: auth() })).json()) as Page<AdminUser>
    expect(pending.items).toHaveLength(2)

    const chat = await fetch(`${origin}/api/chat`, {
      method: 'POST',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ modelId: 'us.anthropic.claude-haiku-5-5', prompt: 'Quick question', mode: 'chat' }),
    })
    expect(chat.headers.get('Content-Type')).toBe('application/x-ndjson')
    const events: ChatEvent[] = []
    await readNdjson(chat.body as ReadableStream<Uint8Array>, (line) => {
      const event = parseChatEventLine(line)
      if (event) events.push(event)
    })
    expect(events[0].type).toBe('session')
    expect(events.at(-1)?.type).toBe('title')
  })
})
