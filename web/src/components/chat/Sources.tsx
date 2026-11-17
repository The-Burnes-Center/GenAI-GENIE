import { useId } from 'react'
import { Link } from 'react-router'
import { CaretRight } from '@phosphor-icons/react'
import { useWorkspaceListItems } from '../../api/workspaces'
import type { Citation } from '../../api/types'
import { sourceElementId } from '../../chat/source-ids'
import { cx } from '../ui'

interface SourcesProps {
  messageId: string
  citations: Citation[]
  isOpen: boolean
  onOpenChange: (isOpen: boolean) => void
}

// The list behind the numbered chips: document name, the passage used, and the workspace it came from.
export function Sources({ messageId, citations, isOpen, onOpenChange }: SourcesProps) {
  const listId = useId()
  const workspaces = useWorkspaceListItems()
  if (citations.length === 0) return null
  const workspaceName = (id: string) => workspaces.items.find((workspace) => workspace.workspaceId === id)?.name

  return (
    <div className="mt-3.5 border-t border-edge pt-2">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls={listId}
        onClick={() => onOpenChange(!isOpen)}
        className="-ml-1 flex min-h-8 items-center gap-1.5 rounded-sm px-1 font-medium text-ink-2 hover:text-ink pointer-coarse:min-h-11"
      >
        <CaretRight size={14} aria-hidden="true" className={cx('transition-transform duration-[var(--duration-fast)]', isOpen && 'rotate-90')} />
        Sources ({citations.length})
      </button>
      <ol id={listId} hidden={!isOpen} aria-label="Sources" className="mt-1.5 grid gap-2">
        {citations.map((citation) => {
          const name = citation.workspaceId ? workspaceName(citation.workspaceId) : undefined
          return (
            <li
              key={`${citation.documentId ?? ''}-${citation.index}`}
              id={sourceElementId(messageId, citation.index)}
              tabIndex={-1}
              className="grid grid-cols-[24px_1fr] gap-2 rounded-md p-2.5 text-small focus:bg-accent-soft focus-visible:outline-2 focus-visible:outline-focus"
            >
              <span className="grid size-5 place-items-center rounded-xs bg-accent-soft text-caption font-semibold text-accent-soft-ink">
                {citation.index}
              </span>
              <span className="min-w-0">
                <b className="block font-medium">{citation.title}</b>
                {citation.snippet && <q className="mt-0.5 block text-ink-2 [quotes:none]">{citation.snippet}</q>}
                <span className="mt-0.5 block text-ink-3">
                  {name ? (
                    <>
                      Workspace:{' '}
                      <Link to={`/workspaces/${citation.workspaceId}`} className="text-ink-3 underline underline-offset-2">
                        {name}
                      </Link>
                    </>
                  ) : (
                    'From a workspace'
                  )}
                </span>
              </span>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
