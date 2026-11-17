import { useRef, useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router'
import { useAuth } from '../../auth/use-auth'
import { Button, PasswordField, TextField, toast } from '../../components/ui'
import { useAsyncAction } from '../../components/use-async-action'
import { AuthCard, AuthHeading, AuthLayout } from './AuthLayout'
import { CodeStep } from './CodeStep'
import { PasswordRules } from './PasswordRules'
import { isEmailValid, isPasswordValid } from './password-rules'

type Step = 'email' | 'code' | 'password'

// Email, then code, then new password. The wording never confirms whether the email has an account.
export function ForgotPage() {
  const { forgotPassword, confirmForgotPassword } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState((location.state as { email?: string } | null)?.email ?? '')
  const [code, setCode] = useState('')

  return (
    <AuthLayout>
      {step === 'email' && (
        <EmailForm
          email={email}
          onEmail={setEmail}
          onSend={async () => {
            await forgotPassword(email.trim())
            setStep('code')
          }}
        />
      )}
      {step === 'code' && (
        <CodeStep
          title="Check your email"
          lead={<>If <b className="font-medium text-ink">{email.trim()}</b> has an account, a six-digit code is on its way.</>}
          submitLabel="Continue"
          onSubmit={async (value) => {
            setCode(value)
            setStep('password')
          }}
          onResend={() => forgotPassword(email.trim())}
        />
      )}
      {step === 'password' && (
        <NewPasswordForm
          onSave={async (password) => {
            await confirmForgotPassword(email.trim(), code, password)
            navigate('/signin', { replace: true })
            toast.show('Password changed. Sign in with your new password.')
          }}
          onBadCode={() => setStep('code')}
        />
      )}
    </AuthLayout>
  )
}

interface EmailFormProps {
  email: string
  onEmail: (email: string) => void
  onSend: () => Promise<void>
}

function EmailForm({ email, onEmail, onSend }: EmailFormProps) {
  const { busy, error, run } = useAsyncAction()
  const [hint, setHint] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!isEmailValid(email.trim())) {
      setHint('Enter your email address, like name@example.org.')
      inputRef.current?.focus()
      return
    }
    setHint(null)
    void run(onSend)
  }

  return (
    <AuthCard as="form" onSubmit={submit}>
      <AuthHeading lead="Enter your work email and we will send you a code.">Reset your password</AuthHeading>
      <TextField
        label="Work email"
        type="email"
        autoComplete="username"
        value={email}
        onChange={onEmail}
        autoFocus
        inputRef={inputRef}
        errorMessage={hint ?? error ?? undefined}
      />
      <Button type="submit" variant="primary" className="min-h-11" isPending={busy} pendingLabel="Sending">Send code</Button>
      <p className="text-small"><Link to="/signin">Back to sign in</Link></p>
    </AuthCard>
  )
}

function NewPasswordForm({ onSave, onBadCode }: { onSave: (password: string) => Promise<void>; onBadCode: () => void }) {
  const { busy, error, run } = useAsyncAction()
  const [password, setPassword] = useState('')

  function submit(event: FormEvent) {
    event.preventDefault()
    if (isPasswordValid(password)) void run(() => onSave(password))
  }

  return (
    <AuthCard as="form" onSubmit={submit}>
      <AuthHeading>Choose a new password</AuthHeading>
      <PasswordField label="New password" autoComplete="new-password" value={password} onChange={setPassword} autoFocus errorMessage={error ?? undefined} />
      <PasswordRules value={password} />
      <Button type="submit" variant="primary" className="min-h-11" isPending={busy} pendingLabel="Saving" isDisabled={!isPasswordValid(password)}>
        Change password
      </Button>
      {error && <p className="text-small"><Button variant="link" onPress={onBadCode}>Enter the code again</Button></p>}
    </AuthCard>
  )
}
