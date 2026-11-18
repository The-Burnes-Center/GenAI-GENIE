import { ApiError } from '../api/errors'

// "Help me ask" appears once there is something to improve, and never for text the server would refuse.
export const ASSIST_MIN_CHARS = 12
export const ASSIST_MIN_WORDS = 3
export const ASSIST_MAX_CHARS = 8000

export function canOfferAssist(draft: string): boolean {
  const text = draft.trim()
  if (text.length < ASSIST_MIN_CHARS || text.length > ASSIST_MAX_CHARS) return false
  return text.split(/\s+/).length >= ASSIST_MIN_WORDS
}

// Why "Help me ask" cannot run yet, in plain words, or null when it can. The button is always there, so this
// is what it says when pressed too early.
export function assistBlockedReason(draft: string): string | null {
  const text = draft.trim()
  if (text === '') return 'Type a rough idea first, then press Help me ask.'
  if (text.length > ASSIST_MAX_CHARS) return 'That is too long to rewrite. Shorten it, or attach it as a file.'
  if (!canOfferAssist(draft)) return 'Add a few more words, then press Help me ask.'
  return null
}

export type AssistFailure = 'limit' | 'busy' | 'failed'

// Plain words for each way it can fail, and whether trying again can help.
export function describeAssistFailure(error: unknown): { kind: AssistFailure; message: string; canRetry: boolean } {
  const code = error instanceof ApiError ? error.code : ''
  const status = error instanceof ApiError ? error.status : 0
  if (code === 'LIMIT_REACHED' || status === 429) {
    const detail = error instanceof ApiError && code === 'LIMIT_REACHED' ? error.message : 'You can use this 50 times a day. It starts over tomorrow.'
    return { kind: 'limit', message: `${detail} You can still send your own message.`, canRetry: false }
  }
  if (code === 'UNAVAILABLE') {
    return { kind: 'busy', message: 'Genie is busy right now. Wait a moment and try again, or send your own.', canRetry: true }
  }
  const message = error instanceof ApiError && code === 'ASSIST_FAILED' ? error.message : 'Genie could not suggest a new version. Try again, or send your own.'
  return { kind: 'failed', message, canRetry: true }
}
