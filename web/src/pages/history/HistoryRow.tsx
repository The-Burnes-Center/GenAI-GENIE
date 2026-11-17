import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { PencilSimple, Trash } from '@phosphor-icons/react'
import { Link } from 'react-router'
import type { Session } from '../../api/types'
import { Button, IconButton, TextField } from '../../components/ui'
import { sessionHref } from './session-href'

interface TitleCellProps {
  session: Session
  isEditing: boolean
  workspaceName?: string
  onSave: (title: string) => void
  onCancel: () => void
}

// The chat title as a link, or a small inline form while renaming. Enter saves, Escape cancels.
export function TitleCell({ session, isEditing, workspaceName, onSave, onCancel }: TitleCellProps) {
  const [draft, setDraft] = useState(session.title)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEditing) inputRef.current?.select()
  }, [isEditing])

  if (!isEditing) {
    return (
      <>
        <Link to={sessionHref(session)} className="block truncate font-medium text-ink no-underline hover:text-accent">
          {session.title}
        </Link>
        {workspaceName && <span className="block truncate text-small text-ink-3">{`Workspace: ${workspaceName}`}</span>}
      </>
    )
  }

  const save = () => {
    const title = draft.trim()
    if (title === '' || title === session.title) return onCancel()
    onSave(title)
  }
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onCancel()
    }
  }

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault()
        save()
      }}
      onKeyDown={handleKeyDown}
      className="flex flex-wrap items-end gap-2"
    >
      <TextField label="Chat name" inputRef={inputRef} value={draft} onChange={setDraft} maxLength={120} className="min-w-[200px] flex-1" />
      <Button type="submit" variant="primary" size="sm">Save</Button>
      <Button size="sm" onPress={onCancel}>Cancel</Button>
    </form>
  )
}

interface RowActionsProps {
  session: Session
  onRename: () => void
  onDelete: () => void
}

export function RowActions({ session, onRename, onDelete }: RowActionsProps) {
  return (
    <>
      <IconButton size="sm" label={`Rename ${session.title}`} onPress={onRename}><PencilSimple size={18} aria-hidden="true" /></IconButton>
      <IconButton size="sm" label={`Delete ${session.title}`} onPress={onDelete}><Trash size={18} aria-hidden="true" /></IconButton>
    </>
  )
}
