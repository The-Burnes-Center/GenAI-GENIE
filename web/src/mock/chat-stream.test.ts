import { beforeEach, describe, expect, it } from 'vitest'
import { readNdjson } from '../chat/ndjson'
import { parseChatEventLine } from '../chat/events'
import type { ChatEvent } from '../chat/types'
import { dispatchMockRequest } from './router'
import { getStore } from './store'
import { resetMockForTests, withAuth } from './test-utils'
import { SONNET_ID } from './seed-catalog'

// Sends a chat request through the mock router and reads the NDJSON with the app's own reader.
async function chat(body: Record<string, unknown>): Promise<ChatEvent[]> {
  const request = new Request('http://localhost/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ modelId: SONNET_ID, prompt: 'Summarize the snow plan.', mode: 'chat', ...body }),
  })
  const response = await dispatchMockRequest(withAuth(request))
  expect(response.headers.get('Content-Type')).toBe('application/x-ndjson')
  const events: ChatEvent[] = []
  await readNdjson(response.body as ReadableStream<Uint8Array>, (line) => {
    const event = parseChatEventLine(line)
    if (event) events.push(event)
  })
  return events
}

describe('mock POST /api/chat', () => {
  beforeEach(() => {
    resetMockForTests()
  })

  it('streams session, ping, deltas, done and title in that order for a new chat', async () => {
    const events = await chat({})
    // Sonnet reasons, so reasoning events come before the answer text.
    const types = events.map((event) => event.type)
    const visible = types.filter((type) => type !== 'reasoning')
    expect(visible.slice(0, 2)).toEqual(['session', 'ping'])
    expect(visible.slice(-2)).toEqual(['done', 'title'])
    expect(visible.slice(2, -2).every((type) => type === 'delta')).toBe(true)
    expect(types.indexOf('reasoning')).toBeLessThan(types.indexOf('delta'))
    expect(visible.filter((type) => type === 'delta').length).toBeGreaterThan(5)
  })

  it('saves the exchange so GET /api/sessions/{id} returns it', async () => {
    const events = await chat({ prompt: 'Hello there' })
    const session = events.find((event) => event.type === 'session')
    expect(session?.type).toBe('session')
    if (session?.type !== 'session') return
    const detail = await dispatchMockRequest(withAuth(new Request(`http://localhost/api/sessions/${session.sessionId}`)))
    const body = (await detail.json()) as { messages: Array<{ role: string; content: string }> }
    expect(body.messages.map((message) => message.role)).toEqual(['user', 'assistant'])
    expect(body.messages[0].content).toBe('Hello there')
    expect(body.messages[1].content.length).toBeGreaterThan(0)
  })

  it('emits reasoning for a deep-thinking request and citations when a workspace is set', async () => {
    const events = await chat({ settings: { thinking: 'deep' }, workspaceId: 'w1' })
    const types = new Set(events.map((event) => event.type))
    expect(types.has('reasoning')).toBe(true)
    expect(types.has('citations')).toBe(true)
  })

  it('answers a prompt containing "error" with BEDROCK_THROTTLED and keeps the user message', async () => {
    const events = await chat({ prompt: 'Why did this error happen?' })
    const error = events.find((event) => event.type === 'error')
    expect(error).toMatchObject({ type: 'error', code: 'BEDROCK_THROTTLED' })
    expect(events.some((event) => event.type === 'done')).toBe(false)
    const session = getStore().sessions[0]
    expect(session.messages.map((message) => message.role)).toEqual(['user', 'assistant'])
  })

  it('returns LIMIT_REACHED with resetsAt when the prompt contains "limit"', async () => {
    const events = await chat({ prompt: 'What is the limit on leave?' })
    expect(events).toEqual([
      expect.objectContaining({ type: 'error', code: 'LIMIT_REACHED', resetsAt: expect.any(String) }),
    ])
  })

  it('replaces the failed pair when retryOfMessageId is sent', async () => {
    const first = await chat({ prompt: 'Trigger an error now' })
    const failed = first.find((event) => event.type === 'session')
    if (failed?.type !== 'session') throw new Error('expected a session event')
    const retry = await chat({ sessionId: failed.sessionId, prompt: 'Trigger an error now', retryOfMessageId: failed.messageId })
    expect(retry.some((event) => event.type === 'error')).toBe(true)
    const session = getStore().sessions.find((item) => item.sessionId === failed.sessionId)
    expect(session?.messages).toHaveLength(2)
  })
})
