import { describe, expect, it } from 'vitest'
import { applyChatEvent, createAssistantMessage, markStreamEnded } from './messages'

describe('applyChatEvent', () => {
  it('appends reasoning and text separately and records notices', () => {
    let message = createAssistantMessage('m')
    message = applyChatEvent(message, { type: 'reasoning', text: 'Think. ' })
    message = applyChatEvent(message, { type: 'notice', code: 'HISTORY_TRIMMED', message: 'Trimmed.' })
    message = applyChatEvent(message, { type: 'delta', text: 'Answer' })
    expect(message).toMatchObject({ reasoning: 'Think. ', notices: [{ code: 'HISTORY_TRIMMED', message: 'Trimmed.' }], content: 'Answer', status: 'streaming' })
  })

  it('leaves the message alone for ping and title events', () => {
    const message = createAssistantMessage('m')
    expect(applyChatEvent(message, { type: 'ping' })).toBe(message)
    expect(applyChatEvent(message, { type: 'title', sessionId: 's', title: 'T' })).toBe(message)
  })

  it('keeps the error code and server text so the UI can choose copy', () => {
    const message = createAssistantMessage('m')
    expect(applyChatEvent(message, { type: 'error', code: 'LIMIT_REACHED', message: 'raw', resetsAt: '2026-11-18T05:00:00Z' })).toMatchObject({
      status: 'error',
      error: { code: 'LIMIT_REACHED', message: 'raw', resetsAt: '2026-11-18T05:00:00Z' },
    })
  })
})

describe('markStreamEnded', () => {
  it('marks a stream that ended without done as an error and keeps finished messages as they are', () => {
    const streaming = createAssistantMessage('m')
    expect(markStreamEnded(streaming, 'incomplete').status).toBe('error')
    const done = applyChatEvent(streaming, { type: 'done', usage: { inputTokens: 1, outputTokens: 1 }, latencyMs: 1, stopReason: 'end_turn' })
    expect(markStreamEnded(done, 'incomplete')).toBe(done)
  })
})
