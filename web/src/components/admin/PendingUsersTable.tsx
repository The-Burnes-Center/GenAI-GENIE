import type { AdminUser } from '../../api/types'
import { Button, CellText, Table, type TableColumn } from '../ui'
import { signedUpLabel } from './users-helpers'

interface PendingUsersTableProps {
  users: AdminUser[]
  onApprove: (user: AdminUser) => void
  onDecline: (user: AdminUser) => void
}

export function PendingUsersTable({ users, onApprove, onDecline }: PendingUsersTableProps) {
  const columns: TableColumn<AdminUser>[] = [
    { id: 'email', header: 'Email', width: 'minmax(0,2fr)', isPrimary: true, cell: (user) => <CellText title={user.email} /> },
    { id: 'when', header: 'Signed up', width: 'minmax(0,1.4fr)', cell: (user) => signedUpLabel(user.createdAt) },
    {
      id: 'actions',
      header: 'Actions',
      width: '190px',
      isActions: true,
      cell: (user) => (
        <>
          <Button variant="primary" size="sm" aria-label={`Approve ${user.email}`} onPress={() => onApprove(user)}>Approve</Button>
          <Button size="sm" aria-label={`Decline ${user.email}`} onPress={() => onDecline(user)}>Decline</Button>
        </>
      ),
    },
  ]
  return <Table ariaLabel="Sign-ups waiting for approval" columns={columns} rows={users} getRowId={(user) => user.username} />
}
