import { Hourglass, LockKey, Prohibit } from '@phosphor-icons/react'
import { useQueryClient } from '@tanstack/react-query'
import { bootstrapKey } from '../../api/query-keys'
import { useAuth } from '../../auth/use-auth'
import { Button, LinkButton, toast } from '../../components/ui'
import { AuthLayout, StatusScreen } from './AuthLayout'

function SignOutButton({ variant = 'secondary' }: { variant?: 'primary' | 'secondary' }) {
  const { signOut } = useAuth()
  return (
    <Button variant={variant} onPress={() => void signOut().catch(() => toast.error('Could not sign out. Try again.'))}>
      Sign out
    </Button>
  )
}

export function PendingScreen() {
  const queryClient = useQueryClient()
  return (
    <StatusScreen
      icon={<Hourglass />}
      title="Thanks. Your account is waiting for approval"
      actions={
        <>
          <Button
            variant="primary"
            onPress={() => {
              void queryClient.invalidateQueries({ queryKey: bootstrapKey })
              toast.show('Still waiting. Nothing has changed yet.')
            }}
          >
            Check again
          </Button>
          <SignOutButton />
        </>
      }
    >
      An administrator reviews every new account. We will email you as soon as you are approved. You can close this page.
    </StatusScreen>
  )
}

// Shown when Cognito says "User is disabled" at sign-in, or the server answers 403 SUSPENDED.
export function SuspendedScreen({ isSignedIn = false }: { isSignedIn?: boolean }) {
  const { cancelSignIn } = useAuth()
  return (
    <StatusScreen
      icon={<Prohibit />}
      title="Your account is suspended"
      actions={isSignedIn ? <SignOutButton variant="primary" /> : <Button variant="primary" onPress={cancelSignIn}>Back to sign in</Button>}
    >
      You can't use Genie right now. If you think this is a mistake, contact your administrator.
    </StatusScreen>
  )
}

export function SignupClosedScreen() {
  return (
    <StatusScreen
      icon={<LockKey />}
      title="Sign-up is closed right now"
      actions={<LinkButton variant="primary" href="/signin">Back to sign in</LinkButton>}
    >
      Genie accounts are created by invitation. Ask your administrator to invite you, then check your email for the next step.
    </StatusScreen>
  )
}

// Routes /pending and /suspended: visited directly (for example from a bookmark) they show the same screens.
export function PendingPage() {
  return <AuthLayout><PendingScreen /></AuthLayout>
}

export function SuspendedPage() {
  return <AuthLayout><SuspendedScreen /></AuthLayout>
}
