import { useState } from 'react'
import { Books, Plus } from '@phosphor-icons/react'
import { Link, useNavigate } from 'react-router'
import { useBootstrap } from '../api/bootstrap'
import { useWorkspaceListItems } from '../api/workspaces'
import type { Workspace } from '../api/types'
import { useMarkSeenOnVisit } from '../chat/use-tip'
import { PageHead } from '../components/admin/PageHead'
import { QueryError, TableSkeleton } from '../components/admin/states'
import { Button, EmptyState, LoadMore, Table, type TableColumn } from '../components/ui'
import { NewWorkspaceDialog } from '../components/workspaces/WorkspaceDialogs'
import { WorkspaceBadge } from '../components/workspaces/WorkspaceBadge'

const LEAD = 'Collections of documents. Pick one when you chat and Genie answers from those files, with sources.'

export function WorkspacesPage() {
  const bootstrap = useBootstrap()
  const list = useWorkspaceListItems()
  const navigate = useNavigate()
  const [isCreating, setIsCreating] = useState(false)
  useMarkSeenOnVisit('workspaces')

  const columns: TableColumn<Workspace>[] = [
    {
      id: 'name',
      header: 'Name',
      width: 'minmax(0,2.4fr)',
      isPrimary: true,
      cell: (workspace) => (
        <>
          <Link to={`/workspaces/${workspace.workspaceId}`} className="block truncate font-medium text-ink no-underline hover:text-accent">
            {workspace.name}
          </Link>
          <span className="block truncate text-small text-ink-3">{workspace.description}</span>
        </>
      ),
    },
    { id: 'type', header: 'Type', width: '120px', cell: (workspace) => <WorkspaceBadge visibility={workspace.visibility} /> },
    { id: 'docs', header: 'Documents', width: '90px', align: 'numeric', cell: (workspace) => workspace.docCount },
    { id: 'owner', header: 'Owner', width: 'minmax(0,1.4fr)', cell: (workspace) => <span className="block truncate text-ink-2">{workspace.ownerEmail}</span> },
    {
      id: 'chat',
      header: 'Chat',
      width: '110px',
      isActions: true,
      cell: (workspace) => (
        <Button size="sm" aria-label={`Chat with ${workspace.name}`} onPress={() => navigate(`/home?workspace=${workspace.workspaceId}`)}>
          Chat
        </Button>
      ),
    },
  ]

  const newButton = (
    <Button variant="primary" onPress={() => setIsCreating(true)}>
      <Plus size={16} aria-hidden="true" />
      New workspace
    </Button>
  )

  return (
    <div className="animate-view">
      <PageHead title="Workspaces" lead={LEAD} actions={newButton} />
      {list.isPending && <TableSkeleton label="Loading workspaces" />}
      {list.isError && <QueryError what="your workspaces" error={list.error} onRetry={() => void list.refetch()} />}
      {list.isSuccess && (
        <>
          <Table
            ariaLabel="Workspaces"
            columns={columns}
            rows={list.items}
            getRowId={(workspace) => workspace.workspaceId}
            empty={
              <EmptyState icon={<Books />} title="No workspaces yet" action={<Button variant="primary" onPress={() => setIsCreating(true)}>New workspace</Button>}>
                Create one, add a few documents, and ask questions about them.
              </EmptyState>
            }
          />
          <LoadMore hasNextPage={Boolean(list.hasNextPage)} isFetchingNextPage={list.isFetchingNextPage} fetchNextPage={() => void list.fetchNextPage()} />
        </>
      )}
      <NewWorkspaceDialog isOpen={isCreating} onOpenChange={setIsCreating} canShare={bootstrap.data?.me.isAdmin ?? false} />
    </div>
  )
}
