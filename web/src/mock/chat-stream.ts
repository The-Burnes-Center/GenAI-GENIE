// Mock POST /api/chat: streams the ARCHITECTURE.md NDJSON events and saves the exchange in the store.
import type { Citation, Message, ModelConfig } from '../api/types'
import type { ChatErrorCode, ChatEvent, NoticeCode } from '../chat/types'
import { errorTriggerFor, estimateTokens, fallbackTitle, generatedTitle, nextDailyReset, noticesFor, pickAnswer, type ChatBody } from './chat-body'
import { CANNED } from './seed-text'
import { CITATIONS } from './seed-sessions'
import { getStore, nextId } from './store'
import type { MockSession } from './seed-sessions'
import { mockTiming, sleep } from './timing'

type Emit = (event: ChatEvent) => void

interface Failure {
  code: ChatErrorCode
  message: string
}

interface Refusal extends Failure {
  resetsAt?: string
}

interface DraftNotice {
  code: NoticeCode
  message: string
}

// Text the reader accumulates. Kept even when the stream stops early, so the saved message matches what was shown.
interface Draft {
  content: string
  reasoning: string
  thinkingMs: number
  notices: DraftNotice[]
  citations: Citation[]
}

const ATTACHMENT_NOTICE = 'Attached files were read as text because this model does not read documents directly.'
const TOKEN_GROUP_SIZE = 3

export function chatStreamResponse(body: ChatBody, signal?: AbortSignal): Response {
  const encoder = new TextEncoder()
  let closed = false
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const emit: Emit = (event) => {
        if (!closed) controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`))
      }
      streamExchange(body, emit, signal)
        .catch((error: unknown) => console.error('Mock chat failed', error))
        .finally(() => {
          closed = true
          try {
            controller.close()
          } catch {
            // The reader cancelled first: nothing left to close.
          }
        })
    },
    cancel() {
      closed = true
    },
  })
  return new Response(stream, { status: 200, headers: { 'Content-Type': 'application/x-ndjson' } })
}

function refusalFor(body: ChatBody, model: ModelConfig | undefined): Refusal | null {
  if (!model || !model.enabled) {
    return { code: 'MODEL_DISABLED', message: 'That model is no longer available. Choose another model.' }
  }
  const { dailyMessageLimit } = getStore().settings
  const overLimit = dailyMessageLimit > 0 && getStore().dailyUsed >= dailyMessageLimit
  if (overLimit || /\blimit\b/i.test(body.prompt)) {
    return { code: 'LIMIT_REACHED', message: 'You have reached your daily message limit. Try again tomorrow.', resetsAt: nextDailyReset() }
  }
  return null
}

function findOrCreateSession(body: ChatBody): MockSession | undefined {
  const store = getStore()
  if (body.sessionId) return store.sessions.find((session) => session.sessionId === body.sessionId)
  const now = new Date().toISOString()
  const session: MockSession = {
    sessionId: nextId('s'),
    title: fallbackTitle(body.prompt),
    mode: body.mode,
    modelId: body.modelId,
    modelIds: body.mode === 'compare' ? body.compareModelIds : undefined,
    workspaceId: body.workspaceId,
    templateId: body.templateId,
    createdAt: now,
    updatedAt: now,
    messageCount: 0,
    messages: [],
  }
  store.sessions.unshift(session)
  return session
}

// A retry deletes the failed pair first, then the same prompt is saved again. Returns the new assistant id.
function beginExchange(session: MockSession, body: ChatBody): string {
  if (body.retryOfMessageId) removeFailedPair(session, body.retryOfMessageId)
  const user: Message = {
    messageId: nextId('m'),
    sessionId: session.sessionId,
    role: 'user',
    content: body.prompt,
    attachments: body.attachments,
    citations: [],
    modelId: body.mode === 'compare' ? body.modelId : undefined,
    createdAt: new Date().toISOString(),
  }
  session.messages.push(user)
  touch(session)
  return nextId('m')
}

function removeFailedPair(session: MockSession, assistantId: string): void {
  const index = session.messages.findIndex((message) => message.messageId === assistantId)
  if (index < 0) return
  const start = index > 0 && session.messages[index - 1].role === 'user' ? index - 1 : index
  session.messages.splice(start, index - start + 1)
}

function touch(session: MockSession): void {
  session.updatedAt = new Date().toISOString()
  session.messageCount = session.messages.length
}

function errorFor(prompt: string): Failure | null {
  return errorTriggerFor(prompt)
}

// Groups words so the stream has a realistic number of chunks without a delay per character.
function chunkText(text: string): string[] {
  const pieces = text.match(/\S+\s*|\s+/g) ?? []
  const chunks: string[] = []
  for (let index = 0; index < pieces.length; index += TOKEN_GROUP_SIZE) {
    chunks.push(pieces.slice(index, index + TOKEN_GROUP_SIZE).join(''))
  }
  return chunks
}

async function streamReasoning(text: string, draft: Draft, emit: Emit, signal?: AbortSignal): Promise<void> {
  const started = Date.now()
  for (const chunk of chunkText(text)) {
    draft.reasoning += chunk
    emit({ type: 'reasoning', text: chunk })
    await sleep(mockTiming.thinkingDelayMs, signal)
  }
  draft.thinkingMs = Date.now() - started
}

async function streamAnswer(content: string, draft: Draft, emit: Emit, signal?: AbortSignal): Promise<void> {
  for (const chunk of chunkText(content)) {
    draft.content += chunk
    emit({ type: 'delta', text: chunk })
    await sleep(mockTiming.tokenDelayMs, signal)
  }
}

// Writes notices, citations, reasoning and text in the contract's order. Returns a stored error when the reply fails.
async function generateReply(body: ChatBody, model: ModelConfig, draft: Draft, emit: Emit, signal?: AbortSignal): Promise<Failure | null> {
  const failure = errorFor(body.prompt)
  if (failure) return failure
  if (body.attachments.length > 0 && !model.capabilities.documents) {
    const notice: DraftNotice = { code: 'ATTACHMENT_AS_TEXT', message: ATTACHMENT_NOTICE }
    draft.notices.push(notice)
    emit({ type: 'notice', ...notice })
  }
  for (const notice of noticesFor(body.prompt)) {
    draft.notices.push(notice)
    emit({ type: 'notice', ...notice })
  }
  if (body.workspaceId) {
    draft.citations = CITATIONS.map((citation) => ({ ...citation, workspaceId: body.workspaceId ?? citation.workspaceId }))
    emit({ type: 'citations', items: draft.citations })
  }
  if (model.capabilities.reasoning || body.thinking === 'deep') {
    const thinking = body.thinking === 'deep' ? CANNED.thinkDeep : CANNED.think
    await streamReasoning(thinking, draft, emit, signal)
  }
  await streamAnswer(pickAnswer(body.prompt, body.workspaceId), draft, emit, signal)
  return null
}

function saveAssistant(session: MockSession, assistantId: string, modelId: string, draft: Draft, fields: Partial<Message>): void {
  session.messages.push({
    messageId: assistantId,
    sessionId: session.sessionId,
    role: 'assistant',
    content: draft.content,
    attachments: [],
    modelId,
    citations: draft.citations,
    reasoning: draft.reasoning || undefined,
    thinkingMs: draft.thinkingMs || undefined,
    notices: draft.notices,
    createdAt: new Date().toISOString(),
    ...fields,
  })
  touch(session)
}

function isAbort(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

async function streamExchange(body: ChatBody, emit: Emit, signal?: AbortSignal): Promise<void> {
  const model = getStore().models.find((item) => item.modelId === body.modelId)
  const refusal = refusalFor(body, model)
  if (refusal) {
    emit({ type: 'error', ...refusal })
    return
  }
  const session = findOrCreateSession(body)
  if (!session || !model) {
    emit({ type: 'error', code: 'BAD_REQUEST', message: 'That chat could not be found.' })
    return
  }
  const isNewSession = !body.sessionId
  const assistantId = beginExchange(session, body)
  const draft: Draft = { content: '', reasoning: '', thinkingMs: 0, notices: [], citations: [] }
  const started = Date.now()
  emit({ type: 'session', sessionId: session.sessionId, messageId: assistantId, title: session.title })

  let failure: Failure | null
  try {
    await sleep(mockTiming.firstEventMs, signal)
    emit({ type: 'ping' })
    failure = await generateReply(body, model, draft, emit, signal)
  } catch (error) {
    if (!isAbort(error)) throw error
    saveAssistant(session, assistantId, model.modelId, draft, { stopReason: 'stopped', latencyMs: Date.now() - started })
    return
  }

  const latencyMs = Date.now() - started
  if (failure) {
    saveAssistant(session, assistantId, model.modelId, draft, { error: failure, stopReason: 'error', latencyMs })
    emit({ type: 'error', code: failure.code, message: failure.message })
    return
  }
  const usage = { inputTokens: estimateTokens(body.prompt), outputTokens: estimateTokens(draft.content), cacheReadTokens: 0 }
  saveAssistant(session, assistantId, model.modelId, draft, { usage, latencyMs, stopReason: 'end_turn' })
  getStore().dailyUsed += 1
  emit({ type: 'done', usage, latencyMs, stopReason: 'end_turn' })
  if (isNewSession) {
    session.title = generatedTitle(body.prompt)
    emit({ type: 'title', sessionId: session.sessionId, title: session.title })
  }
}
