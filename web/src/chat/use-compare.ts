import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { bootstrapKey, sessionKeys } from '../api/query-keys'
import type { AttachmentRef } from '../api/types'
import {
  appendTurn,
  createSessionGate,
  createTurnSlots,
  nextTurnNumber,
  replaceAnswer,
  updateAnswer,
  type CompareTurn,
  type SessionGate,
  type TurnSlot,
} from './compare-state'
import { applyChatEvent, createAssistantMessage, markStreamEnded, markStreamFailed, type UiMessage } from './messages'
import { streamChat } from './stream-chat'
import type { ChatEvent, ChatRequestBody, ChatSettings } from './types'

export interface CompareInput {
  prompt: string
  modelIds: string[]
  attachments?: AttachmentRef[]
  workspaceId?: string
  templateId?: string
  settings?: ChatSettings
}

export interface CompareOptions {
  sessionId?: string
  initialTurns?: CompareTurn[]
  onEvent?: (event: ChatEvent) => void
  onSettled?: (sessionId: string | undefined) => void
}

interface ColumnRun {
  index: number
  slot: TurnSlot
  baseSessionId?: string
  gate: SessionGate
  body: Omit<ChatRequestBody, 'sessionId' | 'modelId'>
  signal: AbortSignal
  onEvent: (event: ChatEvent) => void
  update: (update: (message: UiMessage) => UiMessage) => void
}

// Index 0 sends without a session id and creates the session. Other columns wait for its id.
async function runColumn(run: ColumnRun): Promise<void> {
  try {
    const sessionId = run.index === 0 ? run.baseSessionId : await run.gate.promise
    await streamChat({ ...run.body, sessionId, modelId: run.slot.modelId }, { signal: run.signal, onEvent: run.onEvent })
    run.update((message) => markStreamEnded(message, 'incomplete'))
  } catch (error) {
    run.update((message) => (run.signal.aborted ? markStreamEnded(message, 'stopped') : markStreamFailed(message, error)))
  } finally {
    if (run.index === 0) run.gate.reject(new Error('The comparison session could not be created.'))
  }
}

// Runs one stream per selected model against the same session, concurrently. Each request carries the turn number.
export function useCompare({ sessionId: initialSessionId, initialTurns = [], onEvent, onSettled }: CompareOptions) {
  const queryClient = useQueryClient()
  const [sessionId, setSessionId] = useState(initialSessionId)
  const [turns, setTurns] = useState<CompareTurn[]>(initialTurns)
  const [isStreaming, setIsStreaming] = useState(false)
  const controllerRef = useRef<AbortController | null>(null)
  const turnsRef = useRef(turns)
  const callbacks = useRef({ onEvent, onSettled })

  useEffect(() => {
    turnsRef.current = turns
    callbacks.current = { onEvent, onSettled }
  })
  useEffect(() => () => controllerRef.current?.abort(), [])

  // Streams the given slots for one turn. A retry passes the stored answer to replace.
  const runSlots = useCallback(
    async (slots: TurnSlot[], turn: number, base: Omit<ChatRequestBody, 'sessionId' | 'modelId' | 'turn'>, retryOf?: string) => {
      const controller = new AbortController()
      controllerRef.current = controller
      const gate = createSessionGate(sessionId)
      let latestSessionId = sessionId
      setIsStreaming(true)
      const runs = slots.map((slot, index) =>
        runColumn({
          index,
          slot,
          baseSessionId: sessionId,
          gate,
          body: { ...base, turn, retryOfMessageId: retryOf },
          signal: controller.signal,
          onEvent: (event) => {
            if (event.type === 'session') {
              latestSessionId = event.sessionId
              gate.resolve(event.sessionId)
              setSessionId(event.sessionId)
            }
            setTurns((prev) => updateAnswer(prev, slot.assistant.id, (message) => applyChatEvent(message, event)))
            callbacks.current.onEvent?.(event)
          },
          update: (update) => setTurns((prev) => updateAnswer(prev, slot.assistant.id, update)),
        }),
      )
      try {
        await Promise.all(runs)
      } finally {
        controllerRef.current = null
        setIsStreaming(false)
        void queryClient.invalidateQueries({ queryKey: sessionKeys.all })
        void queryClient.invalidateQueries({ queryKey: bootstrapKey })
        callbacks.current.onSettled?.(latestSessionId)
      }
    },
    [sessionId, queryClient],
  )

  const send = useCallback(
    async (input: CompareInput) => {
      if (controllerRef.current || input.modelIds.length === 0) return
      const turn = nextTurnNumber(turnsRef.current)
      const slots = createTurnSlots(input.modelIds, turn)
      setTurns((prev) => appendTurn(prev, input.prompt, input.attachments ?? [], slots, turn))
      await runSlots(
        slots,
        turn,
        {
          prompt: input.prompt,
          attachments: input.attachments,
          workspaceId: input.workspaceId,
          templateId: input.templateId,
          settings: input.settings,
          mode: 'compare',
          compareModelIds: input.modelIds,
        },
      )
    },
    [runSlots],
  )

  // Sends one model's prompt again, in place of its failed answer.
  const retryColumn = useCallback(
    async (turn: number, modelId: string, modelIds: string[]) => {
      const entry = turnsRef.current.find((candidate) => candidate.turn === turn)
      const failed = entry?.answers.find((answer) => answer.modelId === modelId)
      if (!entry || !failed || controllerRef.current) return
      const assistant = createAssistantMessage(modelId, turn)
      setTurns((prev) => replaceAnswer(prev, turn, modelId, assistant))
      await runSlots(
        [{ modelId, assistant }],
        turn,
        {
          prompt: entry.prompt.content,
          attachments: entry.prompt.attachments,
          mode: 'compare',
          compareModelIds: modelIds,
        },
        failed.serverId,
      )
    },
    [runSlots],
  )

  const stop = useCallback(() => {
    controllerRef.current?.abort()
  }, [])

  const setFeedback = useCallback((id: string, rating: UiMessage['feedback']) => {
    setTurns((prev) => updateAnswer(prev, id, (message) => ({ ...message, feedback: rating })))
  }, [])

  return { sessionId, turns, isStreaming, send, retryColumn, stop, setFeedback }
}
