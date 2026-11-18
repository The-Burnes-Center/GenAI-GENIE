import { useCallback, useDeferredValue, useState, type ReactNode } from 'react'
import type { ModelConfig, Rating } from '../../api/types'
import { suggestLargerModel } from '../../chat/error-copy'
import { sourceElementId } from '../../chat/source-ids'
import { formatLatency } from '../../chat/use-elapsed'
import type { UiMessage } from '../../chat/messages'
import { ErrorBlock } from './ErrorBlock'
import { Markdown } from './Markdown'
import { MessageActions } from './MessageActions'
import { Notices } from './Notices'
import { Sources } from './Sources'
import { ThinkingSection } from './ThinkingSection'

export interface AssistantTurnProps {
  message: UiMessage
  sessionId?: string
  models: ModelConfig[]
  dailyLimit?: number
  isLast: boolean
  onRetry?: () => void
  onChooseModel?: () => void
  onFeedback: (rating: Rating) => void
  // Shown at the end of the answer, for example the answer helpers on the last one.
  extras?: ReactNode
}

// One answer: who wrote it, thinking, notes, the text, sources, then actions. Errors replace nothing already shown.
export function AssistantTurn({ message, sessionId, models, dailyLimit, isLast, onRetry, onChooseModel, onFeedback, extras }: AssistantTurnProps) {
  const [sourcesOpen, setSourcesOpen] = useState(false)
  const model = models.find((candidate) => candidate.modelId === message.modelId)
  const modelLabel = model?.label ?? 'The model'
  const isStreaming = message.status === 'streaming'
  const shownText = useDeferredValue(message.content)
  const hasText = message.content !== '' && !message.contentUnavailable

  const showSource = useCallback((index: number) => {
    setSourcesOpen(true)
    requestAnimationFrame(() => document.getElementById(sourceElementId(message.id, index))?.focus())
  }, [message.id])

  return (
    <article
      aria-label={`Answer from ${modelLabel}`}
      aria-busy={isStreaming}
      className="group/turn mb-7 animate-view"
    >
      <p className="mb-1.5 flex items-baseline gap-2 text-small font-medium text-ink-2">
        <span>{modelLabel}</span>
        {message.latencyMs ? <span className="font-normal text-ink-3">{formatLatency(message.latencyMs)}</span> : null}
      </p>
      <ThinkingSection message={message} canThink={Boolean(model?.capabilities.reasoning)} />
      <Notices notices={message.notices} />
      {message.contentUnavailable && (
        <p className="max-w-[560px] rounded-md bg-sunken px-3 py-2 text-small text-ink-2">{message.content}</p>
      )}
      {hasText && (
        <Markdown
          text={isStreaming ? shownText : message.content}
          citations={message.citations}
          onCite={showSource}
          isStreaming={isStreaming}
        />
      )}
      {message.status === 'error' && message.error && (
        <div className={hasText ? 'mt-3' : undefined}>
          <ErrorBlock
            error={message.error}
            isFresh={message.startedAt > 0}
            onRetry={onRetry}
            onChooseModel={onChooseModel}
            context={{
              modelLabel,
              dailyLimit,
              largerModelLabel: suggestLargerModel(models, message.modelId)?.label,
            }}
          />
        </div>
      )}
      {message.status === 'stopped' && <p className="mt-2 text-small text-ink-3">Stopped.</p>}
      <Sources messageId={message.id} citations={message.citations} isOpen={sourcesOpen} onOpenChange={setSourcesOpen} />
      {(message.status === 'complete' || message.status === 'stopped') && hasText && (
        <MessageActions
          sessionId={sessionId}
          messageId={message.serverId}
          text={message.content}
          rating={message.feedback}
          onRated={onFeedback}
          onRetry={isLast ? onRetry : undefined}
          isAlwaysVisible={isLast}
        />
      )}
      {extras}
    </article>
  )
}
