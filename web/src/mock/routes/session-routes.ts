import type {
  DeleteAllSessionsResponse,
  FeedbackInput,
  FeedbackRecord,
  FeedbackResponse,
  ForkInput,
  ForkSessionResponse,
  Message,
  Page,
  Rating,
  RenameSessionInput,
  Session,
  SessionDetail,
  SessionResponse,
} from '../../api/types'
import { json, noContent, MockHttpError, paginate, readJson, requireText } from '../http'
import { getStore, nextId } from '../store'
import type { MockRoute } from '../route-types'
import { findSession, sessionSummary, sortedSessions } from './shared'

const EXCERPT_CHARS = 200
// Like the real API, one call deletes a batch and reports how many are left.
const DELETE_BATCH = 20

function isRating(value: unknown): value is Rating {
  return value === 'up' || value === 'down'
}

function excerpt(text: string): string {
  return text.length > EXCERPT_CHARS ? `${text.slice(0, EXCERPT_CHARS)}...` : text
}

function listSessions(url: URL): Response {
  const query = (url.searchParams.get('q') ?? '').trim().toLowerCase()
  const matches = sortedSessions().filter((session) => query === '' || session.title.toLowerCase().includes(query))
  return json<Page<Session>>(paginate(matches.map(sessionSummary), url.searchParams.get('cursor')))
}

async function submitFeedback(sessionId: string, messageId: string, request: Request, userEmail: string): Promise<Response> {
  const body = await readJson<Partial<Record<keyof FeedbackInput, unknown>>>(request)
  if (!isRating(body.rating)) throw new MockHttpError(400, 'BAD_REQUEST', 'Choose helpful or not helpful.')
  const session = findSession(sessionId)
  const index = session.messages.findIndex((message) => message.messageId === messageId)
  if (index < 0) throw new MockHttpError(404, 'NOT_FOUND', 'That message could not be found.')
  const message = session.messages[index]
  const comment = typeof body.comment === 'string' && body.comment.trim() !== '' ? body.comment.trim() : undefined
  const at = new Date().toISOString()
  const feedback: FeedbackResponse['feedback'] = { rating: body.rating, ...(comment ? { comment } : {}), at }
  const updated: Message = { ...message, feedback }
  session.messages[index] = updated
  const prompt = session.messages.slice(0, index).reverse().find((item) => item.role === 'user')
  const record: FeedbackRecord = {
    id: `${at}#${messageId}`,
    at,
    sessionId,
    messageId,
    rating: body.rating,
    comment: comment ?? '',
    modelId: message.modelId ?? getStore().settings.defaultModelId,
    reviewed: false,
    userEmail,
    promptExcerpt: excerpt(prompt?.content ?? ''),
    responseExcerpt: excerpt(message.content),
  }
  // One index row per message: a new rating replaces the previous one.
  const store = getStore()
  store.feedback = [record, ...store.feedback.filter((item) => item.messageId !== messageId)]
  return json<FeedbackResponse>({ feedback })
}

// Copies one model's turns (plus shared turns with no modelId) into a new chat session.
async function forkSession(sessionId: string, request: Request): Promise<Response> {
  const body = await readJson<Partial<Record<keyof ForkInput, unknown>>>(request)
  if (typeof body.modelId !== 'string') throw new MockHttpError(400, 'BAD_REQUEST', 'Choose a model to continue with.')
  const source = findSession(sessionId)
  const now = new Date().toISOString()
  const forkId = nextId('s')
  const messages = source.messages
    .filter((message) => message.modelId === undefined || message.modelId === body.modelId)
    .map((message) => ({ ...message, messageId: nextId('m'), sessionId: forkId }))
  const forked = {
    ...source,
    sessionId: forkId,
    mode: 'chat' as const,
    modelId: body.modelId,
    modelIds: undefined,
    createdAt: now,
    updatedAt: now,
    messageCount: messages.length,
    messages,
  }
  getStore().sessions.unshift(forked)
  return json<ForkSessionResponse>({ sessionId: forked.sessionId }, 201)
}

export const sessionRoutes: MockRoute[] = [
  { method: 'GET', path: '/api/sessions', access: 'approved', handle: ({ url }) => listSessions(url) },
  {
    method: 'DELETE',
    path: '/api/sessions',
    access: 'approved',
    handle: () => {
      const removed = getStore().sessions.splice(0, DELETE_BATCH).length
      return json<DeleteAllSessionsResponse>({ deleted: removed, remaining: getStore().sessions.length })
    },
  },
  {
    method: 'GET',
    path: '/api/sessions/:id',
    access: 'approved',
    handle: ({ params }) => {
      const session = findSession(params.id)
      return json<SessionDetail>({ session: sessionSummary(session), messages: session.messages })
    },
  },
  {
    method: 'PATCH',
    path: '/api/sessions/:id',
    access: 'approved',
    handle: async ({ params, request }) => {
      const body = await readJson<Partial<Record<keyof RenameSessionInput, unknown>>>(request)
      const session = findSession(params.id)
      session.title = requireText(body.title, 'title')
      return json<SessionResponse>({ session: sessionSummary(session) })
    },
  },
  {
    method: 'DELETE',
    path: '/api/sessions/:id',
    access: 'approved',
    handle: ({ params }) => {
      const session = findSession(params.id)
      getStore().sessions.splice(getStore().sessions.indexOf(session), 1)
      return noContent()
    },
  },
  {
    method: 'POST',
    path: '/api/sessions/:id/messages/:messageId/feedback',
    access: 'approved',
    handle: ({ params, request, identity }) => submitFeedback(params.id, params.messageId, request, identity.email),
  },
  { method: 'POST', path: '/api/sessions/:id/fork', access: 'approved', handle: ({ params, request }) => forkSession(params.id, request) },
]
