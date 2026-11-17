import { describeError } from '../../api/errors'
import { Button, InlineNotice, Skeleton } from '../ui'

// Plain error block with a retry button, used by every list and form page.
export function QueryError({ error, onRetry, what }: { error: unknown; onRetry: () => void; what: string }) {
  return (
    <InlineNotice tone="bad" actions={<Button size="sm" onPress={onRetry}>Try again</Button>}>
      {`We could not load ${what}. ${describeError(error)}`}
    </InlineNotice>
  )
}

// Table-shaped loading placeholder. The status role announces the label once.
export function TableSkeleton({ label, rows = 4 }: { label: string; rows?: number }) {
  return (
    <div role="status" className="grid gap-px overflow-hidden rounded-lg border border-edge bg-edge">
      <span className="vh">{label}</span>
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="grid gap-2 bg-surface px-4 py-4">
          <Skeleton className="w-1/3" />
          <Skeleton className="w-2/3" />
        </div>
      ))}
    </div>
  )
}
