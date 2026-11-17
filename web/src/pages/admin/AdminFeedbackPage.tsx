import { useMemo, useState } from 'react'
import { ThumbsDown } from '@phosphor-icons/react'
import { useAdminFeedback, useMarkFeedbackReviewed } from '../../api/admin-ops'
import { useAdminModels } from '../../api/admin-models'
import { describeError } from '../../api/errors'
import type { FeedbackFilters, Rating } from '../../api/types'
import { FeedbackCard } from '../../components/admin/FeedbackCard'
import { PageHead } from '../../components/admin/PageHead'
import { QueryError, TableSkeleton } from '../../components/admin/states'
import { EmptyState, LoadMore, Select, toast } from '../../components/ui'

const ALL = 'all'
const RATINGS = [
  { id: ALL, label: 'All ratings' },
  { id: 'down', label: 'Not helpful' },
  { id: 'up', label: 'Helpful' },
]
const REVIEWED = [
  { id: ALL, label: 'All' },
  { id: 'no', label: 'Not reviewed' },
  { id: 'yes', label: 'Reviewed' },
]

export function AdminFeedbackPage() {
  const [rating, setRating] = useState(ALL)
  const [modelId, setModelId] = useState(ALL)
  const [reviewed, setReviewed] = useState(ALL)
  const filters = useMemo<FeedbackFilters>(
    () => ({
      rating: rating === ALL ? undefined : (rating as Rating),
      modelId: modelId === ALL ? undefined : modelId,
      reviewed: reviewed === ALL ? undefined : reviewed === 'yes',
    }),
    [rating, modelId, reviewed],
  )
  const feedback = useAdminFeedback(filters)
  const models = useAdminModels()
  const mark = useMarkFeedbackReviewed()
  const labels = useMemo(() => new Map((models.data?.items ?? []).map((m) => [m.modelId, m.label])), [models.data])
  const modelOptions = [{ id: ALL, label: 'All models' }, ...(models.data?.items ?? []).map((m) => ({ id: m.modelId, label: m.label }))]

  const toggle = (id: string, next: boolean) =>
    mark.mutate({ id, reviewed: next }, {
      onSuccess: () => toast.show(next ? 'Marked as reviewed.' : 'Marked as not reviewed.'),
      onError: (error) => toast.error(describeError(error)),
    })

  return (
    <>
      <PageHead title="Feedback" lead="Ratings and comments people left on answers. Use it to spot problems with a model or a template." />
      <div className="mb-4 flex flex-wrap gap-3">
        <Select label="Rating" options={RATINGS} selectedKey={rating} onSelectionChange={(k) => setRating(String(k))} className="w-44" />
        <Select label="Model" options={modelOptions} selectedKey={modelId} onSelectionChange={(k) => setModelId(String(k))} className="w-56" />
        <Select label="Reviewed" options={REVIEWED} selectedKey={reviewed} onSelectionChange={(k) => setReviewed(String(k))} className="w-44" />
      </div>
      {feedback.isPending && <TableSkeleton label="Loading feedback" />}
      {feedback.isError && <QueryError what="feedback" error={feedback.error} onRetry={() => void feedback.refetch()} />}
      {feedback.isSuccess && feedback.items.length === 0 && (
        <EmptyState icon={<ThumbsDown />} title="No feedback to show">When someone rates an answer, it appears here. Try clearing the filters.</EmptyState>
      )}
      <div className="grid gap-3">
        {feedback.items.map((record) => (
          <FeedbackCard
            key={record.id}
            record={record}
            modelLabel={labels.get(record.modelId) ?? record.modelId}
            isPending={mark.isPending && mark.variables?.id === record.id}
            onToggleReviewed={() => toggle(record.id, !record.reviewed)}
          />
        ))}
      </div>
      <LoadMore hasNextPage={Boolean(feedback.hasNextPage)} isFetchingNextPage={feedback.isFetchingNextPage} fetchNextPage={() => void feedback.fetchNextPage()} />
    </>
  )
}
