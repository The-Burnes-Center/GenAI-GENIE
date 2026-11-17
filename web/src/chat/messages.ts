import { ApiError, describeError } from '../api/errors'
import type { AttachmentRef, Citation, Message, Rating } from '../api/types'
import type { ChatEvent } from './types'

export type MessageStatus = 'complete' | 'streaming' | 'stopped' | 'error'

export interface UiNotice {
  code: string
  message: string
}

// Stays structured so the UI can pick copy and buttons by code. resetsAt is set on LIMIT_REACHED.
export interface UiError {
  code: string
  message: string
  resetsAt?: string
}

export interface UiMessage {
  id: string
  serverId?: string
  role: 'user' | 'assistant'
  content: string
  reasoning: string
  notices: UiNotice[]
  status: MessageStatus
  citations: Citation[]
  modelId?: string
  attachments: AttachmentRef[]
  error?: UiError
  // When the assistant started, for the "Thinking 12s" counter.
  startedAt: number
  // How long the model thought before its first word. Set on the first delta, or loaded from history.
  thinkingMs?: number
  // Total time the answer took, from the done event or history.
  latencyMs?: number
  // Compare turn number (0-based). Chat messages leave it unset.
  turn?: number
  feedback?: Rating
  // The stored long message could not be loaded; content holds a short note.
  contentUnavailable?: boolean
}

const INCOMPLETE_ERROR: UiError = {
  code: 'INCOMPLETE',
  message: 'The response ended before it finished. Try again.',
}

export function newLocalId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `local-${Math.random().toString(36).slice(2)}`
}

export function createUserMessage(prompt: string, attachments: AttachmentRef[] = [], turn?: number): UiMessage {
  return {
    id: newLocalId(),
    role: 'user',
    content: prompt,
    reasoning: '',
    notices: [],
    status: 'complete',
    citations: [],
    attachments,
    startedAt: 0,
    turn,
  }
}

export function createAssistantMessage(modelId: string, turn?: number): UiMessage {
  return {
    id: newLocalId(),
    role: 'assistant',
    content: '',
    reasoning: '',
    notices: [],
    status: 'streaming',
    citations: [],
    modelId,
    attachments: [],
    startedAt: Date.now(),
    turn,
  }
}

// Failed turns keep their stored error so a reload shows the failure with Retry.
export function fromStoredMessage(message: Message): UiMessage {
  const id = message.messageId
  return {
    id,
    serverId: id,
    role: message.role,
    content: message.content,
    reasoning: message.reasoning ?? '',
    notices: message.notices ?? [],
    status: message.error ? 'error' : 'complete',
    citations: message.citations ?? [],
    modelId: message.modelId,
    attachments: message.attachments ?? [],
    error: message.error,
    startedAt: 0,
    thinkingMs: message.thinkingMs,
    latencyMs: message.latencyMs,
    turn: message.turn,
    feedback: message.feedback?.rating,
    contentUnavailable: message.contentUnavailable,
  }
}

// Folds one stream event into the assistant message it belongs to.
// Ping and title do not change the message; the hook and the UI handle them.
export function applyChatEvent(message: UiMessage, event: ChatEvent, now: number = Date.now()): UiMessage {
  switch (event.type) {
    case 'session':
      return { ...message, serverId: event.messageId }
    case 'notice':
      return { ...message, notices: [...message.notices, { code: event.code, message: event.message }] }
    case 'citations':
      return { ...message, citations: event.items }
    case 'reasoning':
      return { ...message, reasoning: message.reasoning + event.text }
    case 'delta':
      return {
        ...message,
        content: message.content + event.text,
        thinkingMs: message.thinkingMs ?? Math.max(0, now - message.startedAt),
      }
    case 'done':
      return { ...message, status: 'complete', latencyMs: event.latencyMs }
    case 'error':
      return { ...message, status: 'error', error: { code: event.code, message: event.message, resetsAt: event.resetsAt } }
    case 'ping':
    case 'title':
      return message
  }
}

// Called when the stream ends without a done or error event, or when the user pressed stop.
export function markStreamEnded(message: UiMessage, reason: 'stopped' | 'incomplete'): UiMessage {
  if (message.status !== 'streaming') return message
  if (reason === 'stopped') return { ...message, status: 'stopped' }
  return { ...message, status: 'error', error: INCOMPLETE_ERROR }
}

export function markStreamFailed(message: UiMessage, error: unknown): UiMessage {
  const code = error instanceof ApiError ? error.code : 'NETWORK'
  return { ...message, status: 'error', error: { code, message: describeError(error) } }
}

export function updateMessageById(
  messages: UiMessage[],
  id: string,
  update: (message: UiMessage) => UiMessage,
): UiMessage[] {
  return messages.map((message) => (message.id === id ? update(message) : message))
}

// The user prompt that an assistant message answers, for Retry.
export function promptBefore(messages: UiMessage[], assistantId: string): UiMessage | undefined {
  const index = messages.findIndex((message) => message.id === assistantId)
  if (index <= 0) return undefined
  const previous = messages[index - 1]
  return previous.role === 'user' ? previous : undefined
}

// Drops a failed or replaced answer and the prompt before it, so a retry puts a fresh pair in their place.
export function withoutTurn(messages: UiMessage[], assistantId: string): UiMessage[] {
  const prompt = promptBefore(messages, assistantId)
  return messages.filter((message) => message.id !== assistantId && message.id !== prompt?.id)
}
