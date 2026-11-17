import type { AttachmentRef, Message } from '../api/types'
import { createAssistantMessage, createUserMessage, fromStoredMessage, updateMessageById, type UiMessage } from './messages'

// One prompt and the answer each model gave to it. The prompt is stored once per turn, so it shows once.
export interface CompareTurn {
  turn: number
  prompt: UiMessage
  answers: UiMessage[]
}

export interface TurnSlot {
  modelId: string
  assistant: UiMessage
}

// The first stream creates the session. Later streams wait on this gate for its id.
export interface SessionGate {
  promise: Promise<string>
  resolve: (sessionId: string) => void
  reject: (error: unknown) => void
}

export function createSessionGate(existingSessionId?: string): SessionGate {
  let resolve: (sessionId: string) => void = () => undefined
  let reject: (error: unknown) => void = () => undefined
  const promise = new Promise<string>((res, rej) => {
    resolve = res
    reject = rej
  })
  // Nobody awaits the gate for a single-model turn, so avoid an unhandled rejection.
  promise.catch(() => undefined)
  if (existingSessionId) resolve(existingSessionId)
  return { promise, resolve, reject }
}

export function nextTurnNumber(turns: CompareTurn[]): number {
  return turns.reduce((highest, entry) => Math.max(highest, entry.turn + 1), 0)
}

export function createTurnSlots(modelIds: string[], turn: number): TurnSlot[] {
  return modelIds.map((modelId) => ({ modelId, assistant: createAssistantMessage(modelId, turn) }))
}

// Adds one turn: the prompt once, and a waiting answer per model.
export function appendTurn(
  turns: CompareTurn[],
  prompt: string,
  attachments: AttachmentRef[],
  slots: TurnSlot[],
  turn: number,
): CompareTurn[] {
  return [...turns, { turn, prompt: createUserMessage(prompt, attachments, turn), answers: slots.map((slot) => slot.assistant) }]
}

export function updateAnswer(turns: CompareTurn[], id: string, update: (message: UiMessage) => UiMessage): CompareTurn[] {
  return turns.map((entry) => ({ ...entry, answers: updateMessageById(entry.answers, id, update) }))
}

// Replaces one failed answer with a fresh waiting one in the same turn.
export function replaceAnswer(turns: CompareTurn[], turn: number, modelId: string, assistant: UiMessage): CompareTurn[] {
  return turns.map((entry) =>
    entry.turn === turn
      ? { ...entry, answers: entry.answers.map((answer) => (answer.modelId === modelId ? assistant : answer)) }
      : entry,
  )
}

interface TurnDraft {
  prompt?: UiMessage
  answers: Map<string, UiMessage>
}

// Rebuilds turns from a saved compare session. Stored user messages repeat once per model, so they are
// merged by turn number. A message without a turn number takes the next turn for its model.
export function groupCompareHistory(messages: Message[], modelIds: string[]): CompareTurn[] {
  const drafts = new Map<number, TurnDraft>()
  const userCount = new Map<string, number>()
  const lastTurn = new Map<string, number>()
  const draftFor = (turn: number): TurnDraft => {
    const existing = drafts.get(turn)
    if (existing) return existing
    const created: TurnDraft = { answers: new Map() }
    drafts.set(turn, created)
    return created
  }

  for (const stored of messages) {
    const owner = stored.modelId ?? ''
    const message = fromStoredMessage(stored)
    if (stored.role === 'user') {
      const count = userCount.get(owner) ?? 0
      userCount.set(owner, count + 1)
      const turn = stored.turn ?? count
      lastTurn.set(owner, turn)
      const draft = draftFor(turn)
      draft.prompt ??= { ...message, turn }
    } else {
      const turn = stored.turn ?? lastTurn.get(owner) ?? lastTurn.get('') ?? 0
      draftFor(turn).answers.set(owner, { ...message, turn })
    }
  }

  return [...drafts.entries()]
    .sort(([a], [b]) => a - b)
    .flatMap(([turn, draft]) => {
      if (!draft.prompt) return []
      const answers = modelIds.flatMap((modelId) => draft.answers.get(modelId) ?? [])
      return [{ turn, prompt: draft.prompt, answers }]
    })
}
