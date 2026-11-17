import type { AttachmentRef, ChatMode, Citation, Usage } from '../api/types'

export type { AttachmentRef, Citation, Usage }

export type ThinkingMode = 'standard' | 'deep'

// Users have no temperature or length control. Thinking only applies to models with capabilities.reasoning.
export interface ChatSettings {
  thinking?: ThinkingMode
}

// Request body for POST /api/chat (ARCHITECTURE.md, chat streaming contract). Optional means the server has a default.
export interface ChatRequestBody {
  sessionId?: string
  modelId: string
  prompt: string
  attachments?: AttachmentRef[]
  workspaceId?: string
  templateId?: string
  mode?: ChatMode
  compareModelIds?: string[]
  // 0-based turn number. Compare sessions dedupe user turns by it.
  turn?: number
  settings?: ChatSettings
  // Retry: the server deletes that reply and the prompt it answered (a failed reply, or the latest one to
  // regenerate), then answers the same prompt again.
  retryOfMessageId?: string
}

// Codes of the `error` line in the stream. Failures before the stream starts (sign-in, approval) arrive as an
// HTTP error body instead, see ApiError.
export type ChatErrorCode =
  | 'MODEL_DISABLED'
  | 'LIMIT_REACHED'
  | 'BAD_REQUEST'
  | 'CONTEXT_TOO_LONG'
  | 'BEDROCK_THROTTLED'
  | 'BEDROCK_ERROR'
  | 'REFUSED'
  | 'INTERNAL'

export const NOTICE_CODES = [
  'HISTORY_TRIMMED',
  'ATTACHMENT_AS_TEXT',
  'ATTACHMENTS_LIMITED',
  'ATTACHMENT_EXPIRED',
  'ATTACHMENT_TRUNCATED',
  'SAVE_FAILED',
] as const

export type NoticeCode = (typeof NOTICE_CODES)[number]

export type ChatEvent =
  | { type: 'session'; sessionId: string; messageId: string; title: string }
  | { type: 'ping' }
  | { type: 'notice'; code: NoticeCode; message: string }
  | { type: 'citations'; items: Citation[] }
  | { type: 'reasoning'; text: string }
  | { type: 'delta'; text: string }
  | { type: 'done'; usage: Usage; latencyMs: number; stopReason: string }
  | { type: 'title'; sessionId: string; title: string }
  // resetsAt is set on LIMIT_REACHED: the ISO time the daily allowance resets.
  | { type: 'error'; code: ChatErrorCode; message: string; resetsAt?: string }

export type ChatEventType = ChatEvent['type']
