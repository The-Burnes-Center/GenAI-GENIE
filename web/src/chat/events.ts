import type { Citation } from '../api/types'
import { NOTICE_CODES, type ChatErrorCode, type ChatEvent, type NoticeCode } from './types'

export class StreamProtocolError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'StreamProtocolError'
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function isString(value: unknown): value is string {
  return typeof value === 'string'
}

const ERROR_CODES: readonly ChatErrorCode[] = [
  'MODEL_DISABLED',
  'LIMIT_REACHED',
  'BAD_REQUEST',
  'CONTEXT_TOO_LONG',
  'BEDROCK_THROTTLED',
  'BEDROCK_ERROR',
  'REFUSED',
  'INTERNAL',
]

function isNoticeCode(value: unknown): value is NoticeCode {
  return NOTICE_CODES.some((code) => code === value)
}

// A code this client does not know (a newer server) reads as a generic failure.
function toErrorCode(value: unknown): ChatErrorCode {
  return ERROR_CODES.find((code) => code === value) ?? 'INTERNAL'
}

function toUsage(value: unknown): { inputTokens: number; outputTokens: number; cacheReadTokens?: number } {
  const usage = isRecord(value) ? value : {}
  const result = { inputTokens: Number(usage.inputTokens) || 0, outputTokens: Number(usage.outputTokens) || 0 }
  return usage.cacheReadTokens === undefined
    ? result
    : { ...result, cacheReadTokens: Number(usage.cacheReadTokens) || 0 }
}

// Checks only the fields the UI reads. Unknown event types are skipped so older clients keep working.
function toChatEvent(value: Record<string, unknown>): ChatEvent | null {
  switch (value.type) {
    case 'session':
      if (!isString(value.sessionId) || !isString(value.messageId)) return null
      return {
        type: 'session',
        sessionId: value.sessionId,
        messageId: value.messageId,
        title: isString(value.title) ? value.title : '',
      }
    case 'ping':
      return { type: 'ping' }
    case 'notice':
      return isNoticeCode(value.code) && isString(value.message)
        ? { type: 'notice', code: value.code, message: value.message }
        : null
    case 'citations':
      return Array.isArray(value.items) ? { type: 'citations', items: value.items as Citation[] } : null
    case 'reasoning':
      return isString(value.text) ? { type: 'reasoning', text: value.text } : null
    case 'delta':
      return isString(value.text) ? { type: 'delta', text: value.text } : null
    case 'done':
      return {
        type: 'done',
        usage: toUsage(value.usage),
        latencyMs: Number(value.latencyMs) || 0,
        stopReason: isString(value.stopReason) ? value.stopReason : 'unknown',
      }
    case 'title':
      return isString(value.sessionId) && isString(value.title)
        ? { type: 'title', sessionId: value.sessionId, title: value.title }
        : null
    case 'error':
      return {
        type: 'error',
        code: toErrorCode(value.code),
        message: isString(value.message) ? value.message : 'The request failed.',
        ...(isString(value.resetsAt) ? { resetsAt: value.resetsAt } : {}),
      }
    default:
      return null
  }
}

export function parseChatEventLine(line: string): ChatEvent | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(line)
  } catch {
    throw new StreamProtocolError('The response contained a line that is not JSON.')
  }
  if (!isRecord(parsed)) throw new StreamProtocolError('The response contained a line that is not an object.')
  return toChatEvent(parsed)
}
