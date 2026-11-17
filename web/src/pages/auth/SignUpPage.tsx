import { useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate } from 'react-router'
import { usePublicConfig } from '../../api/public-config'
import { useAuth } from '../../auth/use-auth'
import { Button, InlineNotice, PasswordField, SkeletonLines, TextField, toast } from '../../components/ui'
import { useAsyncAction } from '../../components/use-async-action'
import { AuthCard, AuthHeading, AuthLayout } from './AuthLayout'
import { CodeStep } from './CodeStep'
import { PasswordRules } from './PasswordRules'
import { domainMessage, isDomainAllowed, isEmailValid, isPasswordValid } from './password-rules'
import { SignupClosedScreen } from './StatusPages'

// Create account, then confirm the email with a code. Sign-up rules live on the server; the domain check
// here only gives the same answer sooner and keeps the form filled.
export function SignUpPage() {
  const { state, signUp, finishSignUp } = useAuth()
  const config = usePublicConfig()
  const navigate = useNavigate()
  const [step, setStep] = useState<'form' | 'code'>('form')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  if (state.status === 'signedIn') return <Navigate to="/home" replace />
  if (config.isPending) return <AuthLayout><AuthCard><SkeletonLines label="Loading" /></AuthCard></AuthLayout>
  if (config.data?.signupMode === 'off') return <AuthLayout><SignupClosedScreen /></AuthLayout>

  if (step === 'code') {
    return (
      <AuthLayout>
        <CodeStep
          title="Check your email"
          lead={<>We sent a six-digit code to <b className="font-medium text-ink">{email.trim()}</b>. Enter it to confirm your address.</>}
          submitLabel="Confirm email"
          onSubmit={async (code) => {
            const isSignedIn = await finishSignUp(email.trim(), code)
            if (isSignedIn) return
            navigate('/signin', { replace: true })
            toast.show('Email confirmed. Sign in to continue.')
          }}
        />
      </AuthLayout>
    )
  }

  return (
    <AuthLayout>
      <SignUpForm
        email={email}
        password={password}
        domains={config.data?.allowedEmailDomains ?? []}
        onEmail={setEmail}
        onPassword={setPassword}
        onSubmit={async () => {
          await signUp(email.trim(), password)
          setStep('code')
        }}
      />
    </AuthLayout>
  )
}

interface SignUpFormProps {
  email: string
  password: string
  domains: string[]
  onEmail: (value: string) => void
  onPassword: (value: string) => void
  onSubmit: () => Promise<void>
}

function SignUpForm({ email, password, domains, onEmail, onPassword, onSubmit }: SignUpFormProps) {
  const { busy, error, run } = useAsyncAction()
  const [problem, setProblem] = useState<string | null>(null)
  const alertRef = useRef<HTMLDivElement>(null)

  function submit(event: FormEvent) {
    event.preventDefault()
    const value = email.trim()
    const message = !isEmailValid(value)
      ? 'Enter your email address, like name@example.org.'
      : !isPasswordValid(password)
        ? 'Choose a password with at least 8 characters, upper and lower case letters, and a number.'
        : !isDomainAllowed(value, domains)
          ? domainMessage(domains)
          : null
    setProblem(message)
    if (message) {
      requestAnimationFrame(() => alertRef.current?.focus())
      return
    }
    void run(onSubmit)
  }

  const shown = problem ?? error
  return (
    <AuthCard as="form" onSubmit={submit}>
      <AuthHeading lead="Use your work email. An administrator may need to approve new accounts.">Create your account</AuthHeading>
      {shown && (
        <div ref={alertRef} tabIndex={-1} className="outline-none">
          <InlineNotice tone="bad">{shown}</InlineNotice>
        </div>
      )}
      <TextField label="Work email" type="email" autoComplete="username" placeholder="name@example.org" value={email} onChange={onEmail} autoFocus />
      <PasswordField label="Password" autoComplete="new-password" value={password} onChange={onPassword} />
      <PasswordRules value={password} />
      <Button type="submit" variant="primary" className="min-h-11" isPending={busy} pendingLabel="Creating account">Create account</Button>
      <p className="text-center text-small text-ink-3">Already have an account? <Link to="/signin">Sign in</Link></p>
    </AuthCard>
  )
}
