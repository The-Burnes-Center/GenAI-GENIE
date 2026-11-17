import { Outlet } from 'react-router'
import { ApiError } from '../api/client'
import { useBootstrap } from '../api/bootstrap'
import { ErrorText } from '../components/StatusText'
import { SkeletonLines } from '../components/ui'
import { AuthLayout } from '../pages/auth/AuthLayout'
import { PendingScreen, SuspendedScreen } from '../pages/auth/StatusPages'

// Bootstrap answers 403 PENDING_APPROVAL or SUSPENDED for an account that may not use the app. Both block it.
export function AccountGate() {
  const bootstrap = useBootstrap()
  if (bootstrap.isPending) return <div className="p-8"><SkeletonLines label="Loading Genie" /></div>
  if (bootstrap.isError) {
    const code = bootstrap.error instanceof ApiError ? bootstrap.error.code : ''
    if (code === 'PENDING_APPROVAL') return <AuthLayout><PendingScreen /></AuthLayout>
    if (code === 'SUSPENDED') return <AuthLayout><SuspendedScreen isSignedIn /></AuthLayout>
    return <ErrorText error={bootstrap.error} />
  }
  return <Outlet />
}
