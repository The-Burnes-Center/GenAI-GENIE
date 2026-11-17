import { useState, type ReactNode } from 'react'
import { ArrowClockwise, Copy, ThumbsDown, ThumbsUp } from '@phosphor-icons/react'
import { useSubmitFeedback } from '../../api/sessions'
import { describeError } from '../../api/errors'
import type { Rating } from '../../api/types'
import { copyText } from '../../chat/copy-text'
import { IconButton, Tooltip, cx, toast } from '../ui'
import { FeedbackForm } from './FeedbackForm'

interface MessageActionsProps {
  sessionId?: string
  // The saved answer's id. Feedback needs it, so the thumbs wait until the answer is saved.
  messageId?: string
  text: string
  rating?: Rating
  onRated: (rating: Rating) => void
  // Only the last answer can be retried.
  onRetry?: () => void
  // Always visible on the last turn and on touch screens. Others appear on hover and focus.
  isAlwaysVisible: boolean
  // Label suffix for compare columns, for example "from Claude Sonnet 5.5".
  subject?: string
  // Extra control at the end of the row, for example "Continue in a chat" in a compare column.
  trailing?: ReactNode
}

// Copy, good answer, bad answer (opens a short form), and try again.
export function MessageActions({ sessionId, messageId, text, rating, onRated, onRetry, isAlwaysVisible, subject, trailing }: MessageActionsProps) {
  const [isFormOpen, setIsFormOpen] = useState(false)
  const submit = useSubmitFeedback(sessionId ?? '')
  const canRate = Boolean(sessionId && messageId)
  const suffix = subject ? ` ${subject}` : ''

  function send(next: Rating, comment?: string) {
    if (!messageId) return
    submit.mutate(
      { messageId, input: { rating: next, ...(comment ? { comment } : {}) } },
      {
        onSuccess: () => {
          onRated(next)
          setIsFormOpen(false)
          toast.show('Thanks for the feedback.')
        },
        onError: (error) => toast.error(describeError(error)),
      },
    )
  }

  return (
    <div>
      <div
        role="group"
        aria-label={`Answer actions${suffix}`}
        className={cx(
          '-ml-2 mt-2 flex gap-0.5 transition-opacity duration-[var(--duration-fast)] focus-within:opacity-100 [@media(hover:none)]:opacity-100',
          isAlwaysVisible ? 'opacity-100' : 'opacity-0 group-hover/turn:opacity-100',
        )}
      >
        <Tooltip text="Copy">
          <IconButton label={`Copy answer${suffix}`} size="sm" onPress={() => void copyText(text)}>
            <Copy size={18} aria-hidden="true" />
          </IconButton>
        </Tooltip>
        <Tooltip text="Good answer">
          <IconButton
            label={`Good answer${suffix}`}
            size="sm"
            aria-pressed={rating === 'up'}
            isDisabled={!canRate}
            onPress={() => send('up')}
            className="aria-pressed:bg-accent-soft aria-pressed:text-accent-soft-ink"
          >
            <ThumbsUp size={18} weight={rating === 'up' ? 'fill' : 'regular'} aria-hidden="true" />
          </IconButton>
        </Tooltip>
        <Tooltip text="Bad answer">
          <IconButton
            label={`Bad answer${suffix}`}
            size="sm"
            aria-pressed={rating === 'down'}
            aria-expanded={isFormOpen}
            isDisabled={!canRate}
            onPress={() => setIsFormOpen((open) => !open)}
            className="aria-pressed:bg-accent-soft aria-pressed:text-accent-soft-ink"
          >
            <ThumbsDown size={18} weight={rating === 'down' ? 'fill' : 'regular'} aria-hidden="true" />
          </IconButton>
        </Tooltip>
        {onRetry && (
          <Tooltip text="Try again">
            <IconButton label="Try again" size="sm" onPress={onRetry}>
              <ArrowClockwise size={18} aria-hidden="true" />
            </IconButton>
          </Tooltip>
        )}
        {trailing && <span className="ml-auto flex items-center pl-2">{trailing}</span>}
      </div>
      {isFormOpen && (
        <FeedbackForm isPending={submit.isPending} onSubmit={(comment) => send('down', comment)} onCancel={() => setIsFormOpen(false)} />
      )}
    </div>
  )
}
