import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/client'
import { streamChat } from './stream-chat'
import type { ChatEvent, ChatRequestBody } from './types'

vi.mock('aws-amplify/auth', () => ({
  fetchAuthSession: vi.fn(async () => ({ tokens: { idToken: { toString: () => 'test-id-token' } } })),
}))

const REQUEST: ChatRequestBody = { modelId: 'us.anthropic.claude-sonnet-5-5', prompt: 'hi', mode: 'chat' }

function streamResponse(chunks: string[], status = 200): Response {
  const encoder = new TextEncoder()
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk))
      controller.close()
    },
  })
  return new Response(body, { status, headers: { 'Content-Type': 'application/x-ndjson' } })
}

describe('streamChat', () => {
  let fetchMock: ReturnType<typeof vi.fn>

  beforeEach(() => {
    fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('dispatches every event type in order, including chunks split mid-line', async () => {
    fetchMock.mockResolvedValue(
      streamResponse([
        '{"type":"session","sessionId":"s1","messageId":"m1","title":"Hello"}\n{"type":"ping"}\n',
        '{"type":"notice","code":"HISTORY_TRIMMED","message":"Older turns were trimmed."}\n{"type":"citations","items":[{"index":1,"title":"policy.pdf","snippet":"x","workspaceId":"w1","documentId":"d1"}]}\n{"type":"rea',
        'soning","text":"Considering"}\n{"type":"delta","text":"Hel"}\n{"type":"delta","text":"lo"}\n',
        '{"type":"done","usage":{"inputTokens":120,"outputTokens":340},"latencyMs":2100,"stopReason":"end_turn"}\n{"type":"title","sessionId":"s1","title":"Greeting"}',
      ]),
    )
    const events: ChatEvent[] = []
    await streamChat(REQUEST, { onEvent: (event) => events.push(event) })

    expect(events.map((event) => event.type)).toEqual([
      'session',
      'ping',
      'notice',
      'citations',
      'reasoning',
      'delta',
      'delta',
      'done',
      'title',
    ])
    expect(events[5]).toEqual({ type: 'delta', text: 'Hel' })
    expect(events[7]).toMatchObject({ type: 'done', usage: { inputTokens: 120, outputTokens: 340 }, stopReason: 'end_turn' })
  })

  it('passes error events to the handler instead of throwing', async () => {
    fetchMock.mockResolvedValue(
      streamResponse(['{"type":"error","code":"CONTEXT_TOO_LONG","message":"Too long."}\n']),
    )
    const events: ChatEvent[] = []
    await streamChat(REQUEST, { onEvent: (event) => events.push(event) })
    expect(events).toEqual([{ type: 'error', code: 'CONTEXT_TOO_LONG', message: 'Too long.' }])
  })

  it('skips unknown event types and keeps reading', async () => {
    fetchMock.mockResolvedValue(streamResponse(['{"type":"future_event"}\n{"type":"delta","text":"ok"}\n']))
    const events: ChatEvent[] = []
    await streamChat(REQUEST, { onEvent: (event) => events.push(event) })
    expect(events).toEqual([{ type: 'delta', text: 'ok' }])
  })

  it('throws a protocol error for a line that is not JSON', async () => {
    fetchMock.mockResolvedValue(streamResponse(['not json\n']))
    await expect(streamChat(REQUEST, { onEvent: () => undefined })).rejects.toThrow(/not JSON/)
  })

  it('sends the bearer token and the JSON body to /api/chat', async () => {
    fetchMock.mockResolvedValue(streamResponse(['{"type":"ping"}\n']))
    await streamChat(REQUEST, { onEvent: () => undefined })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('/api/chat')
    expect(init.method).toBe('POST')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer test-id-token')
    expect(JSON.parse(init.body as string)).toEqual(REQUEST)
  })

  it('sends retryOfMessageId so the server replaces the failed pair', async () => {
    fetchMock.mockResolvedValue(streamResponse(['{"type":"ping"}\n']))
    await streamChat({ ...REQUEST, retryOfMessageId: 'm9' }, { onEvent: () => undefined })
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(JSON.parse(init.body as string)).toMatchObject({ retryOfMessageId: 'm9' })
  })

  it('keeps resetsAt on a LIMIT_REACHED error', async () => {
    fetchMock.mockResolvedValue(
      streamResponse([
        '{"type":"error","code":"LIMIT_REACHED","message":"Limit reached.","resetsAt":"2026-11-18T05:00:00.000Z"}\n',
      ]),
    )
    const events: ChatEvent[] = []
    await streamChat(REQUEST, { onEvent: (event) => events.push(event) })
    expect(events).toEqual([
      { type: 'error', code: 'LIMIT_REACHED', message: 'Limit reached.', resetsAt: '2026-11-18T05:00:00.000Z' },
    ])
  })

  it('throws the server error when the response is not OK', async () => {
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ error: { code: 'PENDING_APPROVAL', message: 'Waiting for approval.' } }), {
        status: 403,
      }),
    )
    const failure = await streamChat(REQUEST, { onEvent: () => undefined }).catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(ApiError)
    expect(failure).toMatchObject({ status: 403, code: 'PENDING_APPROVAL', message: 'Waiting for approval.' })
  })
})
