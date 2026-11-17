import { RouterProvider as AriaRouterProvider } from 'react-aria-components'
import { Outlet, useHref, useNavigate } from 'react-router'
import { ToastHost } from '../components/ui'
import { OfflineBanner } from './OfflineBanner'
import { SkipLink } from './SkipLink'

// Absolute and protocol-relative URLs are not router paths: they keep their own href.
const EXTERNAL_HREF = /^([a-z][a-z0-9+.-]*:|\/\/)/i

function useAriaHref(to: string): string {
  const href = useHref(EXTERNAL_HREF.test(to) ? '/' : to)
  return EXTERNAL_HREF.test(to) ? to : href
}

// Wraps every route: skip link, offline banner and the toast region. React Aria links (LinkButton, menu and tab
// items with an href) navigate through the router, so in-app links never reload the page; external ones stay normal.
export function RootLayout() {
  const navigate = useNavigate()
  return (
    <AriaRouterProvider navigate={(to, options) => void navigate(to, options)} useHref={useAriaHref}>
      <SkipLink />
      <OfflineBanner />
      <Outlet />
      <ToastHost />
    </AriaRouterProvider>
  )
}
