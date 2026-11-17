import { useState, type FormEvent } from 'react'
import { useAuth } from '../../auth/use-auth'
import { Button, PasswordField, toast } from '../../components/ui'
import { useAsyncAction } from '../../components/use-async-action'
import { PasswordRules } from '../auth/PasswordRules'
import { isPasswordValid } from '../auth/password-rules'

export function PasswordForm() {
  const { changePassword } = useAuth()
  const { busy, error, run } = useAsyncAction()
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const isReady = current !== '' && isPasswordValid(next)

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!isReady) return
    void run(async () => {
      await changePassword(current, next)
      setCurrent('')
      setNext('')
      toast.show('Password changed.')
    })
  }

  return (
    <form onSubmit={submit} noValidate className="grid max-w-[640px] gap-5">
      <PasswordField label="Current password" autoComplete="current-password" value={current} onChange={setCurrent} errorMessage={error ?? undefined} />
      <PasswordField label="New password" autoComplete="new-password" value={next} onChange={setNext} />
      <PasswordRules value={next} />
      <div>
        <Button type="submit" variant="primary" isPending={busy} pendingLabel="Saving" isDisabled={!isReady}>Change password</Button>
      </div>
    </form>
  )
}
