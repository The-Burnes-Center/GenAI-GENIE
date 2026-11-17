import { describe, expect, it } from 'vitest'
import type { ModelConfig } from '../api/types'
import { describeChatError, formatResetTime, suggestLargerModel } from './error-copy'

const ctx = { modelLabel: 'Claude Opus 5.5', now: new Date(2026, 10, 17, 14, 0) }
const CODES = ['MODEL_DISABLED', 'LIMIT_REACHED', 'BAD_REQUEST', 'CONTEXT_TOO_LONG', 'BEDROCK_THROTTLED', 'BEDROCK_ERROR', 'REFUSED', 'PENDING_APPROVAL', 'INTERNAL', 'NETWORK', 'INCOMPLETE']

describe('describeChatError', () => {
  it('gives every code a title, a body and at least one next step, with no codes in the words', () => {
    for (const code of CODES) {
      const view = describeChatError({ code, message: 'Spreadsheets need a document model.' }, ctx)
      expect(view.title.length).toBeGreaterThan(5)
      expect(view.actions.length).toBeGreaterThan(0)
      expect(`${view.title} ${view.body}`).not.toMatch(/[A-Z]{3,}_[A-Z_]+|—/)
    }
  })

  it('offers retry and another model when the model is busy', () => {
    const view = describeChatError({ code: 'BEDROCK_THROTTLED', message: '' }, ctx)
    expect(view.title).toBe('Claude Opus 5.5 is busy right now.')
    expect(view.actions).toEqual(['retry', 'model'])
  })

  it('shows the reset time and the limit for LIMIT_REACHED, without a retry', () => {
    const reset = new Date(2026, 10, 18, 0, 0).toISOString()
    const view = describeChatError({ code: 'LIMIT_REACHED', message: '', resetsAt: reset }, { ...ctx, dailyLimit: 50 })
    expect(view.title).toBe("You've reached today's limit of 50 messages.")
    expect(view.body).toContain(`tomorrow at ${new Date(reset).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`)
    expect(view.actions).not.toContain('retry')
  })

  it('suggests a model that reads more for CONTEXT_TOO_LONG', () => {
    const models = [
      { modelId: 'a', label: 'Small', contextWindow: 100 },
      { modelId: 'b', label: 'Big', contextWindow: 1000 },
    ] as ModelConfig[]
    const larger = suggestLargerModel(models, 'a')
    expect(larger?.label).toBe('Big')
    const view = describeChatError({ code: 'CONTEXT_TOO_LONG', message: '' }, { ...ctx, largerModelLabel: larger?.label })
    expect(view.body).toContain('Big can read more.')
    expect(view.actions).toEqual(['model'])
  })

  it('passes the server text through for BAD_REQUEST', () => {
    expect(describeChatError({ code: 'BAD_REQUEST', message: 'Attach it again.' }, ctx).body).toBe('Attach it again.')
  })
})

describe('formatResetTime', () => {
  it('falls back to words when the time is missing', () => {
    expect(formatResetTime(undefined)).toBe('tomorrow morning')
  })
})
