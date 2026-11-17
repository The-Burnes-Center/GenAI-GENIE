import { useId, useState } from 'react'
import { Brain, CaretRight } from '@phosphor-icons/react'
import { Spinner, cx } from '../ui'
import { formatSeconds, useElapsedSeconds } from '../../chat/use-elapsed'
import type { UiMessage } from '../../chat/messages'

interface ThinkingSectionProps {
  message: UiMessage
  // Models that can think say "Thinking"; the others say "Working".
  canThink: boolean
}

// Before the first word: a spinner and elapsed time. With a reasoning summary: a disclosure that streams it,
// then collapses to "Thought for 18s" unless the person opened or closed it themselves.
export function ThinkingSection({ message, canThink }: ThinkingSectionProps) {
  const [choice, setChoice] = useState<boolean | null>(null)
  const bodyId = useId()
  const isWaiting = message.status === 'streaming' && message.content === ''
  const elapsed = useElapsedSeconds(message.startedAt, isWaiting)
  const hasReasoning = message.reasoning !== ''

  if (!hasReasoning) {
    if (!isWaiting) return null
    return (
      <p className="mb-3 inline-flex items-center gap-2 text-small text-ink-2">
        <Spinner />
        <span>
          {canThink ? 'Thinking' : 'Working'} <span className="tabular-nums">{elapsed}s</span>
        </span>
      </p>
    )
  }

  const isOpen = choice ?? isWaiting
  const label = isWaiting
    ? `Thinking ${elapsed}s`
    : message.thinkingMs
      ? `Thought for ${formatSeconds(message.thinkingMs)}`
      : 'Thinking summary'

  return (
    <div className="mb-3">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={bodyId}
        onClick={() => setChoice(!isOpen)}
        className="-ml-1 inline-flex min-h-7 items-center gap-2 rounded-md pl-1 pr-2 text-small font-medium text-ink-2 hover:bg-hover hover:text-ink pointer-coarse:min-h-11"
      >
        <CaretRight size={14} aria-hidden="true" className={cx('transition-transform duration-[var(--duration-fast)]', isOpen && 'rotate-90')} />
        {isWaiting ? <Spinner /> : <Brain size={16} aria-hidden="true" />}
        <span className="tabular-nums">{label}</span>
      </button>
      <div
        id={bodyId}
        hidden={!isOpen}
        tabIndex={0}
        role="group"
        aria-label="Thinking summary"
        className="mt-1.5 ml-1.5 max-h-[280px] overflow-y-auto border-l-2 border-edge py-0.5 pl-3.5 text-ui leading-6 text-ink-2"
      >
        {message.reasoning}
      </div>
    </div>
  )
}
