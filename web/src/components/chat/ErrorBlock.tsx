import { ArrowClockwise, WarningCircle } from '@phosphor-icons/react'
import { Link } from 'react-router'
import { Button, buttonClass } from '../ui'
import { describeChatError, type ErrorAction, type ErrorContext } from '../../chat/error-copy'
import type { UiError } from '../../chat/messages'

interface ErrorBlockProps {
  error: UiError
  context: ErrorContext
  // Actions the page can actually perform. Others in the copy are left out.
  onRetry?: () => void
  onChooseModel?: () => void
  // Fresh errors are announced. Failures loaded from history are not, so a reload stays quiet.
  isFresh: boolean
}

const OUTLINE = 'bg-transparent! text-inherit! border-current! data-[hovered]:bg-black/5!'

// Plain words and next-step buttons for every error code.
export function ErrorBlock({ error, context, onRetry, onChooseModel, isFresh }: ErrorBlockProps) {
  const view = describeChatError(error, context)
  const wanted = (action: ErrorAction) => view.actions.includes(action)
  return (
    <div
      role={isFresh ? 'alert' : undefined}
      className="grid gap-2.5 rounded-lg border border-danger bg-danger-soft p-3.5 text-danger-soft-ink"
    >
      <div className="flex items-start gap-2.5">
        <WarningCircle size={20} aria-hidden="true" className="mt-px shrink-0" />
        <div>
          <p className="font-medium">{view.title}</p>
          <p className="mt-0.5">{view.body}</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        {wanted('retry') && onRetry && (
          <Button size="sm" className={OUTLINE} onPress={onRetry}>
            <ArrowClockwise size={16} aria-hidden="true" />
            Try again
          </Button>
        )}
        {wanted('model') && onChooseModel && (
          <Button size="sm" className={OUTLINE} onPress={onChooseModel}>
            Choose another model
          </Button>
        )}
        {wanted('history') && (
          <Link to="/history" className={buttonClass('secondary', 'sm', false, OUTLINE)}>
            See your chats
          </Link>
        )}
        {wanted('account') && (
          <Link to="/pending" className={buttonClass('secondary', 'sm', false, OUTLINE)}>
            Check my account
          </Link>
        )}
      </div>
    </div>
  )
}
