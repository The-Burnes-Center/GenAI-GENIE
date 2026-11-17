import { useState } from 'react'
import { Button, TextField } from '../ui'

interface FeedbackFormProps {
  isPending: boolean
  onSubmit: (comment: string) => void
  onCancel: () => void
}

// Shown after a thumbs down. The comment is optional.
export function FeedbackForm({ isPending, onSubmit, onCancel }: FeedbackFormProps) {
  const [comment, setComment] = useState('')
  return (
    <form
      aria-label="Tell us what went wrong"
      className="mt-2.5 grid max-w-[520px] gap-2.5 rounded-lg border border-edge bg-surface p-3.5"
      onSubmit={(event) => {
        event.preventDefault()
        onSubmit(comment.trim())
      }}
    >
      <TextField
        label="What went wrong? (optional)"
        multiline
        rows={3}
        value={comment}
        onChange={setComment}
        autoFocus
      />
      <div className="flex justify-end gap-2">
        <Button size="sm" onPress={onCancel}>
          Cancel
        </Button>
        <Button size="sm" variant="primary" type="submit" isPending={isPending} pendingLabel="Sending">
          Send feedback
        </Button>
      </div>
    </form>
  )
}
