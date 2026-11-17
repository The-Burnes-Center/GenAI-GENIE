import { describeError } from '../../api/errors'
import { Spinner } from '../ui'

export function LoadingText({ label = 'Loading...' }: { label?: string }) {
  return (
    <p role="status" className="flex items-center gap-2 text-ink-2">
      <Spinner />
      {label}
    </p>
  )
}

export function ErrorText({ error }: { error: unknown }) {
  return (
    <p role="alert" className="text-danger">
      {describeError(error)}
    </p>
  )
}
