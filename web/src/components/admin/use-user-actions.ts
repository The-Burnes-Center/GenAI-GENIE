import { useDeleteAdminUser, useResetAdminUserPassword, useUpdateAdminUser } from '../../api/admin-users'
import { describeError } from '../../api/errors'
import type { AdminUser, UserRole } from '../../api/types'
import { toast } from '../ui'
import type { UserAction } from './AllUsersTable'
import type { ConfirmSpec } from './use-confirm'

// Every user action in one place so the page only wires buttons. Destructive ones go through `ask`.
export function useUserActions(ask: (spec: ConfirmSpec) => void) {
  const update = useUpdateAdminUser()
  const reset = useResetAdminUserPassword()
  const remove = useDeleteAdminUser()

  const patch = (user: AdminUser, body: { role?: UserRole; status?: 'active' | 'suspended' }, done: string) =>
    update.mutateAsync({ username: user.username, patch: body }).then(
      () => void toast.show(done),
      (error: unknown) => void toast.error(describeError(error)),
    )

  const approve = (user: AdminUser) => patch(user, { status: 'active' }, 'Approved. They can sign in now.')

  const changeRole = (user: AdminUser, role: UserRole) =>
    patch(user, { role }, `${user.email} is now ${role === 'admin' ? 'an administrator' : 'a staff member'}.`)

  const decline = (user: AdminUser) =>
    ask({
      title: 'Decline this sign-up?',
      body: `${user.email} won't be able to use Genie, and their account will be removed. They can sign up again later.`,
      confirmLabel: 'Decline',
      onConfirm: async () => {
        await remove.mutateAsync(user.username)
        toast.show('Sign-up declined.')
      },
    })

  const runAction = (user: AdminUser, action: UserAction) => {
    if (action === 'reset') {
      reset.mutate(user.username, {
        onSuccess: () => toast.show(`Reset code sent to ${user.email}.`),
        onError: (error) => toast.error(describeError(error)),
      })
    } else if (action === 'toggle-suspend') {
      toggleSuspend(user)
    } else {
      ask({
        title: `Delete ${user.email}?`,
        body: "Their account and chats are permanently deleted. This can't be undone.",
        confirmLabel: 'Delete user',
        onConfirm: async () => {
          await remove.mutateAsync(user.username)
          toast.show('User deleted.')
        },
      })
    }
  }

  const toggleSuspend = (user: AdminUser) => {
    if (user.profileStatus === 'suspended') {
      void patch(user, { status: 'active' }, 'Access restored.')
      return
    }
    ask({
      title: `Suspend ${user.email}?`,
      body: 'They will see a message that their account is suspended. Their chats are kept.',
      confirmLabel: 'Suspend',
      onConfirm: () => patch(user, { status: 'suspended' }, 'Access suspended.'),
    })
  }

  return { approve, decline, changeRole, runAction }
}
