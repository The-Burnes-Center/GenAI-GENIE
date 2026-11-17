import { useMemo, useState } from 'react'
import { CheckCircle, UserPlus } from '@phosphor-icons/react'
import { useAdminUsers } from '../../api/admin-users'
import { useBootstrap } from '../../api/bootstrap'
import { AllUsersTable } from '../../components/admin/AllUsersTable'
import { InviteUserDialog } from '../../components/admin/InviteUserDialog'
import { PageHead, SectionTitle } from '../../components/admin/PageHead'
import { PendingUsersTable } from '../../components/admin/PendingUsersTable'
import { QueryError, TableSkeleton } from '../../components/admin/states'
import { useConfirm } from '../../components/admin/use-confirm'
import { useUserActions } from '../../components/admin/use-user-actions'
import { Button, EmptyState, InlineNotice, LoadMore, SearchField } from '../../components/ui'

function PendingSection({ onApprove, onDecline }: { onApprove: Parameters<typeof PendingUsersTable>[0]['onApprove']; onDecline: Parameters<typeof PendingUsersTable>[0]['onDecline'] }) {
  const pending = useAdminUsers('pending')
  if (pending.isPending) return <TableSkeleton label="Loading sign-ups" rows={2} />
  if (pending.isError) return <QueryError what="the sign-ups waiting for approval" error={pending.error} onRetry={() => void pending.refetch()} />
  if (pending.items.length === 0) {
    return <InlineNotice tone="ok">No sign-ups are waiting for approval.</InlineNotice>
  }
  return (
    <>
      <SectionTitle id="pending-heading">{`Waiting for approval (${pending.items.length})`}</SectionTitle>
      <p className="-mt-2 mb-3 text-small text-ink-3">These people created their own accounts. They can't use Genie until you approve them.</p>
      <PendingUsersTable users={pending.items} onApprove={onApprove} onDecline={onDecline} />
    </>
  )
}

export function AdminUsersPage() {
  const [isInviting, setIsInviting] = useState(false)
  const [search, setSearch] = useState('')
  const { ask, dialog } = useConfirm()
  const actions = useUserActions(ask)
  const bootstrap = useBootstrap()
  const users = useAdminUsers()
  const query = search.trim().toLowerCase()
  const shown = useMemo(() => users.items.filter((user) => user.email.toLowerCase().includes(query)), [users.items, query])

  return (
    <>
      <PageHead
        title="Users"
        lead="Invite people, approve sign-ups, and change roles."
        actions={
          <Button variant="primary" onPress={() => setIsInviting(true)}>
            <UserPlus size={16} aria-hidden="true" />
            Invite someone
          </Button>
        }
      />
      <PendingSection onApprove={(user) => void actions.approve(user)} onDecline={actions.decline} />
      <SectionTitle id="everyone-heading">{`Everyone (${shown.length})`}</SectionTitle>
      <SearchField label="Search users by email" placeholder="Search by email" value={search} onChange={setSearch} className="mb-4 max-w-md" />
      {users.isPending && <TableSkeleton label="Loading users" />}
      {users.isError && <QueryError what="users" error={users.error} onRetry={() => void users.refetch()} />}
      {users.isSuccess && (
        <>
          <AllUsersTable
            users={shown}
            selfEmail={bootstrap.data?.me.email}
            onRole={(user, role) => void actions.changeRole(user, role)}
            onAction={actions.runAction}
            empty={
              <EmptyState icon={<CheckCircle />} title={query ? 'No users match that search' : 'No users yet'} headingLevel={3}>
                {query ? 'Try a different email, or clear the search.' : 'Invite someone to get started.'}
              </EmptyState>
            }
          />
          <LoadMore hasNextPage={Boolean(users.hasNextPage)} isFetchingNextPage={users.isFetchingNextPage} fetchNextPage={() => void users.fetchNextPage()} />
        </>
      )}
      <InviteUserDialog isOpen={isInviting} onOpenChange={setIsInviting} />
      {dialog}
    </>
  )
}
