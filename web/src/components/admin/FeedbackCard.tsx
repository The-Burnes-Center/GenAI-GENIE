import { ThumbsDown, ThumbsUp } from '@phosphor-icons/react'
import type { FeedbackRecord } from '../../api/types'
import { Badge, Button } from '../ui'
import { formatWhen } from './audit-format'

interface FeedbackCardProps {
  record: FeedbackRecord
  modelLabel: string
  isPending: boolean
  onToggleReviewed: () => void
}

export function FeedbackCard({ record, modelLabel, isPending, onToggleReviewed }: FeedbackCardProps) {
  const isDown = record.rating === 'down'
  return (
    <article className="grid gap-2 rounded-lg border border-edge bg-surface p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={isDown ? 'bad' : 'ok'} icon={isDown ? <ThumbsDown size={14} aria-hidden="true" /> : <ThumbsUp size={14} aria-hidden="true" />}>
          {isDown ? 'Not helpful' : 'Helpful'}
        </Badge>
        <Badge>{modelLabel}</Badge>
        {record.reviewed && <Badge tone="accent">Reviewed</Badge>}
        <span className="text-small text-ink-3">{record.userEmail}, {formatWhen(record.at)}</span>
      </div>
      <p className="text-body">{record.comment ? record.comment : <span className="text-ink-3">No comment left.</span>}</p>
      <details>
        <summary className="cursor-pointer text-accent underline underline-offset-4">Show the question and answer</summary>
        <div className="mt-2 grid gap-2 text-small">
          <div><b className="block">Question</b><q>{record.promptExcerpt}</q></div>
          <div><b className="block">Answer (start)</b><q>{record.responseExcerpt}</q></div>
        </div>
      </details>
      <div>
        <Button size="sm" isPending={isPending} pendingLabel="Saving" onPress={onToggleReviewed}>
          {record.reviewed ? 'Mark not reviewed' : 'Mark reviewed'}
        </Button>
      </div>
    </article>
  )
}
