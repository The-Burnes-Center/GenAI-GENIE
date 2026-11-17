import { useState } from 'react'
import { EnvelopeSimple, Fingerprint, LockKey } from '@phosphor-icons/react'
import { useAuth } from '../../auth/use-auth'
import type { FirstFactor } from '../../auth/auth-machine'
import { Button, InlineNotice } from '../../components/ui'
import { useAsyncAction } from '../../components/use-async-action'
import { AuthCard, AuthHeading } from './AuthLayout'
import { IdentityLine } from './IdentityLine'
import { WaitingForDevice } from './WaitingForDevice'

const CANCELLED_NOTE = 'Passkey sign-in was cancelled. You can try again or choose another way.'

interface MethodStepProps {
  email: string
  factors: FirstFactor[]
}

// Passkey first, then password, then email code (only when the pool can send mail).
export function MethodStep({ email, factors }: MethodStepProps) {
  const { chooseFactor, cancelSignIn } = useAuth()
  const { busy, error, run } = useAsyncAction()
  const [isWaiting, setIsWaiting] = useState(false)
  const [note, setNote] = useState<string | null>(null)

  async function signInWithPasskey() {
    setNote(null)
    setIsWaiting(true)
    try {
      await chooseFactor('WEB_AUTHN')
    } catch {
      setNote(CANCELLED_NOTE)
      setIsWaiting(false)
    }
  }

  if (isWaiting) return <WaitingForDevice onCancel={() => { setIsWaiting(false); setNote(CANCELLED_NOTE) }} />

  return (
    <AuthCard>
      <AuthHeading>Welcome back</AuthHeading>
      <IdentityLine email={email} onChange={cancelSignIn} />
      {note && <InlineNotice>{note}</InlineNotice>}
      {factors.length === 0 && <InlineNotice tone="bad">No sign-in method is available for this account in this browser.</InlineNotice>}
      <div className="grid gap-2.5">
        {factors.includes('WEB_AUTHN') && (
          <>
            <Button variant="primary" className="min-h-11 justify-start" autoFocus onPress={() => void signInWithPasskey()}>
              <Fingerprint size={20} aria-hidden="true" />
              Sign in with a passkey
            </Button>
            <p className="-mt-1 text-small text-ink-3">Use Face ID, Touch ID or a security key.</p>
            <div className="flex items-center gap-3 text-small text-ink-3 before:h-px before:flex-1 before:bg-edge after:h-px after:flex-1 after:bg-edge">or</div>
          </>
        )}
        {factors.includes('PASSWORD') && (
          <Button className="min-h-11 justify-start" isDisabled={busy} onPress={() => void run(() => chooseFactor('PASSWORD'))}>
            <LockKey size={20} aria-hidden="true" />
            Use your password
          </Button>
        )}
        {factors.includes('EMAIL_OTP') && (
          <Button className="min-h-11 justify-start" isDisabled={busy} onPress={() => void run(() => chooseFactor('EMAIL_OTP'))}>
            <EnvelopeSimple size={20} aria-hidden="true" />
            Email me a code
          </Button>
        )}
      </div>
      {error && <InlineNotice tone="bad">{error}</InlineNotice>}
    </AuthCard>
  )
}
