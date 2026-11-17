import { DotsThree, Key, Prohibit, CheckCircle, Trash } from '@phosphor-icons/react'
import type { AdminUser, UserRole } from '../../api/types'
import { Badge, CellText, IconButton, Menu, MenuDivider, MenuItem, MenuTrigger, Select, StatusChip, Table, type TableColumn } from '../ui'
import { isSelf, lastActiveLabel, SELF_NOTE, userStatusKind } from './users-helpers'

const ROLE_OPTIONS = [
  { id: 'user', label: 'Staff' },
  { id: 'admin', label: 'Administrator' },
]

export type UserAction = 'reset' | 'toggle-suspend' | 'delete'

interface AllUsersTableProps {
  users: AdminUser[]
  selfEmail: string | undefined
  onRole: (user: AdminUser, role: UserRole) => void
  onAction: (user: AdminUser, action: UserAction) => void
  empty: React.ReactNode
}

function StatusCell({ user }: { user: AdminUser }) {
  const kind = userStatusKind(user)
  if (kind === 'invited') return <StatusChip status="waiting" label="Invited" />
  return <StatusChip status={kind} />
}

function RowMenu({ user, self, onAction }: { user: AdminUser; self: boolean; onAction: AllUsersTableProps['onAction'] }) {
  const suspended = user.profileStatus === 'suspended'
  const disabledKeys = self ? ['toggle-suspend', 'delete'] : []
  return (
    <MenuTrigger>
      <IconButton size="sm" label={`Actions for ${user.email}`}>
        <DotsThree size={20} weight="bold" aria-hidden="true" />
      </IconButton>
      <Menu aria-label={`Actions for ${user.email}`} placement="bottom end" disabledKeys={disabledKeys} onAction={(key) => onAction(user, String(key) as UserAction)}>
        <MenuItem id="reset" icon={<Key size={18} />}>Send password reset</MenuItem>
        {suspended ? (
          <MenuItem id="toggle-suspend" icon={<CheckCircle size={18} />}>Restore access</MenuItem>
        ) : (
          <MenuItem id="toggle-suspend" icon={<Prohibit size={18} />}>{self ? 'Suspend (not for yourself)' : 'Suspend access'}</MenuItem>
        )}
        <MenuDivider />
        <MenuItem id="delete" isDanger icon={<Trash size={18} />}>Delete user</MenuItem>
      </Menu>
    </MenuTrigger>
  )
}

export function AllUsersTable({ users, selfEmail, onRole, onAction, empty }: AllUsersTableProps) {
  const columns: TableColumn<AdminUser>[] = [
    {
      id: 'email',
      header: 'Email',
      width: 'minmax(0,2.2fr)',
      isPrimary: true,
      cell: (user) => {
        const self = isSelf(user, selfEmail)
        return (
          <>
            <span className="flex items-center gap-2">
              <span className="truncate font-medium">{user.email}</span>
              {self && <Badge>You</Badge>}
            </span>
            {self && <span className="block text-small text-ink-3">{SELF_NOTE}</span>}
          </>
        )
      },
    },
    {
      id: 'role',
      header: 'Role',
      width: '180px',
      cell: (user) => (
        <Select
          label={`Role for ${user.email}`}
          isLabelHidden
          options={ROLE_OPTIONS}
          selectedKey={user.isAdmin ? 'admin' : 'user'}
          isDisabled={isSelf(user, selfEmail)}
          onSelectionChange={(key) => onRole(user, key === 'admin' ? 'admin' : 'user')}
        />
      ),
    },
    { id: 'status', header: 'Status', width: '150px', cell: (user) => <StatusCell user={user} /> },
    { id: 'active', header: 'Last active', width: 'minmax(0,1fr)', cell: (user) => <CellText title={<span className="font-normal text-ink-2">{lastActiveLabel(user.lastSeenAt)}</span>} /> },
    {
      id: 'actions',
      header: 'Actions',
      width: '56px',
      isActions: true,
      cell: (user) => <RowMenu user={user} self={isSelf(user, selfEmail)} onAction={onAction} />,
    },
  ]
  return <Table ariaLabel="Users" columns={columns} rows={users} getRowId={(user) => user.username} empty={empty} />
}
