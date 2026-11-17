import { useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { usePublicConfig } from '../../api/public-config'
import { useAuth } from '../../auth/use-auth'
import { Button, TextField } from '../../components/ui'
import { useAsyncAction } from '../../components/use-async-action'
import { AuthCard, AuthHeading } from './AuthLayout'
import { isEmailValid } from './password-rules'

const EMAIL_HINT = 'Enter your email address, like name@example.org.'

// Step one. `webauthn` in autocomplete lets the browser offer a saved passkey right from this field.
export function EmailStep({ initialEmail = '' }: { initialEmail?: string }) {
  const { startSignIn } = useAuth()
  const config = usePublicConfig()
  const { busy, error, run } = useAsyncAction()
  const [email, setEmail] = useState(initialEmail)
  const [hint, setHint] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function submit(event: FormEvent) {
    event.preventDefault()
    const value = email.trim()
    if (!isEmailValid(value)) {
      setHint(EMAIL_HINT)
      inputRef.current?.focus()
      return
    }
    setHint(null)
    void run(() => startSignIn(value))
  }

  return (
    <AuthCard as="form" onSubmit={submit}>
      <AuthHeading>Sign in to Genie</AuthHeading>
      <TextField
        label="Work email"
        type="email"
        name="email"
        inputMode="email"
        autoComplete="username webauthn"
        placeholder="name@example.org"
        value={email}
        onChange={setEmail}
        autoFocus
        inputRef={inputRef}
        errorMessage={hint ?? error ?? undefined}
      />
      <Button type="submit" variant="primary" className="min-h-11" isPending={busy} pendingLabel="Checking">
        Continue
      </Button>
      {config.data?.signupMode === 'open' && (
        <p className="text-center text-small text-ink-3">
          New here? <Link to="/signup">Create an account</Link>
        </p>
      )}
    </AuthCard>
  )
}
