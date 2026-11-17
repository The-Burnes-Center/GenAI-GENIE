import { useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../../auth/use-auth'
import { Button, PasswordField } from '../../components/ui'
import { useAsyncAction } from '../../components/use-async-action'
import { AuthCard, AuthHeading } from './AuthLayout'
import { IdentityLine } from './IdentityLine'

interface PasswordStepProps {
  email: string
  // True while Cognito still shows the factor list: the factor is chosen first, then the password is sent.
  isViaChoice: boolean
  canEmailCode: boolean
}

export function PasswordStep({ email, isViaChoice, canEmailCode }: PasswordStepProps) {
  const { chooseFactor, submitChallenge, startSignIn, cancelSignIn } = useAuth()
  const { busy, error, run } = useAsyncAction()
  const [password, setPassword] = useState('')
  const [hint, setHint] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!password) {
      setHint('Enter your password.')
      inputRef.current?.focus()
      return
    }
    setHint(null)
    void run(async () => {
      if (isViaChoice) await chooseFactor('PASSWORD')
      await submitChallenge(password)
    })
  }

  return (
    <AuthCard as="form" onSubmit={submit}>
      <AuthHeading>Enter your password</AuthHeading>
      <IdentityLine email={email} onChange={cancelSignIn} />
      <PasswordField
        label="Password"
        name="password"
        autoComplete="current-password"
        value={password}
        onChange={setPassword}
        autoFocus
        inputRef={inputRef}
        errorMessage={hint ?? error ?? undefined}
      />
      <Button type="submit" variant="primary" className="min-h-11" isPending={busy} pendingLabel="Signing in">
        Sign in
      </Button>
      <p className="flex flex-wrap justify-between gap-x-4 gap-y-1 text-small">
        <Link to="/forgot" state={{ email }}>Forgot password?</Link>
        {isViaChoice && canEmailCode ? (
          <Button variant="link" isDisabled={busy} onPress={() => void run(() => chooseFactor('EMAIL_OTP'))}>Email me a code instead</Button>
        ) : (
          <Button variant="link" isDisabled={busy} onPress={() => void run(() => startSignIn(email))}>Use a different method</Button>
        )}
      </p>
    </AuthCard>
  )
}
