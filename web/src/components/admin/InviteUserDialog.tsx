import { useState, type FormEvent } from 'react'
import { describeError } from '../../api/errors'
import { useInviteUser } from '../../api/admin-users'
import type { UserRole } from '../../api/types'
import { Button, Dialog, DialogFooter, Select, TextField, toast } from '../ui'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const ROLE_OPTIONS = [
  { id: 'user', label: 'Staff' },
  { id: 'admin', label: 'Administrator' },
]

export function InviteUserDialog({ isOpen, onOpenChange }: { isOpen: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog title="Invite someone" isOpen={isOpen} onOpenChange={onOpenChange}>
      {(close) => <InviteForm close={close} />}
    </Dialog>
  )
}

function InviteForm({ close }: { close: () => void }) {
  const invite = useInviteUser()
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<UserRole>('user')
  const [problem, setProblem] = useState<string | null>(null)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    const trimmed = email.trim()
    if (!EMAIL_PATTERN.test(trimmed)) {
      setProblem('Enter a work email address, for example name@example.org.')
      return
    }
    setProblem(null)
    invite.mutate(
      { email: trimmed, role },
      {
        onSuccess: () => {
          toast.show('Invitation sent.')
          close()
        },
        onError: (error) => setProblem(describeError(error)),
      },
    )
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="grid gap-4">
      <p className="text-ink-2">They get an email with a temporary password and set their own the first time they sign in.</p>
      <TextField
        label="Email"
        type="email"
        autoFocus
        value={email}
        onChange={setEmail}
        placeholder="name@example.org"
        errorMessage={problem ?? undefined}
        autoComplete="off"
      />
      <Select label="Role" options={ROLE_OPTIONS} selectedKey={role} onSelectionChange={(key) => setRole(key === 'admin' ? 'admin' : 'user')} />
      <DialogFooter>
        <Button onPress={close}>Cancel</Button>
        <Button type="submit" variant="primary" isPending={invite.isPending} pendingLabel="Sending">Send invitation</Button>
      </DialogFooter>
    </form>
  )
}
