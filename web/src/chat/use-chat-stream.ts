import { useCallback, useEffect, useRef, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { bootstrapKey, sessionKeys } from '../api/query-keys'
import type { AttachmentRef } from '../api/types'
import {
  applyChatEvent,
  createAssistantMessage,
  createUserMessage,
  markStreamEnded,
  markStreamFailed,
  promptBefore,
  updateMessageById,
  withoutTurn,
  type UiMessage,
} from './messages'
import { applyGeneratedTitle } from './session-cache'
import { streamChat } from './stream-chat'
import type { ChatEvent, ChatRequestBody, ChatSettings } from './types'

export interface SendInput {
  modelId: string
  prompt: string
  attachments?: AttachmentRef[]
  workspaceId?: string
  templateId?: string
  settings?: ChatSettings
  // Retry: the server deletes this stored answer and its prompt first.
  retryOfMessageId?: string
  // Retry: the answer on screen that this send replaces.
  replaceAssistantId?: string
}

export type RetryContext = Pick<SendInput, 'modelId' | 'workspaceId' | 'templateId' | 'settings'>

export interface ChatStreamOptions {
  sessionId?: string
  initialMessages?: UiMessage[]
  // Every stream event, for the title and the polite announcements.
  onEvent?: (event: ChatEvent) => void
  // Called after each stream ends, with the session id now in use (undefined if none was created).
  onSettled?: (sessionId: string | undefined) => void
}

function toRequestBody(input: SendInput, sessionId: string | undefined): ChatRequestBody {
  return {
    sessionId,
    modelId: input.modelId,
    prompt: input.prompt,
    attachments: input.attachments,
    workspaceId: input.workspaceId,
    templateId: input.templateId,
    settings: input.settings,
    retryOfMessageId: input.retryOfMessageId,
    mode: 'chat',
  }
}

// Owns the message list for one chat. Only one stream runs at a time.
export function useChatStream({ sessionId: initialSessionId, initialMessages = [], onEvent, onSettled }: ChatStreamOptions) {
  const queryClient = useQueryClient()
  const [sessionId, setSessionId] = useState(initialSessionId)
  const [messages, setMessages] = useState<UiMessage[]>(initialMessages)
  const [isStreaming, setIsStreaming] = useState(false)
  const controllerRef = useRef<AbortController | null>(null)
  const messagesRef = useRef(messages)
  const callbacks = useRef({ onEvent, onSettled })

  useEffect(() => {
    messagesRef.current = messages
    callbacks.current = { onEvent, onSettled }
  })
  useEffect(() => () => controllerRef.current?.abort(), [])

  const send = useCallback(
    async (input: SendInput) => {
      if (controllerRef.current) return
      const controller = new AbortController()
      controllerRef.current = controller
      const assistant = createAssistantMessage(input.modelId)
      const updateAssistant = (update: (message: UiMessage) => UiMessage) =>
        setMessages((prev) => updateMessageById(prev, assistant.id, update))
      let latestSessionId = sessionId

      setMessages((prev) => [
        ...(input.replaceAssistantId ? withoutTurn(prev, input.replaceAssistantId) : prev),
        createUserMessage(input.prompt, input.attachments),
        assistant,
      ])
      setIsStreaming(true)
      try {
        await streamChat(toRequestBody(input, sessionId), {
          signal: controller.signal,
          onEvent: (event) => {
            if (event.type === 'session') {
              latestSessionId = event.sessionId
              setSessionId(event.sessionId)
            }
            if (event.type === 'title') applyGeneratedTitle(queryClient, event.sessionId, event.title)
            updateAssistant((message) => applyChatEvent(message, event))
            callbacks.current.onEvent?.(event)
          },
        })
        updateAssistant((message) => markStreamEnded(message, 'incomplete'))
      } catch (error) {
        updateAssistant((message) =>
          controller.signal.aborted ? markStreamEnded(message, 'stopped') : markStreamFailed(message, error),
        )
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

  // Sends the same prompt again in place of a failed or unwanted answer.
  const retry = useCallback(
    (assistantId: string, context: RetryContext) => {
      const current = messagesRef.current
      const prompt = promptBefore(current, assistantId)
      const answer = current.find((message) => message.id === assistantId)
      if (!prompt || !answer) return Promise.resolve()
      return send({
        ...context,
        prompt: prompt.content,
        attachments: prompt.attachments,
        retryOfMessageId: answer.serverId,
        replaceAssistantId: assistantId,
      })
    },
    [send],
  )

  const stop = useCallback(() => {
    controllerRef.current?.abort()
  }, [])

  const setFeedback = useCallback((assistantId: string, rating: UiMessage['feedback']) => {
    setMessages((prev) => updateMessageById(prev, assistantId, (message) => ({ ...message, feedback: rating })))
  }, [])

  return { sessionId, messages, isStreaming, send, retry, stop, setFeedback }
}
