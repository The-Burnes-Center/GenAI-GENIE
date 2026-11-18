import { describe, expect, it } from 'vitest'
import { ApiError } from '../api/errors'
import { canOfferAssist, describeAssistFailure } from './assist-state'

describe('canOfferAssist', () => {
  it('needs enough words and characters, and not too many', () => {
    expect(canOfferAssist('summarize this')).toBe(false)
    expect(canOfferAssist('Summarize this memo for me')).toBe(true)
    expect(canOfferAssist('a'.repeat(30))).toBe(false)
    expect(canOfferAssist(`${'word '.repeat(2000)}`)).toBe(false)
    expect(canOfferAssist('   ')).toBe(false)
  })
})

describe('describeAssistFailure', () => {
  it('reports the daily cap with the server wording and no retry', () => {
    const failure = describeAssistFailure(new ApiError(429, 'LIMIT_REACHED', 'You can use this 50 times a day. It starts over tomorrow.'))
    expect(failure).toMatchObject({ kind: 'limit', canRetry: false })
    expect(failure.message).toContain('50 times a day')
  })

  it('treats throttling as busy and a bad reply as failed, both retryable', () => {
    expect(describeAssistFailure(new ApiError(503, 'UNAVAILABLE', 'x'))).toMatchObject({ kind: 'busy', canRetry: true })
    expect(describeAssistFailure(new ApiError(502, 'ASSIST_FAILED', 'The assistant could not rewrite this request.'))).toMatchObject({ kind: 'failed', canRetry: true })
    expect(describeAssistFailure(new Error('network')).kind).toBe('failed')
  })
})
