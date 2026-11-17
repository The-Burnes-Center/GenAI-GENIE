import { useState } from 'react'
import { describeError } from '../../api/errors'
import { useDeleteAllChats } from '../../api/history'
import { Button, Dialog, DialogFooter, InlineNotice, toast } from '../../components/ui'

interface DeleteAllDialogProps {
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
  // Number of chats loaded so far, or null when unknown. The list is paged, so more may exist.
  knownCount: number | null
  hasMore: boolean
}

export function DeleteAllDialog({ isOpen, onOpenChange, knownCount, hasMore }: DeleteAllDialogProps) {
  return (
    <Dialog title="Delete all your chats?" role="alertdialog" isOpen={isOpen} onOpenChange={onOpenChange}>
      {(close) => <DeleteAllBody close={close} knownCount={knownCount} hasMore={hasMore} />}
    </Dialog>
  )
}

function countText(knownCount: number | null, hasMore: boolean): string {
  if (knownCount === null) return 'all chats'
  if (hasMore) return `at least ${knownCount} chats`
  return `all ${knownCount} ${knownCount === 1 ? 'chat' : 'chats'}`
}

function DeleteAllBody({ close, knownCount, hasMore }: { close: () => void; knownCount: number | null; hasMore: boolean }) {
  const deleteAll = useDeleteAllChats()
  const [deleted, setDeleted] = useState(0)

  const run = () =>
    deleteAll.mutate(setDeleted, {
      onSuccess: (total) => {
        close()
        toast.show(total === 1 ? '1 chat deleted.' : `${total} chats deleted.`)
      },
    })

  return (
    <>
      <p className="text-body text-ink-2">
        {`This permanently deletes ${countText(knownCount, hasMore)} and their messages from your account. It can't be undone.`}
      </p>
      {deleteAll.isPending && <p role="status" className="font-medium">{`Deleted ${deleted} so far`}</p>}
      {deleteAll.isError && (
        <InlineNotice tone="bad">{`${describeError(deleteAll.error)} ${deleted} deleted before it stopped.`}</InlineNotice>
      )}
      <DialogFooter>
        <Button autoFocus isDisabled={deleteAll.isPending} onPress={close}>Cancel</Button>
        <Button variant="danger" isPending={deleteAll.isPending} pendingLabel="Deleting" onPress={run}>
          {deleteAll.isError ? 'Try again' : 'Delete all chats'}
        </Button>
      </DialogFooter>
    </>
  )
}
