import { useMemo, useRef, useState } from 'react'
import { Outlet, useLocation } from 'react-router'
import { useBootstrap } from '../api/bootstrap'
import { PasskeyPrompt } from '../components/PasskeyPrompt'
import { SkeletonLines } from '../components/ui'
import { RouteFocus } from './RouteFocus'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { TopbarContext, type TopbarValue } from './topbar-context'
import { useShortcuts } from './use-shortcuts'
import { useSidebar } from './use-sidebar'

// Signed-in frame: sidebar (chat or admin mode), topbar and the page in <main>.
export function AppShell() {
  const bootstrap = useBootstrap()
  const sidebar = useSidebar()
  const searchRef = useRef<HTMLInputElement>(null)
  const [topbar, setTopbar] = useState<TopbarValue | null>(null)
  const { pathname } = useLocation()
  const topbarContext = useMemo(() => ({ set: setTopbar }), [])
  useShortcuts(sidebar, searchRef)

  if (!bootstrap.data) return <div className="p-8"><SkeletonLines label="Loading Genie" /></div>
  const { settings, me } = bootstrap.data
  const mode = pathname.startsWith('/admin') ? 'admin' : 'chat'
  const isDrawerOpen = !sidebar.isDesktop && sidebar.isOpen

  return (
    <TopbarContext.Provider value={topbarContext}>
      <div
        data-sidebar={sidebar.isOpen ? 'open' : 'closed'}
        className="grid h-dvh grid-cols-[minmax(0,1fr)] lg:grid-cols-[var(--sidebar-width)_minmax(0,1fr)] lg:transition-[grid-template-columns] lg:duration-[var(--duration-base)] lg:ease-[var(--ease-drawer)] lg:data-[sidebar=closed]:grid-cols-[0_minmax(0,1fr)]"
      >
        <Sidebar
          appName={settings.appName}
          email={me.email}
          isAdmin={me.isAdmin}
          pendingCount={me.pendingCount ?? 0}
          mode={mode}
          isOpen={sidebar.isOpen}
          onClose={sidebar.close}
          searchInputRef={searchRef}
        />
        {isDrawerOpen && (
          <div aria-hidden="true" onClick={sidebar.close} className="fixed inset-0 z-40 bg-scrim lg:hidden" />
        )}
        <div className="flex h-dvh min-w-0 flex-col" inert={isDrawerOpen}>
          <Topbar value={topbar} isSidebarHidden={!sidebar.isOpen} onOpenSidebar={sidebar.open} />
          <main id="main" tabIndex={-1} className="relative flex min-h-0 flex-1 flex-col overflow-y-auto outline-none [scrollbar-gutter:stable]">
            <PasskeyPrompt />
            <div key={pathname} className="animate-view min-h-0 flex-1">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
      <RouteFocus />
    </TopbarContext.Provider>
  )
}
