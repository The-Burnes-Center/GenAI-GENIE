import { Navigate, useLocation } from 'react-router'
import { useAuth } from '../../auth/use-auth'
import type { ChallengeStep } from '../../auth/auth-machine'
import { usePublicConfig } from '../../api/public-config'
import { SkeletonLines } from '../../components/ui'
import { AuthCard, AuthLayout } from './AuthLayout'
import { CodeStep } from './CodeStep'
import { EmailStep } from './EmailStep'
import { MethodStep } from './MethodStep'
import { NewPasswordStep } from './NewPasswordStep'
import { PasswordStep } from './PasswordStep'
import { safeReturnPath } from './return-path'
import { SuspendedScreen } from './StatusPages'

// One route, many steps. The auth state machine decides which step shows.
export function SignInPage() {
  const { state } = useAuth()
  const location = useLocation()

  if (state.status === 'signedIn') return <Navigate to={safeReturnPath(location.state)} replace />
  return (
    <AuthLayout>
      {state.status === 'loading' && <AuthCard><SkeletonLines label="Loading" /></AuthCard>}
      {state.status === 'signedOut' && <EmailStep />}
      {state.status === 'suspended' && <SuspendedScreen />}
      {state.status === 'challenge' && <ChallengeView email={state.email} step={state.step} />}
    </AuthLayout>
  )
}

function ChallengeView({ email, step }: { email: string; step: ChallengeStep }) {
  const { submitChallenge } = useAuth()
  const config = usePublicConfig()
  const canEmailCode = config.data?.emailOtp !== false

  if (step.kind === 'chooseFactor') {
    // Without a passkey the person goes straight to the password step. The password step then picks the factor.
    const hasPasskey = step.factors.includes('WEB_AUTHN')
    const hasPassword = step.factors.includes('PASSWORD')
    if (!hasPasskey && hasPassword) {
      return <PasswordStep email={email} isViaChoice canEmailCode={step.factors.includes('EMAIL_OTP') && canEmailCode} />
    }
    return <MethodStep email={email} factors={step.factors} />
  }
  if (step.kind === 'password') return <PasswordStep email={email} isViaChoice={false} canEmailCode={false} />
  if (step.kind === 'newPassword') return <NewPasswordStep />
  return (
    <CodeStep
      title="Check your email"
      lead={<>We sent a six-digit code to <b className="font-medium text-ink">{email}</b>. It works for 10 minutes.</>}
      submitLabel="Sign in"
      onSubmit={submitChallenge}
    />
  )
}
