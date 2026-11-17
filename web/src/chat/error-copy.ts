import type { ModelConfig } from '../api/types'
import type { UiError } from './messages'

// What each error block can offer. The page decides which of these it can actually do.
export type ErrorAction = 'retry' | 'model' | 'history' | 'account'

export interface ErrorView {
  title: string
  body: string
  actions: ErrorAction[]
}

export interface ErrorContext {
  modelLabel: string
  // Today's limit from bootstrap, when known.
  dailyLimit?: number
  // A model with a larger reading capacity, offered when the message was too long.
  largerModelLabel?: string
  now?: Date
}

const TOMORROW_MS = 86_400_000

// "tomorrow at 12:00 AM", or "Friday, Nov 20 at 12:00 AM" further out. Local time of the browser.
export function formatResetTime(resetsAt: string | undefined, now: Date = new Date()): string {
  const reset = resetsAt ? new Date(resetsAt) : null
  if (!reset || Number.isNaN(reset.getTime())) return 'tomorrow morning'
  const time = reset.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  const startOfToday = new Date(now)
  startOfToday.setHours(0, 0, 0, 0)
  const days = Math.floor((reset.getTime() - startOfToday.getTime()) / TOMORROW_MS)
  if (days <= 0) return `today at ${time}`
  if (days === 1) return `tomorrow at ${time}`
  const day = reset.toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })
  return `${day} at ${time}`
}

// The model with the largest reading capacity other than the current one, or undefined.
export function suggestLargerModel(models: ModelConfig[], currentId: string | undefined): ModelConfig | undefined {
  const current = models.find((model) => model.modelId === currentId)
  const larger = models
    .filter((model) => model.modelId !== currentId && model.contextWindow > (current?.contextWindow ?? 0))
    .sort((a, b) => b.contextWindow - a.contextWindow)
  return larger[0]
}

// Plain words and a next step for every code the server sends. Staff never see the code itself.
export function describeChatError(error: UiError, context: ErrorContext): ErrorView {
  const { modelLabel } = context
  switch (error.code) {
    case 'BEDROCK_THROTTLED':
      return {
        title: `${modelLabel} is busy right now.`,
        body: 'A lot of people are using it. Wait a moment and try again, or choose another model. Your message was saved.',
        actions: ['retry', 'model'],
      }
    case 'CONTEXT_TOO_LONG':
      return {
        title: `That is too much for ${modelLabel} to read at once.`,
        body: `Attach the text as a file instead of pasting it, or choose a model that can read more.${
          context.largerModelLabel ? ` ${context.largerModelLabel} can read more.` : ''
        }`,
        actions: ['model'],
      }
    case 'REFUSED':
      return {
        title: `${modelLabel} declined to answer this one.`,
        body: 'Its safety filters stopped the reply. Try rephrasing your request, or choose another model.',
        actions: ['retry', 'model'],
      }
    case 'LIMIT_REACHED': {
      const limit = context.dailyLimit && context.dailyLimit > 0 ? ` of ${context.dailyLimit} messages` : ''
      return {
        title: `You've reached today's limit${limit}.`,
        body: `It starts over ${formatResetTime(error.resetsAt, context.now)}. Ask your administrator if you need more. Your chats stay readable.`,
        actions: ['history'],
      }
    }
    case 'MODEL_DISABLED':
      return {
        title: `${modelLabel} is no longer available.`,
        body: 'An administrator turned it off. Choose another model to keep going. Your message was saved.',
        actions: ['model'],
      }
    case 'PENDING_APPROVAL':
      return {
        title: 'Your account is waiting for approval.',
        body: 'An administrator reviews every new account. You can chat as soon as you are approved.',
        actions: ['account'],
      }
    case 'BAD_REQUEST':
      return {
        title: 'Genie could not send that message.',
        body: error.message,
        actions: ['model'],
      }
    case 'INCOMPLETE':
      return { title: 'The answer stopped early.', body: 'The connection ended before it finished. Try again.', actions: ['retry'] }
    case 'NETWORK':
      return { title: 'Genie could not reach the server.', body: `${error.message} Your message was kept.`, actions: ['retry'] }
    default:
      return {
        title: 'Something went wrong on our side.',
        body: 'Your message was saved. Try again in a moment.',
        actions: ['retry'],
      }
  }
}
