import { Navigate, Outlet, useLocation } from 'react-router'
import { SkeletonLines } from '../components/ui'
import { useAuth } from './use-auth'

// Layout route: renders children only for a signed-in user. A suspended sign-in goes back to the sign-in page.
export function RequireAuth() {
  const { state } = useAuth()
  const location = useLocation()

  if (state.status === 'loading') return <div className="p-8"><SkeletonLines label="Loading" /></div>
  if (state.status !== 'signedIn') {
    const from = `${location.pathname}${location.search}`
    return <Navigate to="/signin" replace state={{ from }} />
  }
  return <Outlet />
}
