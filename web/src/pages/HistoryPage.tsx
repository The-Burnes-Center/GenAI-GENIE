import { useMemo, useState } from 'react'
import { ChatText, MagnifyingGlass, Trash } from '@phosphor-icons/react'
import { useNavigate } from 'react-router'
import { flattenPages } from '../api/paging'
import { useDeleteSession, useRenameSession, useSessionList } from '../api/sessions'
import { useBootstrap } from '../api/bootstrap'
import { useWorkspaceListItems } from '../api/workspaces'
import type { Session } from '../api/types'
import { PageHead } from '../components/admin/PageHead'
import { QueryError, TableSkeleton } from '../components/admin/states'
import { useConfirm } from '../components/admin/use-confirm'
import { useDebouncedValue } from '../components/use-debounced-value'
import { Button, EmptyState, LoadMore, SearchField, Table, toast, type TableColumn } from '../components/ui'
import { groupSessions } from '../layout/sidebar/group-sessions'
import { DeleteAllDialog } from './history/DeleteAllDialog'
import { RowActions, TitleCell } from './history/HistoryRow'

const SEARCH_DELAY_MS = 300

export function HistoryPage() {
  const [search, setSearch] = useState('')
  const query = useDebouncedValue(search.trim(), SEARCH_DELAY_MS)
  const list = useSessionList(query)
  const workspaces = useWorkspaceListItems()
  const bootstrap = useBootstrap()
  const rename = useRenameSession()
  const remove = useDeleteSession()
  const { ask, dialog } = useConfirm()
  const navigate = useNavigate()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [isDeletingAll, setIsDeletingAll] = useState(false)

  const sessions = useMemo(() => flattenPages(list.data), [list.data])
  const groups = useMemo(() => groupSessions(sessions), [sessions])
  const workspaceNames = useMemo(() => new Map(workspaces.items.map((item) => [item.workspaceId, item.name])), [workspaces.items])

  const modelLabels = useMemo(() => new Map((bootstrap.data?.models ?? []).map((model) => [model.modelId, model.label])), [bootstrap.data])
  const modelText = (session: Session) => {
    if (session.mode === 'compare') return `Comparison of ${session.modelIds?.length ?? 2} models`
    return modelLabels.get(session.modelId) ?? session.modelId
  }

  const confirmDelete = (session: Session) =>
    ask({
      title: 'Delete this chat?',
      body: `"${session.title}" and its messages will be deleted. This can't be undone.`,
      confirmLabel: 'Delete chat',
      onConfirm: async () => {
        await remove.mutateAsync(session.sessionId)
        toast.show('Chat deleted.')
      },
    })

  const saveTitle = (session: Session, title: string) =>
    rename.mutate({ id: session.sessionId, title }, {
      onSuccess: () => setEditingId(null),
      onError: () => toast.error('Could not rename the chat. Try again.'),
    })

  const columns = (label: string): TableColumn<Session>[] => [
    {
      id: 'title',
      header: label,
      width: 'minmax(0,3fr)',
      isPrimary: true,
      cell: (session) => (
        <TitleCell
          session={session}
          isEditing={editingId === session.sessionId}
          workspaceName={session.workspaceId ? workspaceNames.get(session.workspaceId) : undefined}
          onSave={(title) => saveTitle(session, title)}
          onCancel={() => setEditingId(null)}
        />
      ),
    },
    { id: 'model', header: 'Model', width: 'minmax(0,1.4fr)', cell: (session) => <span className="block truncate text-ink-2">{modelText(session)}</span> },
    {
      id: 'actions',
      header: 'Actions',
      width: '110px',
      isActions: true,
      cell: (session) => <RowActions session={session} onRename={() => setEditingId(session.sessionId)} onDelete={() => confirmDelete(session)} />,
    },
  ]

  const deleteAllButton = (
    <Button className="text-danger" onPress={() => setIsDeletingAll(true)}>
      <Trash size={16} aria-hidden="true" />
      Delete all chats
    </Button>
  )

  return (
    <div className="animate-view">
      <PageHead title="History" lead="Everything you have asked Genie. Only you can see these chats." actions={deleteAllButton} />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <SearchField label="Search your chats" value={search} onChange={setSearch} className="min-w-[200px] flex-1" />
        <span role="status" className="text-small text-ink-3">
          {list.isSuccess ? `${sessions.length}${list.hasNextPage ? '+' : ''} ${sessions.length === 1 ? 'chat' : 'chats'}` : ''}
        </span>
      </div>
      {list.isPending && <TableSkeleton label="Loading your chats" />}
      {list.isError && <QueryError what="your chats" error={list.error} onRetry={() => void list.refetch()} />}
      {list.isSuccess && sessions.length === 0 && (
        query ? (
          <EmptyState icon={<MagnifyingGlass />} title={`No chats match "${query}"`}>Try a different word, or clear the search.</EmptyState>
        ) : (
          <EmptyState icon={<ChatText />} title="No chats yet" action={<Button variant="primary" onPress={() => navigate('/home')}>Start a chat</Button>}>
            Your conversations show up here so you can come back to them.
          </EmptyState>
        )
      )}
      {groups.map((group) => (
        <section key={group.label} aria-labelledby={`group-${group.label}`} className="mt-6 first-of-type:mt-0">
          <h2 id={`group-${group.label}`} className="mb-2 text-ui font-semibold">{group.label}</h2>
          <Table ariaLabel={group.label} columns={columns('Chat')} rows={group.sessions} getRowId={(session) => session.sessionId} />
        </section>
      ))}
      <LoadMore hasNextPage={Boolean(list.hasNextPage)} isFetchingNextPage={list.isFetchingNextPage} fetchNextPage={() => void list.fetchNextPage()} />
      {dialog}
      <DeleteAllDialog
        isOpen={isDeletingAll}
        onOpenChange={setIsDeletingAll}
        knownCount={list.isSuccess && !query ? sessions.length : null}
        hasMore={Boolean(list.hasNextPage)}
      />
    </div>
  )
}
