import { Outlet } from 'react-router'
import { useBootstrap } from '../api/bootstrap'
import { ErrorText } from '../components/StatusText'
import { SkeletonLines } from '../components/ui'
import { NotFoundPage } from '../pages/NotFoundPage'

// Layout route for /admin/*. Non-admins get the same 404 as any unknown page. The server enforces the group.
export function AdminRoute() {
  const bootstrap = useBootstrap()

  if (bootstrap.isPending) return <div className="p-8"><SkeletonLines label="Loading" /></div>
  if (bootstrap.isError) return <ErrorText error={bootstrap.error} />
  if (!bootstrap.data.me.isAdmin) return <NotFoundPage />
  return <Outlet />
}
