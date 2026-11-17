import { describe, expect, it } from 'vitest'
import type { Message } from '../api/types'
import { appendTurn, createTurnSlots, groupCompareHistory, nextTurnNumber } from './compare-state'

function stored(fields: Partial<Message> & Pick<Message, 'messageId' | 'role'>): Message {
  return { sessionId: 's1', content: fields.messageId, attachments: [], citations: [], createdAt: '2026-11-17T10:00:00Z', ...fields }
}

describe('compare turns', () => {
  it('shows the prompt once per turn with one answer per model', () => {
    const slots = createTurnSlots(['a', 'b', 'c'], 0)
    const turns = appendTurn([], 'hello', [], slots, 0)
    expect(turns).toHaveLength(1)
    expect(turns[0].answers.map((answer) => answer.modelId)).toEqual(['a', 'b', 'c'])
    expect(turns[0].answers.every((answer) => answer.turn === 0)).toBe(true)
    expect(nextTurnNumber(turns)).toBe(1)
  })

  it('dedupes stored user messages by turn number', () => {
    const messages = [
      stored({ messageId: 'u-a', role: 'user', modelId: 'a', turn: 0 }),
      stored({ messageId: 'u-b', role: 'user', modelId: 'b', turn: 0 }),
      stored({ messageId: 'r-a', role: 'assistant', modelId: 'a', turn: 0 }),
      stored({ messageId: 'r-b', role: 'assistant', modelId: 'b', turn: 0 }),
      stored({ messageId: 'u2-a', role: 'user', modelId: 'a', turn: 1 }),
      stored({ messageId: 'u2-b', role: 'user', modelId: 'b', turn: 1 }),
      stored({ messageId: 'r2-b', role: 'assistant', modelId: 'b', turn: 1 }),
    ]
    const turns = groupCompareHistory(messages, ['a', 'b'])
    expect(turns.map((entry) => entry.turn)).toEqual([0, 1])
    expect(turns[0].answers.map((answer) => answer.id)).toEqual(['r-a', 'r-b'])
    expect(turns[1].answers.map((answer) => answer.id)).toEqual(['r2-b'])
  })

  it('pairs messages without turn numbers by order per model', () => {
    const messages = [
      stored({ messageId: 'u1', role: 'user', modelId: 'a' }),
      stored({ messageId: 'r1', role: 'assistant', modelId: 'a' }),
      stored({ messageId: 'u2', role: 'user', modelId: 'a' }),
      stored({ messageId: 'r2', role: 'assistant', modelId: 'a' }),
    ]
    const turns = groupCompareHistory(messages, ['a'])
    expect(turns.map((entry) => [entry.prompt.id, entry.answers[0].id])).toEqual([['u1', 'r1'], ['u2', 'r2']])
  })
})
