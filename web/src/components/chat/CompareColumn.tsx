import { CheckCircle, CircleNotch, Clock, Stop, WarningCircle } from '@phosphor-icons/react'
import type { ModelConfig, Rating } from '../../api/types'
import { suggestLargerModel } from '../../chat/error-copy'
import type { UiMessage } from '../../chat/messages'
import { formatLatency } from '../../chat/use-elapsed'
import { Badge, Button } from '../ui'
import { ErrorBlock } from './ErrorBlock'
import { Markdown } from './Markdown'
import { MessageActions } from './MessageActions'
import { Notices } from './Notices'
import { ThinkingSection } from './ThinkingSection'

interface CompareColumnProps {
  message: UiMessage
  model?: ModelConfig
  models: ModelConfig[]
  sessionId?: string
  dailyLimit?: number
  onRetry?: () => void
  onContinue: () => void
  isContinuing: boolean
  onFeedback: (rating: Rating) => void
}

// Status in words and an icon, never color alone. Latency shows once the answer is in.
function ColumnStatus({ message }: { message: UiMessage }) {
  const isWaiting = message.status === 'streaming' && message.content === '' && message.reasoning === ''
  if (message.status === 'error') return <Badge tone="bad" icon={<WarningCircle size={14} aria-hidden="true" />}>Failed</Badge>
  if (message.status === 'stopped') return <Badge icon={<Stop size={14} aria-hidden="true" />}>Stopped</Badge>
  if (message.status === 'complete') {
    return (
      <>
        <Badge tone="ok" icon={<CheckCircle size={14} aria-hidden="true" />}>Done</Badge>
        {message.latencyMs ? <span>{formatLatency(message.latencyMs)}</span> : null}
      </>
    )
  }
  if (isWaiting) return <Badge icon={<Clock size={14} aria-hidden="true" />}>Waiting</Badge>
  return <Badge tone="accent" icon={<CircleNotch size={14} aria-hidden="true" className="animate-spin-slow" />}>Writing</Badge>
}

// One model's answer to one prompt: header with status, the text, and actions with Continue in a chat.
export function CompareColumn({ message, model, models, sessionId, dailyLimit, onRetry, onContinue, isContinuing, onFeedback }: CompareColumnProps) {
  const label = model?.label ?? 'The model'
  const isStreaming = message.status === 'streaming'
  const isWaiting = isStreaming && message.content === '' && message.reasoning === ''
  const canContinue = (message.status === 'complete' || message.status === 'stopped') && message.content !== '' && Boolean(sessionId)
  return (
    <section aria-labelledby={`col-${message.id}`} aria-busy={isStreaming} className="group/turn min-w-0 rounded-lg border border-edge-strong bg-surface">
      <header className="grid gap-1 border-b border-edge px-3.5 py-3">
        <h2 id={`col-${message.id}`} className="text-ui font-semibold">
          {message.turn !== undefined && <span className="vh">{`Message ${message.turn + 1}, `}</span>}
          {label}
        </h2>
        <div className="flex flex-wrap items-center gap-2 text-small text-ink-2">
          <ColumnStatus message={message} />
        </div>
      </header>
      <div className="min-h-[120px] p-3.5">
        <ThinkingSection message={message} canThink={Boolean(model?.capabilities.reasoning)} />
        <Notices notices={message.notices} />
        {isWaiting && (
          <div aria-hidden="true" className="grid gap-2.5 pt-1">
            <div className="animate-skeleton h-3 w-[90%] rounded-xs bg-sunken" />
            <div className="animate-skeleton h-3 w-3/4 rounded-xs bg-sunken" />
            <div className="animate-skeleton h-3 w-3/5 rounded-xs bg-sunken" />
          </div>
        )}
        {message.content !== '' && <Markdown text={message.content} isStreaming={isStreaming} isCompact />}
        {message.status === 'error' && message.error && (
          <div className={message.content ? 'mt-3' : undefined}>
            <ErrorBlock
              error={message.error}
              isFresh={message.startedAt > 0}
              onRetry={onRetry}
              context={{ modelLabel: label, dailyLimit, largerModelLabel: suggestLargerModel(models, message.modelId)?.label }}
            />
          </div>
        )}
      </div>
      {(message.status === 'complete' || message.status === 'stopped') && message.content !== '' && (
        <footer className="border-t border-edge px-2 pb-2 pt-0">
          <MessageActions
            sessionId={sessionId}
            messageId={message.serverId}
            text={message.content}
            rating={message.feedback}
            onRated={onFeedback}
            isAlwaysVisible
            subject={`from ${label}`}
            trailing={
              <Button size="sm" variant="ghost" isDisabled={!canContinue} isPending={isContinuing} pendingLabel="Opening" onPress={onContinue}>
                Continue in a chat
              </Button>
            }
          />
        </footer>
      )}
    </section>
  )
}
