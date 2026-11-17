import { useState } from 'react'
import { useNavigate } from 'react-router'
import { DotsThree, PencilSimple, Trash } from '@phosphor-icons/react'
import { useDeleteSession, useRenameSession } from '../../api/sessions'
import { describeError } from '../../api/errors'
import type { Session } from '../../api/types'
import {
  AlertDialog, Button, Dialog, DialogFooter, IconButton, Menu, MenuItem, MenuTrigger, TextField, toast,
} from '../../components/ui'

const MAX_TITLE_LENGTH = 120

interface ChatActionsProps {
  session: Session
  isCurrent: boolean
}

// The "more" menu on a history row: rename and delete. Dialogs sit outside the menu so focus returns cleanly.
export function ChatActions({ session, isCurrent }: ChatActionsProps) {
  const [isRenaming, setIsRenaming] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const navigate = useNavigate()
  const remove = useDeleteSession()

  async function confirmDelete() {
    try {
      await remove.mutateAsync(session.sessionId)
      toast.show('Chat deleted.')
      if (isCurrent) navigate('/home')
    } catch (error) {
      toast.error(describeError(error))
    }
  }

  return (
    <>
      <MenuTrigger>
        <IconButton
          label={`Actions for ${session.title}`}
          size="sm"
          className="hist-more absolute right-0.5 opacity-0 data-[pressed]:opacity-100 group-focus-within/row:opacity-100 group-hover/row:opacity-100 [@media(hover:none)]:opacity-100"
        >
          <DotsThree size={20} weight="bold" aria-hidden="true" />
        </IconButton>
        <Menu aria-label="Chat actions" onAction={(key) => (key === 'rename' ? setIsRenaming(true) : setIsDeleting(true))}>
          <MenuItem id="rename" icon={<PencilSimple size={20} />}>Rename</MenuItem>
          <MenuItem id="delete" icon={<Trash size={20} />} isDanger>Delete</MenuItem>
        </Menu>
      </MenuTrigger>
      <RenameDialog session={session} isOpen={isRenaming} onOpenChange={setIsRenaming} />
      <AlertDialog
        title="Delete this chat?"
        body={`"${session.title}" and its messages will be deleted. This can't be undone.`}
        confirmLabel="Delete chat"
        isOpen={isDeleting}
        onOpenChange={setIsDeleting}
        onConfirm={confirmDelete}
      />
    </>
  )
}

interface RenameDialogProps {
  session: Session
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
}

function RenameDialog({ session, isOpen, onOpenChange }: RenameDialogProps) {
  const [title, setTitle] = useState(session.title)
  const rename = useRenameSession()

  async function save(close: () => void) {
    const next = title.trim()
    if (!next) return
    try {
      await rename.mutateAsync({ id: session.sessionId, title: next })
      toast.show('Chat renamed.')
      close()
    } catch (error) {
      toast.error(describeError(error))
    }
  }

  return (
    <Dialog title="Rename chat" isOpen={isOpen} onOpenChange={onOpenChange}>
      {(close) => (
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            void save(close)
          }}
        >
          <TextField label="Chat name" value={title} onChange={setTitle} isRequired autoFocus maxLength={MAX_TITLE_LENGTH} />
          <DialogFooter>
            <Button onPress={close}>Cancel</Button>
            <Button type="submit" variant="primary" isPending={rename.isPending} isDisabled={!title.trim()}>Save</Button>
          </DialogFooter>
        </form>
      )}
    </Dialog>
  )
}
