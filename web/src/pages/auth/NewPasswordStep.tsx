import { useState, type FormEvent } from 'react'
import { useAuth } from '../../auth/use-auth'
import { Button, PasswordField } from '../../components/ui'
import { useAsyncAction } from '../../components/use-async-action'
import { AuthCard, AuthHeading } from './AuthLayout'
import { PasswordRules } from './PasswordRules'
import { isPasswordValid } from './password-rules'

// Invited user: choose a permanent password. The button stays disabled until the rules and the match pass.
export function NewPasswordStep() {
  const { submitChallenge } = useAuth()
  const { busy, error, run } = useAsyncAction()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const doesMatch = password === confirm
  const isReady = isPasswordValid(password) && doesMatch

  function submit(event: FormEvent) {
    event.preventDefault()
    if (isReady) void run(() => submitChallenge(password))
  }

  return (
    <AuthCard as="form" onSubmit={submit}>
      <AuthHeading lead="Your administrator invited you. Choose a password to finish setting up your account.">Set your password</AuthHeading>
      <PasswordField label="New password" autoComplete="new-password" value={password} onChange={setPassword} autoFocus />
      <PasswordRules value={password} />
      <PasswordField
        label="Confirm new password"
        autoComplete="new-password"
        value={confirm}
        onChange={setConfirm}
        errorMessage={confirm && !doesMatch ? "The two passwords don't match." : error ?? undefined}
      />
      <Button type="submit" variant="primary" className="min-h-11" isPending={busy} pendingLabel="Saving" isDisabled={!isReady}>
        Set password and continue
      </Button>
    </AuthCard>
  )
}
