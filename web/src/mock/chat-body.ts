// Request parsing and canned content for the mock chat endpoint.
import type { AttachmentRef, ChatMode } from '../api/types'
import type { ChatErrorCode, NoticeCode } from '../chat/types'
import { MockHttpError } from './http'
import { CANNED, MD_FORMULA, MD_LEAVE, MD_SNOW } from './seed-text'

export interface ChatBody {
  sessionId?: string
  modelId: string
  prompt: string
  attachments: AttachmentRef[]
  workspaceId?: string
  templateId?: string
  mode: ChatMode
  compareModelIds: string[]
  thinking?: 'standard' | 'deep'
  retryOfMessageId?: string
}

export const MAX_TITLE_WORDS = 12

function optionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value !== '' ? value : undefined
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

// Mirrors the server's checks that the client can trip: required fields and a known mode.
export function parseChatBody(raw: unknown): ChatBody {
  const record = typeof raw === 'object' && raw !== null ? (raw as Record<string, unknown>) : null
  if (!record || typeof record.modelId !== 'string' || typeof record.prompt !== 'string') {
    throw new MockHttpError(400, 'BAD_REQUEST', 'The message needs a model and some text.')
  }
  if (record.mode !== undefined && record.mode !== 'chat' && record.mode !== 'compare') {
    throw new MockHttpError(400, 'BAD_REQUEST', 'The chat mode is not recognized.')
  }
  const settings = typeof record.settings === 'object' && record.settings !== null ? (record.settings as Record<string, unknown>) : {}
  return {
    sessionId: optionalString(record.sessionId),
    modelId: record.modelId,
    prompt: record.prompt,
    attachments: Array.isArray(record.attachments) ? (record.attachments as AttachmentRef[]) : [],
    workspaceId: optionalString(record.workspaceId),
    templateId: optionalString(record.templateId),
    mode: record.mode === 'compare' ? 'compare' : 'chat',
    compareModelIds: stringArray(record.compareModelIds),
    thinking: settings.thinking === 'deep' ? 'deep' : settings.thinking === 'standard' ? 'standard' : undefined,
    retryOfMessageId: optionalString(record.retryOfMessageId),
  }
}

// The server uses the first words of the prompt until the model writes a title.
export function fallbackTitle(prompt: string): string {
  const trimmed = prompt.trim().replace(/\s+/g, ' ')
  return trimmed.length > 60 ? `${trimmed.slice(0, 60)}...` : trimmed || 'New chat'
}

export function generatedTitle(prompt: string): string {
  const words = prompt.trim().split(/\s+/).slice(0, 6).join(' ').replace(/[.?!,:;]+$/, '')
  return words === '' ? 'New chat' : words.charAt(0).toUpperCase() + words.slice(1)
}

export function pickAnswer(prompt: string, workspaceId?: string): string {
  if (workspaceId) return MD_LEAVE
  const text = prompt.toLowerCase()
  if (text.includes('snow')) return MD_SNOW
  if (text.includes('formula') || text.includes('spreadsheet')) return MD_FORMULA
  return CANNED.general
}

// Rough token counts for the done event. Good enough for a mock.
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4)
}

// Daily usage resets at the next local midnight. The mock uses the browser's zone.
export function nextDailyReset(now: Date = new Date()): string {
  const reset = new Date(now)
  reset.setHours(24, 0, 0, 0)
  return reset.toISOString()
}

// Demo triggers for mock mode: a keyword in the prompt makes the reply carry that notice.
const NOTICE_TRIGGERS: { pattern: RegExp; code: NoticeCode; message: string }[] = [
  { pattern: /\btrim\b/i, code: 'HISTORY_TRIMMED', message: 'Earlier messages were shortened to fit this model\u2019s limit.' },
  { pattern: /\btruncate\b/i, code: 'ATTACHMENT_TRUNCATED', message: 'Budget-Report.pdf: only the first 120,000 of 340,000 characters were included because of the model\u2019s size limit.' },
  { pattern: /\bexpired\b/i, code: 'ATTACHMENT_EXPIRED', message: 'old-notes.docx is no longer available (uploads are kept for 30 days).' },
  { pattern: /\bunsaved\b/i, code: 'SAVE_FAILED', message: 'This answer could not be saved to your history. Copy it now if you need it.' },
]

export function noticesFor(prompt: string): { code: NoticeCode; message: string }[] {
  return NOTICE_TRIGGERS.filter((trigger) => trigger.pattern.test(prompt)).map(({ code, message }) => ({ code, message }))
}

// Demo triggers for errors: refused, context, throttled (any prompt with "error").
const ERROR_TRIGGERS: { pattern: RegExp; code: ChatErrorCode; message: string }[] = [
  { pattern: /\brefused\b/i, code: 'REFUSED', message: 'The model declined to answer this request.' },
  { pattern: /\bcontext\b/i, code: 'CONTEXT_TOO_LONG', message: 'That is too much to read at once.' },
  { pattern: /\bbroken\b/i, code: 'BEDROCK_ERROR', message: 'The model could not complete the request.' },
  { pattern: /\berror\b/i, code: 'BEDROCK_THROTTLED', message: 'The model is busy right now. Try again in a moment.' },
]

export function errorTriggerFor(prompt: string): { code: ChatErrorCode; message: string } | null {
  const hit = ERROR_TRIGGERS.find((trigger) => trigger.pattern.test(prompt))
  return hit ? { code: hit.code, message: hit.message } : null
}
