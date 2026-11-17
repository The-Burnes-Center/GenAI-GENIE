import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Message } from '../api/types'
import { fromStoredMessage } from './messages'
import type { ChatEvent, ChatRequestBody } from './types'
import { useChatStream } from './use-chat-stream'

const sent: ChatRequestBody[] = []
let script: ChatEvent[] = []

vi.mock('./stream-chat', () => ({
  streamChat: async (body: ChatRequestBody, options: { onEvent: (event: ChatEvent) => void }) => {
    sent.push(body)
    for (const event of script) options.onEvent(event)
  },
}))

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
)

const failed: Message[] = [
  { messageId: 'u1', sessionId: 's1', role: 'user', content: 'Draft the email', attachments: [{ key: 'k', name: 'a.pdf', contentType: 'application/pdf', size: 5 }], citations: [], createdAt: 't' },
  { messageId: 'a1', sessionId: 's1', role: 'assistant', content: '', attachments: [], citations: [], modelId: 'm', createdAt: 't', error: { code: 'BEDROCK_THROTTLED', message: 'busy' } },
]

describe('retry', () => {
  beforeEach(() => {
    sent.length = 0
    script = [
      { type: 'session', sessionId: 's1', messageId: 'a2', title: 'T' },
      { type: 'delta', text: 'Here it is' },
      { type: 'done', usage: { inputTokens: 1, outputTokens: 1 }, latencyMs: 1, stopReason: 'end_turn' },
    ]
  })

  it('loads a failed turn from history with its stored error', () => {
    const message = fromStoredMessage(failed[1])
    expect(message.status).toBe('error')
    expect(message.error?.code).toBe('BEDROCK_THROTTLED')
  })

  it('re-sends the same prompt and files with retryOfMessageId, replacing the failed pair', async () => {
    const { result } = renderHook(() => useChatStream({ sessionId: 's1', initialMessages: failed.map(fromStoredMessage) }), { wrapper })
    await act(async () => {
      await result.current.retry('a1', { modelId: 'm' })
    })
    expect(sent).toHaveLength(1)
    expect(sent[0]).toMatchObject({ sessionId: 's1', prompt: 'Draft the email', retryOfMessageId: 'a1', mode: 'chat' })
    expect(sent[0].attachments?.[0].name).toBe('a.pdf')
    await waitFor(() => expect(result.current.messages).toHaveLength(2))
    expect(result.current.messages[0].content).toBe('Draft the email')
    expect(result.current.messages[1]).toMatchObject({ content: 'Here it is', status: 'complete' })
  })
})
